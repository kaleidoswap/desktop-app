//! Maker mode: the client side of a maker KaleidoSwap hosts, or of one the user runs.
//!
//! **Hosted** (the recommended model): KaleidoSwap runs p2pd with the client's strategy on its
//! own machine, around the clock, with a watch-only wallet. This app keeps the keys and runs the
//! policy signer (`signer-core`, from the p2pd repository): the maker sends each swap it
//! negotiated over Nostr (kind 24253, NIP-44, paired by key); the signer works out the swap's terms
//! from the PSBT and its own wallet, and signs only if the client's signed policy allows them. The strategy is set through the maker's tenant API.
//!
//! **Self-hosted**: the user's own p2pd (this app's trading wallet, or one they run) quotes and
//! signs by itself; the app only sets its strategy through the same API.
//!
//! Mutinynet (and the local regtest stack in development builds) only: every command refuses any
//! other network, and the signer is not offered on mainnet until it is audited.
//!
//! What is kept where:
//! * OS keychain: the signer's wallet mnemonic and Nostr key (`maker-signer-<network>`), and the
//!   hosted maker's API token (`maker-token-<network>`)
//! * `<app data>/maker/<network>/`: `config.json` (mode, endpoint), `policy.json` (the signed
//!   policy), `daily.json` (signer-core's net per UTC day), `reference-prices.json` (USD pegs in
//!   sats, rewritten every minute), `journal.json` (what the signer answered), `signer-wallet/`
//!   (rgb-lib's wallet that signs; it needs the RGB state of what it sells, see the policy screen)

pub mod biometric;
pub mod journal;
pub mod policy;
pub mod store;
pub mod tenant;
pub mod wallet;

use std::path::PathBuf;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use nostr_sdk::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::p2p::{P2pProcess, P2pStartRequest};
use crate::{p2p_networks, secret_store};

use journal::{Journal, JournalData};
use policy::{SignedPolicy, SigningPolicy};
use tenant::Endpoint;

/// Where the maker signer may run: Mutinynet, and regtest for development.
pub fn network_allowed(network: &str) -> bool {
    matches!(network, "signetcustom" | "regtest")
}

/// What the app knows about a network the page named.
struct Net {
    /// The daemon's name (`signetcustom`).
    network: String,
    relays: Vec<String>,
    indexer_url: String,
}

fn net(network_key: &str) -> Result<Net, String> {
    let cfg = p2p_networks::resolve(P2pStartRequest {
        account: "maker".into(),
        network_key: network_key.into(),
        seed_mnemonic: None,
        rescan: false,
    })?;
    if !network_allowed(&cfg.network) {
        return Err(format!("maker mode is not available on {}", cfg.network));
    }
    Ok(Net {
        network: cfg.network,
        relays: cfg.relays,
        indexer_url: cfg.indexer_url,
    })
}

fn dir(app: &AppHandle, network: &str) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?
        .join("maker")
        .join(network))
}

// ─── keys ───────────────────────────────────────────────────────────────────

/// The signer's secrets: the maker wallet's recovery phrase and the signer's Nostr key.
#[derive(Serialize, Deserialize)]
struct Secrets {
    mnemonic: String,
    nostr_secret: String,
}

/// The signer's secrets for `network`, made on first use and kept in the OS keychain.
fn secrets(network: &str) -> Result<Secrets, String> {
    let name = format!("maker-signer-{network}");
    if let Some(raw) = secret_store::get(&name)? {
        return serde_json::from_str(&raw).map_err(|_| "the stored signer keys are damaged".into());
    }
    let btc = rgb_lib::BitcoinNetwork::from_str(network).map_err(|e| e.to_string())?;
    let keys = rgb_lib::generate_keys(btc, rgb_lib::keys::WitnessVersion::Taproot);
    let s = Secrets {
        mnemonic: keys.mnemonic,
        nostr_secret: Keys::generate().secret_key().to_secret_hex(),
    };
    secret_store::set(
        &name,
        &serde_json::to_string(&s).map_err(|e| e.to_string())?,
    )?;
    Ok(s)
}

fn nostr_keys(s: &Secrets) -> Result<Keys, String> {
    Keys::parse(&s.nostr_secret).map_err(|_| "the stored signer key is damaged".into())
}

fn wallet_keys(network: &str, s: &Secrets) -> Result<rgb_lib::keys::Keys, String> {
    let btc = rgb_lib::BitcoinNetwork::from_str(network).map_err(|e| e.to_string())?;
    rgb_lib::restore_keys(
        btc,
        s.mnemonic.clone(),
        rgb_lib::keys::WitnessVersion::Taproot,
    )
    .map_err(|e| e.to_string())
}

fn token_name(network: &str) -> String {
    format!("maker-token-{network}")
}

// ─── configuration ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    /// KaleidoSwap runs the maker; this app signs.
    Hosted,
    /// The user's own p2pd quotes and signs by itself.
    SelfHosted,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct Config {
    mode: Option<Mode>,
    /// The maker's API. Self-hosted without one means this app's own trading wallet.
    endpoint: Option<Endpoint>,
    /// The user wants the signer on whenever the app is open.
    #[serde(default)]
    signer_enabled: bool,
}

fn config(app: &AppHandle, network: &str) -> Result<Config, String> {
    Ok(store::read(&dir(app, network)?.join("config.json"))?.unwrap_or_default())
}

fn save_config(app: &AppHandle, network: &str, c: &Config) -> Result<(), String> {
    store::write(&dir(app, network)?.join("config.json"), c)
}

fn load_policy(app: &AppHandle, network: &str) -> Result<Option<SignedPolicy>, String> {
    store::read(&dir(app, network)?.join("policy.json"))
}

// ─── the running signer ─────────────────────────────────────────────────────

struct Running {
    network: String,
    handle: signer_core::SignerHandle,
    /// The journal writer (reads `handle.answers()`) and, for USD pegs, the reference price writer.
    tasks: Vec<tauri::async_runtime::JoinHandle<()>>,
    started_at: u64,
}

impl Running {
    async fn stop(self) {
        for t in self.tasks {
            t.abort();
        }
        self.handle.shutdown().await;
    }
}

#[derive(Default)]
pub struct MakerSigner {
    running: tokio::sync::Mutex<Option<Running>>,
    /// Why the last start failed, for the Live screen.
    last_error: Mutex<Option<String>>,
    /// The signer wallet while the launch screens use it; the signer takes it when it starts.
    wallet: tokio::sync::Mutex<Option<wallet::OpenWallet>>,
}

#[derive(Debug, Serialize)]
pub struct SignerView {
    running: bool,
    started_at: Option<u64>,
    relays: usize,
    signed: u64,
    refused: u64,
    error: Option<String>,
}

/// Everything the maker screens show, without any secret.
#[derive(Debug, Serialize)]
pub struct MakerView {
    network: String,
    mode: Option<Mode>,
    endpoint: Option<Endpoint>,
    has_token: bool,
    signer_npub: String,
    signer_enabled: bool,
    policy: Option<SignedPolicy>,
    /// Set when `policy.json` exists but does not verify: the signer will not run it.
    policy_error: Option<String>,
    signer: SignerView,
    /// Touch ID (or the OS's device-owner prompt) guards policy signing on this system.
    biometric: bool,
}

async fn view(
    app: &AppHandle,
    signer: &MakerSigner,
    network_key: &str,
) -> Result<MakerView, String> {
    let n = net(network_key)?;
    let network = n.network.clone();
    let s = tauri::async_runtime::spawn_blocking(move || secrets(&network))
        .await
        .map_err(|e| e.to_string())??;
    let keys = nostr_keys(&s)?;
    let c = config(app, &n.network)?;
    let has_token = secret_store::get(&token_name(&n.network))?.is_some();
    let (policy, policy_error) = match load_policy(app, &n.network) {
        Ok(Some(p)) => {
            let err = p.verify(&keys.public_key()).err();
            (Some(p), err)
        }
        Ok(None) => (None, None),
        Err(e) => (None, Some(e)),
    };
    let running = signer.running.lock().await;
    let mut sv = SignerView {
        running: false,
        started_at: None,
        relays: n.relays.len(),
        signed: 0,
        refused: 0,
        error: signer
            .last_error
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clone(),
    };
    if let Some(r) = running.as_ref().filter(|r| r.network == n.network) {
        use std::sync::atomic::Ordering::Relaxed;
        sv.running = true;
        sv.started_at = Some(r.started_at);
        sv.signed = r.handle.stats.signed.load(Relaxed);
        sv.refused = r.handle.stats.refused.load(Relaxed);
    }
    Ok(MakerView {
        network: n.network,
        mode: c.mode,
        endpoint: c.endpoint,
        has_token,
        signer_npub: keys.public_key().to_bech32().unwrap_or_default(),
        signer_enabled: c.signer_enabled,
        policy,
        policy_error,
        signer: sv,
        biometric: cfg!(target_os = "macos"),
    })
}

/// BTC/USD from two exchanges; refused when they disagree by more than 1.5 %.
pub async fn fetch_btc_usd() -> Result<f64, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let kraken = async {
        let v: serde_json::Value = client
            .get("https://api.kraken.com/0/public/Ticker?pair=XBTUSD")
            .send()
            .await
            .ok()?
            .json()
            .await
            .ok()?;
        v["result"]["XXBTZUSD"]["c"][0]
            .as_str()?
            .parse::<f64>()
            .ok()
    };
    let coinbase = async {
        let v: serde_json::Value = client
            .get("https://api.coinbase.com/v2/prices/BTC-USD/spot")
            .send()
            .await
            .ok()?
            .json()
            .await
            .ok()?;
        v["data"]["amount"].as_str()?.parse::<f64>().ok()
    };
    let (a, b) = tokio::join!(kraken, coinbase);
    combine_prices(
        &[a, b]
            .into_iter()
            .flatten()
            .filter(|p| p.is_finite() && *p > 0.0)
            .collect::<Vec<_>>(),
    )
}

fn combine_prices(prices: &[f64]) -> Result<f64, String> {
    match prices {
        [] => Err("no BTC/USD price could be read".into()),
        [p] => Ok(*p),
        _ => {
            let lo = prices.iter().copied().fold(f64::INFINITY, f64::min);
            let hi = prices.iter().copied().fold(0.0, f64::max);
            if (hi - lo) / lo > 0.015 {
                return Err(format!("BTC/USD sources disagree ({lo:.0} to {hi:.0})"));
            }
            Ok(prices.iter().sum::<f64>() / prices.len() as f64)
        }
    }
}

async fn start(app: &AppHandle, signer: &MakerSigner, network_key: &str) -> Result<(), String> {
    let n = net(network_key)?;
    let mut running = signer.running.lock().await;
    if running.as_ref().is_some_and(|r| r.network == n.network) {
        return Ok(());
    }
    if let Some(r) = running.take() {
        r.stop().await;
    }
    let c = config(app, &n.network)?;
    if c.mode != Some(Mode::Hosted) {
        return Err("the signer is for a hosted maker".into());
    }
    let endpoint = c.endpoint.ok_or("pair with your hosted maker first")?;
    let maker = PublicKey::parse(&endpoint.maker_npub).map_err(|e| e.to_string())?;
    let network = n.network.clone();
    let s = tauri::async_runtime::spawn_blocking(move || secrets(&network))
        .await
        .map_err(|e| e.to_string())??;
    let keys = nostr_keys(&s)?;
    let signed = load_policy(app, &n.network)?.ok_or("sign a policy first")?;
    signed.verify(&keys.public_key())?;
    if signed.policy.maker_npub != endpoint.maker_npub {
        return Err("the signed policy is for another maker: sign it again".into());
    }
    if signed.policy.network != n.network {
        return Err("the signed policy is for another network".into());
    }

    // rgb-lib's wallet, which signs: the one the launch screens opened, or opened here off the
    // async workers
    let base = dir(app, &n.network)?;
    let open = match signer
        .wallet
        .lock()
        .await
        .take()
        .filter(|w| w.network == n.network)
    {
        Some(w) => w,
        None => {
            let (network, indexer) = (n.network.clone(), n.indexer_url.clone());
            let wallet_dir = base.join("signer-wallet");
            tauri::async_runtime::spawn_blocking(move || {
                wallet::open(&network, &indexer, &wallet_dir, &s)
            })
            .await
            .map_err(|e| e.to_string())??
        }
    };
    let (wallet, online) = (open.wallet, open.online);

    let journal = Journal::open(base.join("journal.json"));
    // USD pegs: signer-core reads a price file, which the app writes from its own BTC/USD reading;
    // a file not rewritten for MAX_PRICE_AGE_SECS refuses those markets. A file left from an earlier
    // policy (another peg) must never be read under this one, so it goes before the signer starts:
    // until the first fresh reading is written, USD-pegged swaps are refused.
    let prices_path = base.join("reference-prices.json");
    match std::fs::remove_file(&prices_path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(format!("could not clear the old reference prices: {e}")),
    }
    let pegs = signed.policy.usd_pegs();
    let client_policy = Arc::new(signer_core::ClientPolicy::new(
        signed.policy.to_config(&prices_path),
        Some(base.join("daily.json")),
    )?);
    let handle = signer_core::service::start(
        keys.clone(),
        maker,
        &n.relays,
        client_policy,
        wallet,
        online,
    )
    .await?;
    // the background tasks start only once the signer runs, so a failed start leaves none behind
    let mut tasks = Vec::new();
    if !pegs.is_empty() {
        let path = prices_path.clone();
        tasks.push(tauri::async_runtime::spawn(async move {
            loop {
                match fetch_btc_usd().await {
                    Ok(usd) => {
                        if let Err(e) = store::write(&path, &policy::reference_prices(&pegs, usd)) {
                            log::warn!("[maker] reference prices: {e}");
                        }
                    }
                    Err(e) => log::warn!("[maker] reference price: {e}"),
                }
                tokio::time::sleep(Duration::from_secs(60)).await;
            }
        }));
    }
    let mut answers = handle.answers();
    tasks.push(tauri::async_runtime::spawn(async move {
        use tokio::sync::broadcast::error::RecvError;
        loop {
            match answers.recv().await {
                Ok(a) => journal.record(&a, Timestamp::now().as_secs()),
                Err(RecvError::Lagged(n)) => log::warn!("[maker] journal skipped {n} answers"),
                Err(RecvError::Closed) => break,
            }
        }
    }));
    log::info!(
        "[maker] signer answering {} on {}",
        endpoint.maker_npub,
        n.network
    );
    *running = Some(Running {
        network: n.network,
        handle,
        tasks,
        started_at: Timestamp::now().as_secs(),
    });
    Ok(())
}

async fn stop(signer: &MakerSigner) {
    if let Some(r) = signer.running.lock().await.take() {
        r.stop().await;
    }
}

// ─── commands ───────────────────────────────────────────────────────────────

type Signer<'a> = State<'a, Arc<MakerSigner>>;

#[tauri::command]
pub async fn maker_view(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
) -> Result<MakerView, String> {
    view(&app, &signer, &network_key).await
}

#[tauri::command]
pub async fn maker_set_mode(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
    mode: Option<Mode>,
) -> Result<MakerView, String> {
    let n = net(&network_key)?;
    let mut c = config(&app, &n.network)?;
    if c.mode != mode {
        stop(&signer).await;
        // a maker of one kind is not the maker of the other
        c = Config {
            mode,
            ..Config::default()
        };
        secret_store::delete(&token_name(&n.network))?;
        save_config(&app, &n.network, &c)?;
    }
    view(&app, &signer, &network_key).await
}

/// Pair with a maker: a pairing code from KaleidoSwap, or (developers, self-hosting) its address,
/// API token and key typed in. Self-hosted with none of them uses this app's trading wallet.
#[tauri::command]
pub async fn maker_pair(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
    code: Option<String>,
    endpoint: Option<Endpoint>,
    token: Option<String>,
) -> Result<MakerView, String> {
    let n = net(&network_key)?;
    let mut c = config(&app, &n.network)?;
    let mode = c.mode.ok_or("choose how to run the maker first")?;
    let paired = match (code, endpoint, token) {
        (Some(code), None, None) => Some(tenant::parse_code(&code, &n.network)?),
        (None, Some(e), Some(t)) => {
            tenant::check(&e, &t, mode == Mode::Hosted)?;
            Some((e, t))
        }
        (None, None, None) if mode == Mode::SelfHosted => None,
        _ => return Err("give a pairing code, or the maker's address, token and key".into()),
    };
    if mode == Mode::Hosted && paired.is_none() {
        return Err("a hosted maker needs its pairing code".into());
    }
    stop(&signer).await;
    match &paired {
        Some((_, t)) => secret_store::set(&token_name(&n.network), t)?,
        None => secret_store::delete(&token_name(&n.network))?,
    }
    c.endpoint = paired.map(|(e, _)| e);
    save_config(&app, &n.network, &c)?;
    view(&app, &signer, &network_key).await
}

/// The code the client sends KaleidoSwap to have its hosted maker set up: the signer's key and
/// the wallet's public keys.
#[tauri::command]
pub async fn maker_pairing_request(network_key: String) -> Result<String, String> {
    let n = net(&network_key)?;
    tauri::async_runtime::spawn_blocking(move || {
        let s = secrets(&n.network)?;
        let keys = nostr_keys(&s)?;
        Ok(tenant::pairing_request(
            &n.network,
            &keys.public_key(),
            &wallet_keys(&n.network, &s)?,
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Call the maker's API: the paired endpoint, or this app's trading wallet when self-hosting
/// without one.
#[tauri::command]
pub async fn maker_api(
    app: AppHandle,
    p2p: State<'_, Arc<P2pProcess>>,
    network_key: String,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let n = net(&network_key)?;
    let c = config(&app, &n.network)?;
    match (c.mode, c.endpoint) {
        (None, _) => Err("choose how to run the maker first".into()),
        (Some(_), Some(e)) => {
            let token = secret_store::get(&token_name(&n.network))?
                .ok_or("the maker's API token is missing: pair again")?;
            tenant::request(&e, &token, &method, &path, body).await
        }
        (Some(Mode::SelfHosted), None) => {
            if !tenant::route_allowed(&method, &path) {
                return Err(format!("{method} {path} is not available from the app"));
            }
            let p2p = Arc::clone(&*p2p);
            tauri::async_runtime::spawn_blocking(move || p2p.request(&method, &path, body))
                .await
                .map_err(|e| e.to_string())?
        }
        (Some(Mode::Hosted), None) => Err("pair with your hosted maker first".into()),
    }
}

/// Sign `policy` with the signer's key, after Touch ID where the OS has it, and put it in force.
#[tauri::command]
pub async fn maker_sign_policy(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
    policy: SigningPolicy,
) -> Result<MakerView, String> {
    let n = net(&network_key)?;
    let c = config(&app, &n.network)?;
    let endpoint = c
        .endpoint
        .filter(|_| c.mode == Some(Mode::Hosted))
        .ok_or("pair with your hosted maker first")?;
    if policy.network != n.network {
        return Err(format!(
            "the policy names {}, not {}",
            policy.network, n.network
        ));
    }
    if policy.maker_npub != endpoint.maker_npub {
        return Err("the policy names another maker".into());
    }
    policy.validate()?;
    let network = n.network.clone();
    let signed = tauri::async_runtime::spawn_blocking(move || {
        biometric::authenticate("sign the trading policy for your hosted maker")?;
        let keys = nostr_keys(&secrets(&network)?)?;
        SignedPolicy::sign(policy, &keys, Timestamp::now().as_secs())
    })
    .await
    .map_err(|e| e.to_string())??;
    store::write(&dir(&app, &n.network)?.join("policy.json"), &signed)?;
    // a running signer holds the old policy: restart it on the new one
    let was_running = signer.running.lock().await.is_some();
    if was_running {
        stop(&signer).await;
        if let Err(e) = start(&app, &signer, &network_key).await {
            *signer
                .last_error
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(e);
        }
    }
    view(&app, &signer, &network_key).await
}

#[tauri::command]
pub async fn maker_signer_start(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
) -> Result<MakerView, String> {
    let n = net(&network_key)?;
    let result = start(&app, &signer, &network_key).await;
    *signer
        .last_error
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = result.clone().err();
    if result.is_ok() {
        let mut c = config(&app, &n.network)?;
        c.signer_enabled = true;
        save_config(&app, &n.network, &c)?;
    }
    result?;
    view(&app, &signer, &network_key).await
}

#[tauri::command]
pub async fn maker_signer_stop(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
) -> Result<MakerView, String> {
    let n = net(&network_key)?;
    stop(&signer).await;
    let mut c = config(&app, &n.network)?;
    c.signer_enabled = false;
    save_config(&app, &n.network, &c)?;
    view(&app, &signer, &network_key).await
}

// ─── the signer wallet: launch a token ──────────────────────────────────────

/// Run `f` on the signer wallet, opened once and kept for the next call. Refused while the signer
/// runs: it holds the same wallet, and rgb-lib wants one user per wallet directory.
async fn with_wallet<T: Send + 'static>(
    app: &AppHandle,
    signer: &MakerSigner,
    network_key: &str,
    f: impl FnOnce(&mut wallet::OpenWallet) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    let n = net(network_key)?;
    if signer
        .running
        .lock()
        .await
        .as_ref()
        .is_some_and(|r| r.network == n.network)
    {
        return Err("the signer is using the wallet: stop it on the Live screen first".into());
    }
    let mut slot = signer.wallet.lock().await;
    let mut open = match slot.take().filter(|w| w.network == n.network) {
        Some(w) => w,
        None => {
            let wallet_dir = dir(app, &n.network)?.join("signer-wallet");
            let (network, indexer) = (n.network.clone(), n.indexer_url.clone());
            tauri::async_runtime::spawn_blocking(move || {
                let s = secrets(&network)?;
                wallet::open(&network, &indexer, &wallet_dir, &s)
            })
            .await
            .map_err(|e| e.to_string())??
        }
    };
    let (res, open) = tauri::async_runtime::spawn_blocking(move || {
        let r = f(&mut open);
        (r, open)
    })
    .await
    .map_err(|e| e.to_string())?;
    *slot = Some(open);
    res
}

#[tauri::command]
pub async fn maker_wallet(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
) -> Result<wallet::WalletView, String> {
    with_wallet(&app, &signer, &network_key, wallet::view).await
}

/// A fresh address of the signer wallet, to fund it.
#[tauri::command]
pub async fn maker_wallet_address(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
) -> Result<String, String> {
    with_wallet(&app, &signer, &network_key, |w| {
        w.wallet.get_address().map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn maker_wallet_create_coins(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
    num: u8,
    size: u32,
    fee_rate: u64,
) -> Result<u8, String> {
    with_wallet(&app, &signer, &network_key, move |w| {
        wallet::create_coins(w, num, size, fee_rate)
    })
    .await
}

/// Mint an asset into the signer wallet. Returns its asset id.
#[tauri::command]
pub async fn maker_wallet_mint(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
    mint: wallet::Mint,
) -> Result<String, String> {
    mint.check()?;
    with_wallet(&app, &signer, &network_key, move |w| wallet::mint(w, &mint)).await
}

/// How the wallet state reached the hosted maker.
#[derive(Debug, Serialize)]
pub struct StateHandoff {
    pub uploaded: bool,
    /// The encrypted backup, kept when it could not be uploaded.
    pub file: Option<String>,
    /// Its password, for handing it over by hand. Unlocks the state only, no key.
    pub password: Option<String>,
    pub detail: Option<String>,
}

/// Give the hosted maker this wallet's RGB state (an encrypted rgb-lib backup), so the watch-only
/// maker knows what it holds and can sell it. When the maker has no import yet, the file and its
/// password are kept for the user to hand over.
#[tauri::command]
pub async fn maker_send_state(
    app: AppHandle,
    signer: Signer<'_>,
    network_key: String,
) -> Result<StateHandoff, String> {
    let n = net(&network_key)?;
    let c = config(&app, &n.network)?;
    let endpoint = c
        .endpoint
        .filter(|_| c.mode == Some(Mode::Hosted))
        .ok_or("pair with your hosted maker first")?;
    let token = secret_store::get(&token_name(&n.network))?
        .ok_or("the maker's API token is missing: pair again")?;
    let path = dir(&app, &n.network)?
        .join("exports")
        .join(format!("state-{}.rgb", Timestamp::now().as_secs()));
    let password = crate::p2p::new_token();
    {
        let (path, password) = (path.clone(), password.clone());
        with_wallet(&app, &signer, &network_key, move |w| {
            wallet::backup(w, &path, &password)
        })
        .await?;
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let body = serde_json::json!({
        "backup_b64": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes),
        "password": password,
    });
    match tenant::request(&endpoint, &token, "POST", tenant::STATE_ROUTE, Some(body)).await {
        Ok(_) => {
            let _ = std::fs::remove_file(&path);
            Ok(StateHandoff {
                uploaded: true,
                file: None,
                password: None,
                detail: None,
            })
        }
        Err(e) => Ok(StateHandoff {
            uploaded: false,
            file: Some(path.to_string_lossy().into_owned()),
            password: Some(password),
            detail: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn maker_journal(app: AppHandle, network_key: String) -> Result<JournalData, String> {
    let n = net(&network_key)?;
    Ok(Journal::open(dir(&app, &n.network)?.join("journal.json")).snapshot())
}

/// The signer's own BTC/USD reading, for showing a USD peg's reference in sats.
#[tauri::command]
pub async fn maker_btc_usd() -> Result<f64, String> {
    fetch_btc_usd().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maker_mode_is_for_mutinynet_and_regtest_only() {
        assert!(network_allowed("signetcustom"));
        assert!(network_allowed("regtest"));
        for n in ["mainnet", "bitcoin", "testnet", "signet", ""] {
            assert!(!network_allowed(n), "{n}");
        }
        assert!(net("SignetCustom").is_ok());
        assert!(net("Mainnet").is_err());
    }

    #[test]
    fn exchange_prices_that_disagree_are_not_used() {
        assert_eq!(combine_prices(&[100_000.0]), Ok(100_000.0));
        assert_eq!(combine_prices(&[100_000.0, 101_000.0]), Ok(100_500.0));
        assert!(combine_prices(&[100_000.0, 102_000.0]).is_err());
        assert!(combine_prices(&[]).is_err());
    }
}
