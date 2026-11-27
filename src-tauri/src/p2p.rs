//! P2P market sidecar: the `p2pd` trading daemon.
//!
//! `p2pd` is a separate wallet (a hot "trading wallet") plus the swap engines, a local HTTP API and
//! the market UI. This module only supervises the process: it starts it for the current network,
//! waits until its port answers, relays its output to the log, and on stop asks it to leave
//! cleanly (SIGTERM) so it can take its open offers off the relays before it exits.
//!
//! Launch resolution order:
//!   1. `$KALEIDO_P2PD_BIN`
//!   2. the bundled `bin/p2pd` resource
//!   3. `p2pd` on the PATH
//!
//! The daemon's keys live in the OS keychain (`--keystore keychain`), so no passphrase is passed
//! around. Its data (wallet, orders, trades) is kept per account under the app data directory.

use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::p2p_docker;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
/// `CREATE_NO_WINDOW`: no console window flashing on Windows.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const STOP_GRACE: Duration = Duration::from_secs(8);

/// A secret that never prints: logging a start config must not leak the recovery phrase.
#[derive(Clone, Deserialize)]
#[serde(transparent)]
pub struct Secret(String);

impl Secret {
    #[cfg(test)]
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }
}

impl std::fmt::Debug for Secret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Secret(..)")
    }
}

/// What the page may ask for: which network and which wallet, and the one-time secrets that are the
/// user's own. Everything else (relays, esplora, proxy, the fee address) is the app's choice, made
/// in [`crate::p2p_networks`]; a request that tries to carry any of it is refused.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct P2pStartRequest {
    /// Names the data directory and the keychain entry.
    pub account: String,
    /// The app's name for the network (`SignetCustom` for Mutinynet).
    pub network_key: String,
    /// The recovery phrase to create the wallet from, on its first start only. Handed to the daemon
    /// on its stdin, so it never appears in the process list; an existing wallet is never replaced.
    #[serde(default)]
    pub seed_mnemonic: Option<Secret>,
    /// Scan the whole address chain at start, to find a deposit the quick sync missed. Slower to start.
    #[serde(default)]
    pub rescan: bool,
}

/// How the daemon is started: what the app resolved from a [`P2pStartRequest`].
#[derive(Debug, Clone)]
pub struct P2pStartConfig {
    pub account: String,
    /// The daemon's network name from the app's P2P network table.
    pub network: String,
    pub indexer_url: String,
    pub proxy_url: String,
    pub relays: Vec<String>,
    pub fee_address: String,
    pub fee_bps: u64,
    pub min_fee_sat: u64,
    /// JSON list of the assets to show as verified.
    pub verified_assets_path: Option<String>,
    /// A curator (npub) whose asset listing on Nostr the daemon also vouches for.
    pub listing_curator: Option<String>,
    pub seed_mnemonic: Option<Secret>,
    pub rescan: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct P2pStatus {
    pub running: bool,
    pub port: Option<u16>,
    /// Where the market UI is served.
    pub url: Option<String>,
}

/// What the desktop UI may ask the daemon. The wallet-moving calls go through Rust rather than the
/// webview, so a web page can never reach the daemon's API and the daemon never has to trust the
/// webview's origin.
const ALLOWED: &[(&str, &str)] = &[
    ("GET", "/api/info"),
    ("GET", "/api/nostr/profiles"),
    ("POST", "/api/nostr/profiles"),
    ("POST", "/api/nostr/profiles/select"),
    ("POST", "/api/nostr/profiles/forget"),
    ("GET", "/api/balance"),
    ("GET", "/api/book"),
    ("GET", "/api/orders"),
    ("GET", "/api/trades"),
    ("GET", "/api/transfers"),
    ("POST", "/api/orders"),
    ("POST", "/api/take"),
    ("POST", "/api/rgb/invoice"),
    ("POST", "/api/rgb/decode"),
    ("POST", "/api/rgb/send"),
    ("POST", "/api/btc/send"),
    ("POST", "/api/refresh"),
    ("POST", "/api/recovery-phrase"),
    // the wallet half of the node API, which the app's wallet screens read
    ("POST", "/api/rln/btcbalance"),
    ("POST", "/api/rln/listassets"),
    ("POST", "/api/rln/assetbalance"),
    ("POST", "/api/rln/listtransfers"),
    ("POST", "/api/rln/listtransactions"),
    ("POST", "/api/rln/listunspents"),
    ("POST", "/api/rln/sendrgb"),
    ("POST", "/api/rln/createutxos"),
    ("POST", "/api/rln/issueassetnia"),
    ("POST", "/api/rln/issueassetcfa"),
    ("POST", "/api/rln/issueassetuda"),
    ("POST", "/api/rln/issueassetifa"),
    // the maker's strategy, when this wallet is the user's own maker (see maker.rs)
    ("GET", "/api/bot"),
    ("PUT", "/api/bot"),
    ("POST", "/api/bot/pause"),
    ("POST", "/api/bot/resume"),
    ("GET", "/api/usage"),
];

/// Whether the app may call `method path`: the market's own routes, nothing from the daemon's
/// development tools. Cancelling an order names the order in the path.
pub fn route_allowed(method: &str, path: &str) -> bool {
    // Only market signatures may carry a signer precondition in the URL.
    if let Some((route, signer)) = path.split_once("?signer=") {
        let signing = (method == "POST" && matches!(route, "/api/orders" | "/api/take"))
            || (method == "DELETE" && route.starts_with("/api/orders/"));
        return signing && signer.len() == 63 && signer.starts_with("npub1")
            && signer[5..].bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
            && !route.contains('?') && route_allowed(method, route);
    }
    if ALLOWED.contains(&(method, path)) {
        return true;
    }
    // the market's own ids: an order id, or an RGB contract id (`rgb:` and dashes, `~` and `_`)
    let named = |prefix: &str, ok: fn(char) -> bool| {
        path.strip_prefix(prefix)
            .is_some_and(|id| !id.is_empty() && id.len() <= 128 && id.chars().all(ok))
    };
    match method {
        "DELETE" => named("/api/orders/", |c| {
            c.is_ascii_alphanumeric() || matches!(c, '-' | '_')
        }),
        "GET" => {
            named("/api/asset/", |c| {
                c.is_ascii_alphanumeric() || matches!(c, ':' | '-' | '_' | '~')
            }) || path.strip_prefix("/api/makers?npubs=").is_some_and(|q| {
                !q.is_empty()
                    && q.len() <= 20 * 64
                    && q.chars().all(|c| c.is_ascii_alphanumeric() || c == ',')
            })
        }
        _ => false,
    }
}

#[derive(Default)]
pub struct P2pProcess {
    run: Mutex<Option<DaemonRun>>,
}

struct DaemonRun {
    child: Child,
    account: String,
    network: String,
    port: u16,
    /// Fresh for each launch, including restarts of the same wallet.
    token: String,
    ready: bool,
    deadline: Instant,
    tail: Arc<Mutex<VecDeque<String>>>,
    pid_file: Option<PathBuf>,
    container: Option<String>,
}

impl DaemonRun {
    fn alive(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    fn require_wallet(&self, cfg: &P2pStartConfig) -> Result<(), String> {
        if self.account == cfg.account && self.network == cfg.network {
            Ok(())
        } else {
            Err("A different P2P wallet is open. Close it before switching wallets.".into())
        }
    }
}

impl P2pStatus {
    fn from_port(port: Option<u16>) -> Self {
        Self {
            running: port.is_some(),
            port,
            url: port.map(|p| format!("http://127.0.0.1:{p}")),
        }
    }
}

/// 32 random bytes as hex.
pub(crate) fn new_token() -> String {
    use aes_gcm::aead::OsRng;
    use argon2::password_hash::rand_core::RngCore;
    let mut b = [0u8; 32];
    OsRng.fill_bytes(&mut b);
    hex::encode(b)
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

impl P2pProcess {
    pub fn new() -> Self {
        Self::default()
    }

    /// The daemon runs in a Docker container: paths on the host mean nothing to it.
    pub fn in_docker(&self) -> bool {
        lock(&self.run)
            .as_ref()
            .is_some_and(|r| r.container.is_some())
    }

    pub fn status(&self) -> P2pStatus {
        let mut current = lock(&self.run);
        P2pStatus::from_port(
            current
                .as_mut()
                .and_then(|r| (r.alive() && r.ready).then_some(r.port)),
        )
    }

    /// Start the daemon if it is not running and wait until it answers. Idempotent.
    pub fn ensure_started(
        &self,
        app: &AppHandle,
        cfg: &P2pStartConfig,
    ) -> Result<P2pStatus, String> {
        validate(cfg)?;
        let mut current = lock(&self.run);
        if let Some(run) = current.as_mut() {
            if run.alive() {
                run.require_wallet(cfg)?;
                let port = run.port;
                if run.ready {
                    return Ok(P2pStatus::from_port(Some(port)));
                }
                let token = run.token.clone();
                drop(current);
                return self.wait_for_wallet(port, &token);
            }
        }
        if let Some(old) = current.take() {
            old.stop();
        }
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("no app data dir: {e}"))?
            .join("p2pd")
            .join(&cfg.account);
        std::fs::create_dir_all(&data_dir).map_err(|e| format!("{}: {e}", data_dir.display()))?;
        let port = free_port()?;
        let token = new_token();

        // the bundled binary where there is one, otherwise the same daemon under Docker
        let program = resolve_binary(app);
        let native = runnable(&program, std::env::var_os("PATH").as_deref());
        let (mut cmd, container) = if native {
            reap_orphan(&data_dir.join("p2pd.pid"));
            let mut cmd = Command::new(&program);
            cmd.env("P2PD_API_TOKEN", &token);
            // p2pd uses --name as its keychain account. A dot cannot occur in a desktop profile name.
            let keychain_account = if cfg!(kaleidoswap_beta) {
                format!("{}.beta", cfg.account)
            } else {
                cfg.account.clone()
            };
            cmd.arg("--name")
                .arg(keychain_account)
                .args(["--port", &port.to_string()])
                .args(["--network", &cfg.network])
                .args(["--indexer", &cfg.indexer_url])
                .args(["--proxy", &cfg.proxy_url])
                .args(["--fee-address", &cfg.fee_address])
                .args(["--fee-bps", &cfg.fee_bps.to_string()])
                .args(["--min-fee-sat", &cfg.min_fee_sat.to_string()])
                .args([
                    "--keystore",
                    if cfg!(target_os = "macos") {
                        "keychain-biometric"
                    } else {
                        "keychain"
                    },
                ])
                .arg("--data-dir")
                .arg(&data_dir);
            for relay in &cfg.relays {
                cmd.args(["--relay", relay]);
            }
            if let Some(path) = &cfg.verified_assets_path {
                cmd.args(["--verified-assets", path]);
            }
            if let Some(npub) = &cfg.listing_curator {
                cmd.args(["--listing-curator", npub]);
            }
            if cfg.seed_mnemonic.is_some() {
                cmd.arg("--seed-stdin");
            }
            if cfg.rescan {
                cmd.arg("--rescan");
            }
            #[cfg(target_os = "windows")]
            cmd.creation_flags(CREATE_NO_WINDOW);
            log::info!(
                "[p2p] starting {program:?} on 127.0.0.1:{port} for {} ({})",
                cfg.account,
                cfg.network
            );
            (cmd, None)
        } else {
            match p2p_docker::engine() {
                p2p_docker::Engine::Ready => {}
                p2p_docker::Engine::Stopped => return Err("Docker is installed but not running. Start Docker Desktop and try again.".into()),
                p2p_docker::Engine::Missing => return Err("The P2P market needs Docker on this system. Install Docker Desktop and try again.".into()),
            }
            let image = p2p_docker::image()?;
            p2p_docker::ensure_image(&image)?;
            p2p_docker::remove_container(&cfg.account);
            let passphrase = p2p_docker::passphrase(&cfg.account)?;
            // the folder must exist before the mount, or Docker makes it
            let media_dir = data_dir.join(crate::p2p_media::UPLOAD_DIR);
            std::fs::create_dir_all(&media_dir)
                .map_err(|e| format!("{}: {e}", media_dir.display()))?;
            let files = p2p_docker::HostFiles {
                listing: cfg.verified_assets_path.clone(),
                media_dir: Some(media_dir.to_string_lossy().into_owned()),
            };
            let mut cmd = p2p_docker::docker();
            cmd.env("P2PD_API_TOKEN", &token)
                .env("P2PD_PASSPHRASE", &passphrase)
                .args(p2p_docker::run_args(&cfg.account, &image, port, &files))
                .args(p2p_docker::daemon_args(cfg, port));
            log::info!(
                "[p2p] starting {image} in Docker on 127.0.0.1:{port} for {} ({})",
                cfg.account,
                cfg.network
            );
            (cmd, Some(p2p_docker::container_name(&cfg.account)))
        };
        cmd.stdin(if cfg.seed_mnemonic.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
        let child = cmd
            .spawn()
            .map_err(|e| format!("could not start the P2P daemon: {e}"))?;
        let mut run = DaemonRun {
            child,
            account: cfg.account.clone(),
            network: cfg.network.clone(),
            port,
            token: token.clone(),
            ready: false,
            deadline: Instant::now()
                + if cfg.rescan {
                    STARTUP_TIMEOUT * 6
                } else {
                    STARTUP_TIMEOUT
                },
            tail: Arc::default(),
            pid_file: None,
            container,
        };
        if let Some(Secret(phrase)) = &cfg.seed_mnemonic {
            use std::io::Write;
            let body = serde_json::json!({ "mnemonic": phrase }).to_string();
            let sent = run
                .child
                .stdin
                .take()
                .ok_or_else(|| "could not reach the daemon's stdin".to_string())
                .and_then(|mut stdin| {
                    stdin.write_all(body.as_bytes()).map_err(|e| {
                        format!("could not hand the recovery phrase to the daemon: {e}")
                    })
                });
            if let Err(error) = sent {
                run.stop();
                return Err(error);
            }
        }
        if run.container.is_none() {
            let pid_file = data_dir.join("p2pd.pid");
            let _ = std::fs::write(&pid_file, run.child.id().to_string());
            run.pid_file = Some(pid_file);
        }
        pipe_to_log(run.child.stdout.take(), "out", Arc::clone(&run.tail));
        pipe_to_log(run.child.stderr.take(), "err", Arc::clone(&run.tail));
        *current = Some(run);
        drop(current);
        self.wait_for_wallet(port, &token)
    }

    fn wait_for_wallet(&self, port: u16, token: &str) -> Result<P2pStatus, String> {
        let mut answered = false;
        loop {
            let mut current = lock(&self.run);
            // A late probe or timeout from an old run must never affect its replacement.
            let run = current
                .as_mut()
                .filter(|r| r.token == token)
                .ok_or("The P2P wallet was closed while starting.")?;
            if !run.alive() {
                let tail = Arc::clone(&run.tail);
                current.take().unwrap().stop();
                drop(current);
                // give the output threads a moment to hand over the last lines
                thread::sleep(Duration::from_millis(200));
                let why = lock(&tail)
                    .iter()
                    .rev()
                    .take(4)
                    .rev()
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(" / ");
                return Err(if why.is_empty() {
                    "the P2P daemon exited while starting (a first start with the OS keychain may ask for permission)".into()
                } else {
                    format!("the P2P daemon exited while starting: {why}")
                });
            }
            if answered || run.ready {
                run.ready = true;
                return Ok(P2pStatus::from_port(Some(port)));
            }
            if Instant::now() > run.deadline {
                current.take().unwrap().stop();
                return Err("the P2P daemon did not come up in time".into());
            }
            drop(current);
            answered = daemon_answers(port, token);
            if !answered {
                thread::sleep(Duration::from_millis(250));
            }
        }
    }

    /// Call one of the daemon's allowed endpoints. The daemon refuses requests that carry a browser
    /// `Origin`; this one does not, because it is made from here.
    pub fn request(
        &self,
        method: &str,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, String> {
        if !route_allowed(method, path) {
            return Err(format!("{method} {path} is not available from the app"));
        }
        let (port, token) = {
            let mut current = lock(&self.run);
            let run = current.as_mut().ok_or("the P2P daemon is not running")?;
            if !run.ready || !run.alive() {
                return Err("the P2P daemon is not running".into());
            }
            (run.port, run.token.clone())
        };
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(|e| e.to_string())?;
        let url = format!("http://127.0.0.1:{port}{path}");
        let req = match method {
            "GET" => client.get(url),
            "POST" => client
                .post(url)
                .json(&body.unwrap_or(serde_json::Value::Null)),
            "PUT" => client
                .put(url)
                .json(&body.unwrap_or(serde_json::Value::Null)),
            "DELETE" => client.delete(url),
            other => return Err(format!("unsupported method {other}")),
        }
        .bearer_auth(token);
        let res = req
            .send()
            .map_err(|e| format!("the P2P daemon did not answer: {e}"))?;
        let status = res.status();
        let text = res.text().map_err(|e| e.to_string())?;
        if !status.is_success() {
            return Err(if text.is_empty() {
                status.to_string()
            } else {
                text
            });
        }
        if text.is_empty() {
            return Ok(serde_json::Value::Null);
        }
        serde_json::from_str(&text)
            .map_err(|e| format!("unexpected answer from the P2P daemon: {e}"))
    }

    /// Stop the daemon. It is asked to leave (SIGTERM) so that it withdraws its open offers from
    /// the relays first; if it has not gone after a few seconds it is killed.
    pub fn stop(&self) {
        let mut current = lock(&self.run);
        if let Some(run) = current.take() {
            run.stop();
        }
    }
}

impl DaemonRun {
    fn stop(mut self) {
        if let Some(name) = self.container.take() {
            p2p_docker::stop_container(&name);
        }
        if let Some(f) = self.pid_file.take() {
            let _ = std::fs::remove_file(f);
        }
        if !self.alive() {
            return;
        }
        let mut child = self.child;
        #[cfg(unix)]
        // SAFETY: `kill` only sends a signal to the child pid we spawned.
        unsafe {
            libc::kill(child.id() as libc::pid_t, libc::SIGTERM);
        }
        #[cfg(not(unix))]
        let _ = child.kill();
        let deadline = Instant::now() + STOP_GRACE;
        while Instant::now() < deadline {
            if matches!(child.try_wait(), Ok(Some(_))) {
                return;
            }
            thread::sleep(Duration::from_millis(100));
        }
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn account_ok(account: &str) -> bool {
    !account.is_empty()
        && account
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
}

/// A new recovery phrase from the daemon's own generator, so the app and the daemon agree on what a
/// valid phrase is. Nothing is created: the phrase exists only until the user has written it down and
/// the wallet is started from it.
pub fn generate_seed(app: &AppHandle, network: &str) -> Result<String, String> {
    crate::p2p_networks::require_daemon_network(network)?;
    let program = resolve_binary(app);
    let mut cmd = Command::new(&program);
    cmd.args([
        "--generate-seed",
        "--network",
        network,
        "--fee-address",
        "unused",
    ])
    .stdin(Stdio::null());
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let out = cmd
        .output()
        .map_err(|e| format!("could not run the P2P daemon ({program:?}): {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "the P2P daemon could not make a phrase: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    let v: serde_json::Value = serde_json::from_slice(&out.stdout)
        .map_err(|e| format!("unexpected answer from the P2P daemon: {e}"))?;
    v.get("mnemonic")
        .and_then(|m| m.as_str())
        .map(str::to_string)
        .ok_or_else(|| "the P2P daemon sent no phrase".into())
}

fn profile_path(app: &AppHandle, account: &str) -> Result<PathBuf, String> {
    if !account_ok(account) {
        return Err("the account name must be letters, digits, - or _".into());
    }
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?
        .join("p2pd")
        .join(account)
        .join("profile.json"))
}

/// Whether this trading wallet was set up here, and whether its phrase was confirmed. The app keeps
/// this next to the daemon's data; the keys themselves stay in the keychain.
pub fn profile_get(app: &AppHandle, account: &str) -> Result<Option<serde_json::Value>, String> {
    let path = profile_path(app, account)?;
    match std::fs::read_to_string(&path) {
        Ok(text) => Ok(serde_json::from_str(&text).ok()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("{}: {e}", path.display())),
    }
}

pub fn profile_set(
    app: &AppHandle,
    account: &str,
    profile: &serde_json::Value,
) -> Result<(), String> {
    let path = profile_path(app, account)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    }
    std::fs::write(&path, profile.to_string()).map_err(|e| format!("{}: {e}", path.display()))
}

/// A bech32 npub: `npub1` and 58 characters of the bech32 alphabet.
pub(crate) fn npub_ok(n: &str) -> bool {
    n.len() == 63
        && n.strip_prefix("npub1").is_some_and(|d| {
            d.chars()
                .all(|c| "qpzry9x8gf2tvdw0s3jn54khce6mua7l".contains(c))
        })
}

fn validate(cfg: &P2pStartConfig) -> Result<(), String> {
    if !account_ok(&cfg.account) {
        return Err("the account name must be letters, digits, - or _".into());
    }
    crate::p2p_networks::require_daemon_network(&cfg.network)?;
    if cfg.relays.is_empty()
        || cfg.fee_address.is_empty()
        || cfg.indexer_url.is_empty()
        || cfg.proxy_url.is_empty()
    {
        return Err("relays, indexer, proxy and fee address are all required".into());
    }
    if cfg.listing_curator.as_deref().is_some_and(|n| !npub_ok(n)) {
        return Err("the listing curator must be an npub".into());
    }
    Ok(())
}

fn free_port() -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| format!("no free port: {e}"))?;
    listener
        .local_addr()
        .map(|a| a.port())
        .map_err(|e| e.to_string())
}

/// Where the bundler may have put the daemon. `../bin/p2pd` lands under `_up_/bin` on macOS and
/// Linux and next to the other resources on Windows, like the RGB node.
fn binary_candidates(resources: &Path, exe: &str) -> Vec<PathBuf> {
    vec![
        resources.join("_up_").join("bin").join(exe),
        resources.join("bin").join(exe),
        resources.join(exe),
    ]
}

fn resolve_binary(app: &AppHandle) -> PathBuf {
    if let Some(path) = std::env::var_os("KALEIDO_P2PD_BIN") {
        return PathBuf::from(path);
    }
    let exe = if cfg!(target_os = "windows") {
        "p2pd.exe"
    } else {
        "p2pd"
    };
    if let Ok(res) = app.path().resource_dir() {
        if let Some(bundled) = binary_candidates(&res, exe)
            .into_iter()
            .find(|p| p.is_file())
        {
            return bundled;
        }
    }
    PathBuf::from(exe)
}

/// Whether `program` can be run: a path that is a file, or a bare name found on `path_var`.
fn runnable(program: &Path, path_var: Option<&std::ffi::OsStr>) -> bool {
    if program.components().count() > 1 {
        return program.is_file();
    }
    path_var.is_some_and(|p| std::env::split_paths(p).any(|dir| dir.join(program).is_file()))
}

/// Whether the daemon answers its API: the port of a container accepts connections before the
/// daemon inside is up, so a bare connect says nothing.
fn daemon_answers(port: u16, token: &str) -> bool {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .and_then(|c| {
            c.get(format!("http://127.0.0.1:{port}/api/info"))
                .bearer_auth(token)
                .send()
        })
        .is_ok_and(|r| r.status().is_success())
}

/// Where the daemon can run on this system, or what is in the way. A packaged build carries the
/// binary where it could be built; a development run points at one with `KALEIDO_P2PD_BIN` or has
/// it on the PATH; anywhere else it can run under Docker.
pub fn availability(app: &AppHandle) -> p2p_docker::Availability {
    let native = runnable(&resolve_binary(app), std::env::var_os("PATH").as_deref());
    // asking Docker takes a moment, so only when there is no binary
    let engine = if native {
        p2p_docker::Engine::Missing
    } else {
        p2p_docker::engine()
    };
    p2p_docker::decide(native, engine, p2p_docker::image().is_ok())
}

fn pipe_to_log(
    stream: Option<impl std::io::Read + Send + 'static>,
    tag: &'static str,
    tail: Arc<Mutex<VecDeque<String>>>,
) {
    let Some(stream) = stream else { return };
    thread::spawn(move || {
        for line in BufReader::new(stream).lines().map_while(Result::ok) {
            if !line.trim().is_empty() {
                log::info!("[p2pd:{tag}] {line}");
                let mut t = lock(&tail);
                if t.len() >= 12 {
                    t.pop_front();
                }
                t.push_back(line);
            }
        }
    });
}

/// A daemon left over from an earlier run of the app (the app was killed, or crashed) still holds
/// the wallet's database and port, and the new one cannot start beside it. Stop it first. Only a
/// process that is still a `p2pd` is touched: a pid that was reused by something else is left alone.
#[cfg(unix)]
fn reap_orphan(pid_file: &Path) {
    let Some(pid) = std::fs::read_to_string(pid_file)
        .ok()
        .and_then(|t| t.trim().parse::<i32>().ok())
    else {
        return;
    };
    let is_p2pd = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "command="])
        .output()
        .is_ok_and(|o| String::from_utf8_lossy(&o.stdout).contains("p2pd"));
    if is_p2pd {
        log::warn!("[p2p] stopping a daemon left over from an earlier run (pid {pid})");
        // SAFETY: `kill` only signals the pid we just confirmed is a p2pd.
        unsafe { libc::kill(pid, libc::SIGTERM) };
        let deadline = Instant::now() + STOP_GRACE;
        while Instant::now() < deadline
            && Command::new("kill")
                .args(["-0", &pid.to_string()])
                .output()
                .is_ok_and(|o| o.status.success())
        {
            thread::sleep(Duration::from_millis(200));
        }
        // SAFETY: as above; a no-op if it is already gone.
        unsafe { libc::kill(pid, libc::SIGKILL) };
    }
    let _ = std::fs::remove_file(pid_file);
}

#[cfg(not(unix))]
fn reap_orphan(pid_file: &Path) {
    let _ = std::fs::remove_file(pid_file);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_commands_and_signed_routes_are_scoped() {
        assert!(route_allowed("POST", "/api/nostr/profiles/select"));
        assert!(route_allowed("POST", "/api/nostr/profiles/forget"));
        assert!(!route_allowed("GET", "/api/nostr/profiles/forget"));
        let signer = format!("npub1{}", "q".repeat(58));
        assert!(route_allowed("POST", &format!("/api/take?signer={signer}")));
        assert!(route_allowed("DELETE", &format!("/api/orders/order1?signer={signer}")));
        assert!(!route_allowed("POST", &format!("/api/recovery-phrase?signer={signer}")));
        assert!(!route_allowed("POST", &format!("/api/take?signer={signer}&other=1")));
    }

    #[test]
    fn the_bundled_daemon_is_looked_for_where_the_bundler_puts_it() {
        let res = Path::new("/app/Resources");
        let found = binary_candidates(res, "p2pd");
        assert_eq!(found[0], Path::new("/app/Resources/_up_/bin/p2pd"));
        assert!(found.contains(&Path::new("/app/Resources/p2pd").to_path_buf()));
    }

    fn cfg() -> P2pStartConfig {
        P2pStartConfig {
            account: "alice".into(),
            network: "signet".into(),
            indexer_url: "https://signet.example/api".into(),
            proxy_url: "https://proxy.example/json-rpc".into(),
            relays: vec!["wss://relay.example".into()],
            fee_address: "tb1qexample".into(),
            fee_bps: 100,
            min_fee_sat: 1_000,
            verified_assets_path: None,
            listing_curator: None,
            seed_mnemonic: None,
            rescan: false,
        }
    }

    #[test]
    fn a_complete_config_is_accepted() {
        assert!(validate(&cfg()).is_ok());
    }

    #[test]
    fn an_open_wallet_is_reused_only_for_its_own_account_and_network() {
        // sort reads from its pipe until EOF on Windows, Linux and macOS.
        let mut child = Command::new("sort").stdin(Stdio::piped()).spawn().unwrap();
        let stdin = child.stdin.take().unwrap();
        let cfg = cfg();
        let run = DaemonRun {
            child,
            account: cfg.account.clone(),
            network: cfg.network.clone(),
            port: 1,
            token: "current-session".into(),
            ready: true,
            deadline: Instant::now(),
            tail: Arc::default(),
            pid_file: None,
            container: None,
        };
        assert!(run.require_wallet(&cfg).is_ok());
        assert!(run
            .require_wallet(&P2pStartConfig {
                network: "signetcustom".into(),
                ..cfg.clone()
            })
            .is_err());
        assert!(run
            .require_wallet(&P2pStartConfig {
                account: "bob".into(),
                ..cfg
            })
            .is_err());
        let process = P2pProcess {
            run: Mutex::new(Some(run)),
        };
        assert!(process.wait_for_wallet(1, "previous-session").is_err());
        assert!(
            process
                .wait_for_wallet(1, "current-session")
                .unwrap()
                .running
        );
        drop(stdin);
        process.stop();
        assert!(!process.status().running);
    }

    #[test]
    fn an_account_name_cannot_escape_the_data_directory() {
        for bad in ["", "../x", "a/b", "a b", "a;b"] {
            let c = P2pStartConfig {
                account: bad.into(),
                ..cfg()
            };
            assert!(validate(&c).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn mutinynet_is_its_own_network_not_signet() {
        assert!(validate(&P2pStartConfig {
            network: "signetcustom".into(),
            ..cfg()
        })
        .is_ok());
    }

    #[test]
    fn an_unknown_network_or_a_missing_piece_is_refused() {
        assert!(validate(&P2pStartConfig {
            network: "moon".into(),
            ..cfg()
        })
        .is_err());
        assert!(validate(&P2pStartConfig {
            relays: vec![],
            ..cfg()
        })
        .is_err());
        assert!(validate(&P2pStartConfig {
            fee_address: String::new(),
            ..cfg()
        })
        .is_err());
        assert!(validate(&P2pStartConfig {
            listing_curator: Some("npub1; rm -rf".into()),
            ..cfg()
        })
        .is_err());
        assert!(validate(&P2pStartConfig {
            listing_curator: Some(
                "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6".into()
            ),
            ..cfg()
        })
        .is_ok());
    }

    #[test]
    fn only_the_market_routes_are_reachable_from_the_app() {
        for (m, p) in [
            ("GET", "/api/info"),
    ("GET", "/api/nostr/profiles"),
    ("POST", "/api/nostr/profiles"),
    ("POST", "/api/nostr/profiles/select"),
            ("GET", "/api/book"),
            ("POST", "/api/take"),
            ("POST", "/api/orders"),
            ("POST", "/api/btc/send"),
            ("POST", "/api/rln/createutxos"),
            ("POST", "/api/rln/issueassetnia"),
            ("GET", "/api/bot"),
            ("PUT", "/api/bot"),
            ("POST", "/api/bot/pause"),
            ("GET", "/api/usage"),
            ("DELETE", "/api/orders/aB3-_9"),
            (
                "GET",
                "/api/asset/rgb:4bU8bbHe-171EgfO-0q6Hy8Q-_xczpHF-56GrDjt-KNMyzCA",
            ),
            ("GET", "/api/makers?npubs=npub1abc,npub1def"),
        ] {
            assert!(route_allowed(m, p), "{m} {p}");
        }
        for (m, p) in [
            ("POST", "/api/dev/fund"),
            ("GET", "/api/dev/mine"),
            ("GET", "/api/take"),
            ("DELETE", "/api/orders"),
            ("DELETE", "/api/orders/"),
            ("DELETE", "/api/orders/../info"),
            ("DELETE", "/api/orders/a/b"),
            ("DELETE", "/api/info"),
            ("GET", "/api/asset/"),
            ("GET", "/api/asset/rgb:a/b"),
            ("GET", "/api/asset/../info"),
            ("GET", "/api/makers"),
            ("GET", "/api/makers?npubs="),
            ("GET", "/api/makers?npubs=a&x=1"),
            ("GET", "/api/makers?npubs=../info"),
            ("POST", "/api/asset/rgb:abc"),
            ("PUT", "/api/orders"),
            ("PUT", "/api/bot/pause"),
            ("GET", "/api/usage?from=x"),
            ("GET", "/api/../etc"),
            ("GET", "/"),
            ("GET", "/api/info/"),
            ("GET", "http://evil/api/info"),
        ] {
            assert!(!route_allowed(m, p), "{m} {p}");
        }
    }

    #[test]
    fn a_request_to_a_stopped_daemon_is_an_error_not_a_hang() {
        let err = P2pProcess::new()
            .request("GET", "/api/info", None)
            .unwrap_err();
        assert!(err.contains("not running"), "{err}");
    }

    #[test]
    fn a_process_that_was_never_started_reports_stopped() {
        let p = P2pProcess::new();
        let s = p.status();
        assert!(!s.running && s.port.is_none() && s.url.is_none());
        p.stop(); // and stopping it is harmless
    }

    #[test]
    fn a_daemon_is_found_by_path_or_by_name_on_the_path() {
        let dir = std::env::temp_dir().join(format!("p2p-runnable-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("p2pd-test-bin");
        std::fs::write(&exe, b"").unwrap();
        assert!(runnable(&exe, None), "a file path");
        assert!(
            !runnable(&dir.join("missing"), None),
            "a path with nothing at the end"
        );
        assert!(
            runnable(Path::new("p2pd-test-bin"), Some(dir.as_os_str())),
            "a bare name on the PATH"
        );
        assert!(
            !runnable(Path::new("p2pd-test-bin"), None),
            "a bare name with no PATH"
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_recovery_phrase_never_prints_and_is_only_asked_for_with_a_post() {
        let cfg = P2pStartConfig {
            seed_mnemonic: Some(Secret::new("abandon ability able")),
            ..cfg()
        };
        assert!(
            !format!("{cfg:?}").contains("abandon"),
            "a logged config must not leak the phrase"
        );
        assert!(route_allowed("POST", "/api/recovery-phrase"));
        assert!(!route_allowed("GET", "/api/recovery-phrase"));
    }
}
