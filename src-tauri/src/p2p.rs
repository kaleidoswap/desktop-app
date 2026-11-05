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

use std::io::{BufRead, BufReader};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

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

impl std::fmt::Debug for Secret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Secret(..)")
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct P2pStartConfig {
    /// Names the data directory and the keychain entry.
    pub account: String,
    /// `regtest`, `signet`, `signetcustom` (Mutinynet), `testnet` or `mainnet`.
    pub network: String,
    pub indexer_url: String,
    pub proxy_url: String,
    pub relays: Vec<String>,
    pub fee_address: String,
    #[serde(default = "default_fee_bps")]
    pub fee_bps: u64,
    #[serde(default = "default_min_fee")]
    pub min_fee_sat: u64,
    /// JSON list of the assets to show as verified.
    #[serde(default)]
    pub verified_assets_path: Option<String>,
    /// The recovery phrase to create the wallet from, on its first start only. Handed to the daemon
    /// on its stdin, so it never appears in the process list; an existing wallet is never replaced.
    #[serde(default)]
    pub seed_mnemonic: Option<Secret>,
}

fn default_fee_bps() -> u64 {
    100
}

fn default_min_fee() -> u64 {
    1_000
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
    ("GET", "/api/balance"),
    ("GET", "/api/book"),
    ("GET", "/api/orders"),
    ("GET", "/api/trades"),
    ("GET", "/api/transfers"),
    ("POST", "/api/orders"),
    ("POST", "/api/take"),
    ("POST", "/api/rgb/invoice"),
    ("POST", "/api/rgb/send"),
    ("POST", "/api/btc/send"),
    ("POST", "/api/refresh"),
    ("POST", "/api/recovery-phrase"),
];

/// Whether the app may call `method path`: the market's own routes, nothing from the daemon's
/// development tools. Cancelling an order names the order in the path.
pub fn route_allowed(method: &str, path: &str) -> bool {
    if ALLOWED.contains(&(method, path)) {
        return true;
    }
    // the market's own ids: an order id, or an RGB contract id (`rgb:` and dashes, `~` and `_`)
    let named = |prefix: &str, ok: fn(char) -> bool| {
        path.strip_prefix(prefix).is_some_and(|id| !id.is_empty() && id.len() <= 128 && id.chars().all(ok))
    };
    match method {
        "DELETE" => named("/api/orders/", |c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_')),
        "GET" => named("/api/asset/", |c| c.is_ascii_alphanumeric() || matches!(c, ':' | '-' | '_' | '~')),
        _ => false,
    }
}

#[derive(Default)]
pub struct P2pProcess {
    child: Arc<Mutex<Option<Child>>>,
    port: Arc<Mutex<Option<u16>>>,
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

impl P2pProcess {
    pub fn new() -> Self {
        Self::default()
    }

    fn alive(child: &mut Option<Child>) -> bool {
        matches!(child.as_mut().map(Child::try_wait), Some(Ok(None)))
    }

    pub fn status(&self) -> P2pStatus {
        let running = Self::alive(&mut lock(&self.child));
        let port = if running { *lock(&self.port) } else { None };
        P2pStatus { running, port, url: port.map(|p| format!("http://127.0.0.1:{p}")) }
    }

    /// Start the daemon if it is not running and wait until it answers. Idempotent.
    pub fn ensure_started(&self, app: &AppHandle, cfg: &P2pStartConfig) -> Result<P2pStatus, String> {
        let mut child_guard = lock(&self.child);
        if Self::alive(&mut child_guard) {
            drop(child_guard);
            return Ok(self.status());
        }
        validate(cfg)?;
        let program = resolve_binary(app);
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("no app data dir: {e}"))?
            .join("p2pd")
            .join(&cfg.account);
        std::fs::create_dir_all(&data_dir).map_err(|e| format!("{}: {e}", data_dir.display()))?;
        let port = free_port()?;

        let mut cmd = Command::new(&program);
        cmd.arg("--name")
            .arg(&cfg.account)
            .args(["--port", &port.to_string()])
            .args(["--network", &cfg.network])
            .args(["--indexer", &cfg.indexer_url])
            .args(["--proxy", &cfg.proxy_url])
            .args(["--fee-address", &cfg.fee_address])
            .args(["--fee-bps", &cfg.fee_bps.to_string()])
            .args(["--min-fee-sat", &cfg.min_fee_sat.to_string()])
            .args(["--keystore", "keychain"])
            .arg("--data-dir")
            .arg(&data_dir)
            .stdin(if cfg.seed_mnemonic.is_some() { Stdio::piped() } else { Stdio::null() })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        for relay in &cfg.relays {
            cmd.args(["--relay", relay]);
        }
        if let Some(path) = &cfg.verified_assets_path {
            cmd.args(["--verified-assets", path]);
        }
        if cfg.network == "mainnet" {
            cmd.arg("--allow-mainnet");
        }
        if cfg.seed_mnemonic.is_some() {
            cmd.arg("--seed-stdin");
        }
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        log::info!("[p2p] starting {program:?} on 127.0.0.1:{port} for {} ({})", cfg.account, cfg.network);
        let mut child = cmd.spawn().map_err(|e| format!("could not start the P2P daemon ({program:?}): {e}"))?;
        if let Some(Secret(phrase)) = &cfg.seed_mnemonic {
            use std::io::Write;
            let mut stdin = child.stdin.take().ok_or("could not reach the daemon's stdin")?;
            let body = serde_json::json!({ "mnemonic": phrase }).to_string();
            stdin.write_all(body.as_bytes()).map_err(|e| format!("could not hand the recovery phrase to the daemon: {e}"))?;
            // closing stdin is what tells the daemon the phrase is complete
        }
        pipe_to_log(child.stdout.take(), "out");
        pipe_to_log(child.stderr.take(), "err");
        *child_guard = Some(child);
        *lock(&self.port) = Some(port);
        drop(child_guard);

        // the daemon answers once its wallet is up and it is connected to the relays
        let deadline = Instant::now() + STARTUP_TIMEOUT;
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        loop {
            if TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok() {
                return Ok(self.status());
            }
            if !Self::alive(&mut lock(&self.child)) {
                return Err("the P2P daemon exited while starting; see the log (a first start with the OS keychain may ask for permission)".into());
            }
            if Instant::now() > deadline {
                self.stop();
                return Err("the P2P daemon did not come up in time".into());
            }
            thread::sleep(Duration::from_millis(250));
        }
    }

    /// Call one of the daemon's allowed endpoints. The daemon refuses requests that carry a browser
    /// `Origin`; this one does not, because it is made from here.
    pub fn request(&self, method: &str, path: &str, body: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
        if !route_allowed(method, path) {
            return Err(format!("{method} {path} is not available from the app"));
        }
        let port = self.status().port.ok_or("the P2P daemon is not running")?;
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(|e| e.to_string())?;
        let url = format!("http://127.0.0.1:{port}{path}");
        let req = match method {
            "GET" => client.get(url),
            "POST" => client.post(url).json(&body.unwrap_or(serde_json::Value::Null)),
            "DELETE" => client.delete(url),
            other => return Err(format!("unsupported method {other}")),
        };
        let res = req.send().map_err(|e| format!("the P2P daemon did not answer: {e}"))?;
        let status = res.status();
        let text = res.text().map_err(|e| e.to_string())?;
        if !status.is_success() {
            return Err(if text.is_empty() { status.to_string() } else { text });
        }
        if text.is_empty() {
            return Ok(serde_json::Value::Null);
        }
        serde_json::from_str(&text).map_err(|e| format!("unexpected answer from the P2P daemon: {e}"))
    }

    /// Stop the daemon. It is asked to leave (SIGTERM) so that it withdraws its open offers from
    /// the relays first; if it has not gone after a few seconds it is killed.
    pub fn stop(&self) {
        let Some(mut child) = lock(&self.child).take() else { return };
        *lock(&self.port) = None;
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
    !account.is_empty() && account.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
}

fn networks_ok(network: &str) -> bool {
    matches!(network, "regtest" | "signet" | "signetcustom" | "testnet" | "testnet4" | "mainnet")
}

/// A new recovery phrase from the daemon's own generator, so the app and the daemon agree on what a
/// valid phrase is. Nothing is created: the phrase exists only until the user has written it down and
/// the wallet is started from it.
pub fn generate_seed(app: &AppHandle, network: &str) -> Result<String, String> {
    if !networks_ok(network) {
        return Err(format!("unknown network {network:?}"));
    }
    let program = resolve_binary(app);
    let mut cmd = Command::new(&program);
    cmd.args(["--generate-seed", "--network", network, "--fee-address", "unused"]).stdin(Stdio::null());
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let out = cmd.output().map_err(|e| format!("could not run the P2P daemon ({program:?}): {e}"))?;
    if !out.status.success() {
        return Err(format!("the P2P daemon could not make a phrase: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).map_err(|e| format!("unexpected answer from the P2P daemon: {e}"))?;
    v.get("mnemonic").and_then(|m| m.as_str()).map(str::to_string).ok_or_else(|| "the P2P daemon sent no phrase".into())
}

fn profile_path(app: &AppHandle, account: &str) -> Result<PathBuf, String> {
    if !account_ok(account) {
        return Err("the account name must be letters, digits, - or _".into());
    }
    Ok(app.path().app_data_dir().map_err(|e| format!("no app data dir: {e}"))?.join("p2pd").join(account).join("profile.json"))
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

pub fn profile_set(app: &AppHandle, account: &str, profile: &serde_json::Value) -> Result<(), String> {
    let path = profile_path(app, account)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    }
    std::fs::write(&path, profile.to_string()).map_err(|e| format!("{}: {e}", path.display()))
}

fn validate(cfg: &P2pStartConfig) -> Result<(), String> {
    if !account_ok(&cfg.account) {
        return Err("the account name must be letters, digits, - or _".into());
    }
    if !networks_ok(&cfg.network) {
        return Err(format!("unknown network {:?}", cfg.network));
    }
    if cfg.relays.is_empty() || cfg.fee_address.is_empty() || cfg.indexer_url.is_empty() || cfg.proxy_url.is_empty() {
        return Err("relays, indexer, proxy and fee address are all required".into());
    }
    Ok(())
}

fn free_port() -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| format!("no free port: {e}"))?;
    listener.local_addr().map(|a| a.port()).map_err(|e| e.to_string())
}

/// Where the bundler may have put the daemon. `../bin/p2pd` lands under `_up_/bin` on macOS and
/// Linux and next to the other resources on Windows, like the RGB node.
fn binary_candidates(resources: &Path, exe: &str) -> Vec<PathBuf> {
    vec![resources.join("_up_").join("bin").join(exe), resources.join("bin").join(exe), resources.join(exe)]
}

fn resolve_binary(app: &AppHandle) -> PathBuf {
    if let Some(path) = std::env::var_os("KALEIDO_P2PD_BIN") {
        return PathBuf::from(path);
    }
    let exe = if cfg!(target_os = "windows") { "p2pd.exe" } else { "p2pd" };
    if let Ok(res) = app.path().resource_dir() {
        if let Some(bundled) = binary_candidates(&res, exe).into_iter().find(|p| p.is_file()) {
            return bundled;
        }
    }
    PathBuf::from(exe)
}

fn pipe_to_log(stream: Option<impl std::io::Read + Send + 'static>, tag: &'static str) {
    let Some(stream) = stream else { return };
    thread::spawn(move || {
        for line in BufReader::new(stream).lines().map_while(Result::ok) {
            if !line.trim().is_empty() {
                log::info!("[p2pd:{tag}] {line}");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

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
            seed_mnemonic: None,
        }
    }

    #[test]
    fn a_complete_config_is_accepted() {
        assert!(validate(&cfg()).is_ok());
    }

    #[test]
    fn an_account_name_cannot_escape_the_data_directory() {
        for bad in ["", "../x", "a/b", "a b", "a;b"] {
            let c = P2pStartConfig { account: bad.into(), ..cfg() };
            assert!(validate(&c).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn mutinynet_is_its_own_network_not_signet() {
        assert!(validate(&P2pStartConfig { network: "signetcustom".into(), ..cfg() }).is_ok());
    }

    #[test]
    fn an_unknown_network_or_a_missing_piece_is_refused() {
        assert!(validate(&P2pStartConfig { network: "moon".into(), ..cfg() }).is_err());
        assert!(validate(&P2pStartConfig { relays: vec![], ..cfg() }).is_err());
        assert!(validate(&P2pStartConfig { fee_address: String::new(), ..cfg() }).is_err());
    }

    #[test]
    fn the_config_reads_from_the_json_the_ui_sends_with_defaults() {
        let c: P2pStartConfig = serde_json::from_str(
            r#"{"account":"a","network":"signet","indexer_url":"i","proxy_url":"p","relays":["r"],"fee_address":"f"}"#,
        )
        .unwrap();
        assert_eq!((c.fee_bps, c.min_fee_sat), (100, 1_000));
    }

    #[test]
    fn only_the_market_routes_are_reachable_from_the_app() {
        for (m, p) in [("GET", "/api/info"), ("GET", "/api/book"), ("POST", "/api/take"), ("POST", "/api/orders"), ("POST", "/api/btc/send"), ("DELETE", "/api/orders/aB3-_9"), ("GET", "/api/asset/rgb:4bU8bbHe-171EgfO-0q6Hy8Q-_xczpHF-56GrDjt-KNMyzCA")] {
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
            ("POST", "/api/asset/rgb:abc"),
            ("PUT", "/api/orders"),
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
        let err = P2pProcess::new().request("GET", "/api/info", None).unwrap_err();
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
    fn the_recovery_phrase_never_prints_and_is_only_asked_for_with_a_post() {
        let json = r#"{"account":"a","network":"signet","indexer_url":"i","proxy_url":"p","relays":["r"],"fee_address":"f","seed_mnemonic":"abandon ability able"}"#;
        let cfg: P2pStartConfig = serde_json::from_str(json).unwrap();
        assert!(cfg.seed_mnemonic.is_some());
        assert!(!format!("{cfg:?}").contains("abandon"), "a logged config must not leak the phrase");
        assert!(route_allowed("POST", "/api/recovery-phrase"));
        assert!(!route_allowed("GET", "/api/recovery-phrase"));
    }
}
