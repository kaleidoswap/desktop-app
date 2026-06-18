//! Nostr Wallet Connect (NIP-47) wallet service.
//!
//! Runs an always-on background task (Tokio) inside the Tauri backend that:
//!   1. connects to Nostr relays,
//!   2. advertises wallet capabilities via an info event (kind 13194),
//!   3. listens for NIP-47 requests (kind 23194) from authorized client pubkeys,
//!   4. executes them against the embedded RGB Lightning Node over HTTP, and
//!   5. publishes encrypted responses (kind 23195).
//!
//! The service keypair is a random Nostr identity generated once per account
//! and persisted (independent of the wallet seed, so it works for every account
//! type — including remote-node accounts with no stored mnemonic). Each
//! connected app gets its own randomly generated client secret (handed out in
//! the `nostr+walletconnect://` URI) which the service authorizes individually
//! with per-connection method allowlists + spend budget.
//!
//! Scope (v1): BTC Lightning only — standard NIP-47 has no notion of RGB
//! assets. RGB-asset support is a possible future `kaleido_*` extension.

use nostr::nips::{nip04, nip44, nip47};
use nostr::JsonUtil;
use nostr_sdk::prelude::*;
use serde::de::DeserializeOwned;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

use crate::db;

/// Default relays used when a connection / service doesn't specify its own.
pub const DEFAULT_RELAYS: [&str; 4] = [
    "wss://relay.kaleidoswap.com",
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net",
];

/// Standard NIP-47 methods this service implements.
pub const SUPPORTED_METHODS: [&str; 7] = [
    "get_info",
    "get_balance",
    "make_invoice",
    "lookup_invoice",
    "list_transactions",
    "pay_invoice",
    "pay_keysend",
];

/// KaleidoSwap RLN extension methods (namespaced `rln_`). These ride the same
/// NWC envelope/encryption/auth but expose RGB + node features beyond standard
/// NIP-47. Each is a thin authenticated proxy to a fixed RLN endpoint; the
/// client controls only the request body, never the path.
pub const RLN_METHODS: [&str; 12] = [
    "rln_node_info",
    "rln_list_assets",
    "rln_asset_balance",
    "rln_rgb_invoice",
    "rln_ln_invoice",
    "rln_decode_rgb_invoice",
    "rln_send_asset",
    "rln_list_channels",
    "rln_get_address",
    "rln_decode_ln_invoice",
    "rln_send_btc",
    "rln_list_payments",
];

/// How long to poll RLN for a payment preimage before giving up (seconds).
const PAY_POLL_TIMEOUT_SECS: u64 = 60;

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Configuration handed to [`NwcManager::start`].
pub struct StartConfig {
    pub account_id: i32,
    /// Network label for `get_info` responses (e.g. "regtest", "signet").
    pub network: String,
    /// Base URL of the embedded RLN, e.g. `http://127.0.0.1:3001`.
    pub node_url: String,
    /// Relays the service connects to / advertises. Empty → [`DEFAULT_RELAYS`].
    pub relays: Vec<String>,
}

/// Shared context cloned into the request-handling tasks.
#[derive(Clone)]
struct ServiceCtx {
    keys: Keys,
    client: Client,
    http: reqwest::Client,
    node_url: String,
    network: String,
    account_id: i32,
    app_handle: Option<AppHandle>,
}

struct RunningService {
    client: Client,
    task: tauri::async_runtime::JoinHandle<()>,
}

/// Managed in Tauri state behind an `Arc`. Mirrors the `DcaScheduler` shape.
pub struct NwcManager {
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    inner: Arc<Mutex<Option<RunningService>>>,
    /// Service pubkey + active relays, available even to build connection URIs.
    service_pubkey: Arc<Mutex<Option<PublicKey>>>,
    relays: Arc<Mutex<Vec<String>>>,
}

impl NwcManager {
    pub fn new() -> Self {
        NwcManager {
            app_handle: Arc::new(Mutex::new(None)),
            inner: Arc::new(Mutex::new(None)),
            service_pubkey: Arc::new(Mutex::new(None)),
            relays: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.lock().unwrap() = Some(handle);
    }

    pub fn is_running(&self) -> bool {
        self.inner.lock().unwrap().is_some()
    }

    /// The bech32 npub of the running service, if any.
    pub fn service_npub(&self) -> Option<String> {
        self.service_pubkey
            .lock()
            .unwrap()
            .as_ref()
            .and_then(|pk| pk.to_bech32().ok())
    }

    /// Start the NWC service. Idempotent: a no-op if already running.
    pub async fn start(&self, cfg: StartConfig) -> Result<(), String> {
        if self.is_running() {
            return Ok(());
        }

        // Load (or generate + persist) the service keypair. It's a random Nostr
        // identity independent of the wallet seed, so this works for every
        // account type — including remote-node accounts with no stored mnemonic.
        let keys = match db::get_nwc_service_secret(cfg.account_id) {
            Ok(Some(hex)) => {
                Keys::parse(&hex).map_err(|e| format!("Stored NWC service key is invalid: {e}"))?
            }
            _ => {
                let generated = Keys::generate();
                db::set_nwc_service_secret(cfg.account_id, &generated.secret_key().to_secret_hex())
                    .map_err(|e| format!("Failed to persist NWC service key: {e}"))?;
                generated
            }
        };
        let service_pubkey = keys.public_key();

        let relays: Vec<String> = if cfg.relays.is_empty() {
            DEFAULT_RELAYS.iter().map(|s| s.to_string()).collect()
        } else {
            cfg.relays.clone()
        };

        // Build and connect the relay client (signs with the service keys).
        let client = Client::new(keys.clone());
        for relay in &relays {
            client
                .add_relay(relay)
                .await
                .map_err(|e| format!("Failed to add relay {relay}: {e}"))?;
        }
        client.connect().await;

        // Advertise capabilities (kind 13194) — standard + rln_ extensions.
        let advertised: Vec<&str> = SUPPORTED_METHODS
            .iter()
            .chain(RLN_METHODS.iter())
            .copied()
            .collect();
        let info_builder = EventBuilder::new(Kind::WalletConnectInfo, advertised.join(" ")).tag(
            Tag::custom(TagKind::custom("encryption"), ["nip44_v2 nip04"]),
        );
        if let Err(e) = client.send_event_builder(info_builder).await {
            log::warn!("[NWC] failed to publish info event: {e}");
        }

        // Subscribe to requests p-tagged to the service pubkey.
        let filter = Filter::new()
            .kind(Kind::WalletConnectRequest)
            .pubkey(service_pubkey)
            .since(Timestamp::now());
        client
            .subscribe(filter, None)
            .await
            .map_err(|e| format!("Failed to subscribe to NWC requests: {e}"))?;

        let ctx = ServiceCtx {
            keys,
            client: client.clone(),
            http: reqwest::Client::new(),
            node_url: cfg.node_url,
            network: cfg.network,
            account_id: cfg.account_id,
            app_handle: self.app_handle.lock().unwrap().clone(),
        };

        // Spawn the notification loop. Each request is handled in its own task
        // so slow payments don't block other requests.
        let relay_count = relays.len();
        let mut notifications = client.notifications();
        let task = tauri::async_runtime::spawn(async move {
            log::info!("[NWC] service listening on {relay_count} relay(s)");
            loop {
                match notifications.recv().await {
                    Ok(RelayPoolNotification::Event { event, .. }) => {
                        if event.kind == Kind::WalletConnectRequest {
                            let ctx = ctx.clone();
                            tauri::async_runtime::spawn(async move {
                                handle_request(ctx, *event).await;
                            });
                        }
                    }
                    Ok(RelayPoolNotification::Shutdown) => break,
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                        log::warn!("[NWC] notification lagged by {n}");
                    }
                    _ => {}
                }
            }
            log::info!("[NWC] service stopped");
        });

        *self.service_pubkey.lock().unwrap() = Some(service_pubkey);
        *self.relays.lock().unwrap() = relays;
        *self.inner.lock().unwrap() = Some(RunningService { client, task });
        Ok(())
    }

    /// Stop the NWC service. Safe to call when not running.
    pub async fn stop(&self) {
        let running = self.inner.lock().unwrap().take();
        *self.service_pubkey.lock().unwrap() = None;
        if let Some(running) = running {
            running.client.shutdown().await;
            running.task.abort();
        }
    }

    /// Create a new app connection and return its `nostr+walletconnect://` URI.
    /// Requires the service to be running (so the service pubkey is known).
    pub fn create_connection(
        &self,
        account_id: i32,
        name: &str,
        methods: &[String],
        budget_msat: Option<i64>,
    ) -> Result<String, String> {
        let service_pubkey = self
            .service_pubkey
            .lock()
            .unwrap()
            .ok_or_else(|| "NWC service is not running".to_string())?;
        let relays = self.relays.lock().unwrap().clone();

        // Fresh per-connection client key (the "secret" handed to the app).
        let client_keys = Keys::generate();
        let client_secret = client_keys.secret_key().clone();
        let client_pubkey = client_keys.public_key();

        let relay_urls: Vec<RelayUrl> = relays
            .iter()
            .filter_map(|r| RelayUrl::parse(r).ok())
            .collect();
        if relay_urls.is_empty() {
            return Err("No valid relays configured".to_string());
        }

        let uri = nip47::NostrWalletConnectURI::new(
            service_pubkey,
            relay_urls,
            client_secret.clone(),
            None,
        );

        let methods_json = serde_json::to_string(methods).unwrap_or_else(|_| "[]".to_string());
        let relays_json = serde_json::to_string(&relays).unwrap_or_else(|_| "[]".to_string());

        db::insert_nwc_connection(
            account_id,
            name,
            &client_pubkey.to_hex(),
            &client_secret.to_secret_hex(),
            &relays_json,
            &methods_json,
            budget_msat,
            None,
            now_secs(),
        )
        .map_err(|e| format!("Failed to store NWC connection: {e}"))?;

        Ok(uri.to_string())
    }
}

impl Default for NwcManager {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

fn err(code: nip47::ErrorCode, message: impl Into<String>) -> nip47::NIP47Error {
    nip47::NIP47Error {
        code,
        message: message.into(),
    }
}

async fn handle_request(ctx: ServiceCtx, event: Event) {
    let client_pubkey = event.pubkey;
    let client_hex = client_pubkey.to_hex();

    // Reset any spend budgets whose window has elapsed before authorizing.
    let _ = db::reset_expired_nwc_budgets(now_secs());

    // Authorize: the author must be a known, enabled connection for this account.
    let connections = match db::get_enabled_nwc_connections_for_account(ctx.account_id) {
        Ok(c) => c,
        Err(e) => {
            log::error!("[NWC] db error loading connections: {e}");
            return;
        }
    };
    let connection = match connections
        .into_iter()
        .find(|c| c.client_pubkey == client_hex)
    {
        Some(c) => c,
        // Unknown author → silently ignore (don't leak that the service exists).
        None => return,
    };

    // Decrypt the request (NIP-44 or NIP-04, auto-detected) and read its method
    // (parsed generically so we handle both standard NIP-47 and `rln_` methods).
    let (decrypted, enc) = match decrypt_content(&ctx.keys, &client_pubkey, &event.content) {
        Ok(d) => d,
        Err(e) => {
            log::warn!("[NWC] failed to decrypt request: {e}");
            return;
        }
    };
    let value: serde_json::Value = match serde_json::from_str(&decrypted) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("[NWC] failed to parse request JSON: {e}");
            return;
        }
    };
    let method_str = match value.get("method").and_then(|m| m.as_str()) {
        Some(m) => m.to_string(),
        None => {
            log::warn!("[NWC] request missing method");
            return;
        }
    };

    // Enforce the per-connection method allowlist.
    let allowed: Vec<String> = serde_json::from_str(&connection.methods_json).unwrap_or_default();
    if !allowed.iter().any(|m| m == &method_str) {
        let _ = respond_json(
            &ctx,
            &event,
            &client_pubkey,
            &method_str,
            Err(err(
                nip47::ErrorCode::Restricted,
                format!("Method '{method_str}' not permitted for this connection"),
            )),
            enc,
        )
        .await;
        return;
    }

    let now = now_secs();
    let _ = db::touch_nwc_connection(&client_hex, now);

    if method_str == "get_info" {
        // Answer get_info with raw JSON so we can advertise this connection's
        // actual allowlist — including the `rln_*` methods. The typed
        // `nip47::GetInfoResponse` (used by the standard path below) drops
        // custom method strings, which would hide RGB capability from clients
        // that detect RLN via `methods` (e.g. the rate wallet's NwcRgbAdapter).
        let result = rln_get_info_json(&ctx, &connection).await;
        emit_activity(&ctx, &connection, &method_str, result.is_ok(), now);
        let _ = respond_json(&ctx, &event, &client_pubkey, "get_info", result, enc).await;
        return;
    }

    if method_str.starts_with("rln_") {
        // KaleidoSwap RLN extension method.
        let params = value
            .get("params")
            .cloned()
            .unwrap_or(serde_json::Value::Null);
        let result = dispatch_rln(&ctx, &method_str, params).await;
        emit_activity(&ctx, &connection, &method_str, result.is_ok(), now);
        let _ = respond_json(&ctx, &event, &client_pubkey, &method_str, result, enc).await;
    } else {
        // Standard NIP-47 method.
        let request = match nip47::Request::from_value(value) {
            Ok(r) => r,
            Err(e) => {
                let _ = respond_json(
                    &ctx,
                    &event,
                    &client_pubkey,
                    &method_str,
                    Err(err(
                        nip47::ErrorCode::Other,
                        format!("Invalid request: {e}"),
                    )),
                    enc,
                )
                .await;
                return;
            }
        };
        let method = request.method;
        let result = dispatch(&ctx, &connection, request).await;
        emit_activity(&ctx, &connection, &method_str, result.is_ok(), now);
        let _ = respond(&ctx, &event, &client_pubkey, method, result, enc).await;
    }
}

/// The encryption scheme used for a request — responses mirror it so both
/// legacy NIP-04 clients and modern NIP-44 clients are supported transparently.
#[derive(Clone, Copy)]
enum Enc {
    Nip04,
    Nip44,
}

/// Decrypt a request, detecting NIP-04 vs NIP-44. NIP-04 ciphertext carries a
/// `?iv=` marker; NIP-44 does not (we still fall back to NIP-04 on failure).
fn decrypt_content(keys: &Keys, peer: &PublicKey, content: &str) -> Result<(String, Enc), String> {
    if content.contains("?iv=") {
        return nip04::decrypt(keys.secret_key(), peer, content)
            .map(|p| (p, Enc::Nip04))
            .map_err(|e| e.to_string());
    }
    match nip44::decrypt(keys.secret_key(), peer, content) {
        Ok(p) => Ok((p, Enc::Nip44)),
        Err(_) => nip04::decrypt(keys.secret_key(), peer, content)
            .map(|p| (p, Enc::Nip04))
            .map_err(|e| e.to_string()),
    }
}

/// Encrypt a response using the same scheme the client used for the request.
fn encrypt_content(
    keys: &Keys,
    peer: &PublicKey,
    plaintext: &str,
    enc: Enc,
) -> Result<String, String> {
    match enc {
        Enc::Nip04 => nip04::encrypt(keys.secret_key(), peer, plaintext).map_err(|e| e.to_string()),
        Enc::Nip44 => nip44::encrypt(keys.secret_key(), peer, plaintext, nip44::Version::V2)
            .map_err(|e| e.to_string()),
    }
}

/// Emit a `nwc:activity` event for the UI feed.
fn emit_activity(
    ctx: &ServiceCtx,
    connection: &db::NwcConnection,
    method: &str,
    ok: bool,
    now: i64,
) {
    if let Some(app) = &ctx.app_handle {
        let _ = app.emit(
            "nwc:activity",
            serde_json::json!({
                "connection_id": connection.id,
                "connection_name": connection.name,
                "method": method,
                "ok": ok,
                "timestamp": now,
            }),
        );
    }
}

/// Route a parsed request to the RLN bridge, enforcing budget for payments.
async fn dispatch(
    ctx: &ServiceCtx,
    connection: &db::NwcConnection,
    request: nip47::Request,
) -> Result<nip47::ResponseResult, nip47::NIP47Error> {
    use nip47::RequestParams::*;
    match request.params {
        GetInfo => Ok(nip47::ResponseResult::GetInfo(rln_get_info(ctx).await?)),
        GetBalance => Ok(nip47::ResponseResult::GetBalance(
            rln_get_balance(ctx).await?,
        )),
        MakeInvoice(p) => Ok(nip47::ResponseResult::MakeInvoice(
            rln_make_invoice(ctx, p).await?,
        )),
        LookupInvoice(p) => Ok(nip47::ResponseResult::LookupInvoice(
            rln_lookup_invoice(ctx, p).await?,
        )),
        ListTransactions(p) => Ok(nip47::ResponseResult::ListTransactions(
            rln_list_transactions(ctx, p).await?,
        )),
        PayInvoice(p) => {
            let resp = rln_pay_invoice(ctx, connection, p).await?;
            Ok(nip47::ResponseResult::PayInvoice(resp))
        }
        PayKeysend(p) => {
            let resp = rln_pay_keysend(ctx, connection, p).await?;
            Ok(nip47::ResponseResult::PayKeysend(resp))
        }
        _ => Err(err(
            nip47::ErrorCode::NotImplemented,
            "Method not implemented",
        )),
    }
}

/// Encrypt and publish a NIP-47 response (kind 23195).
async fn respond(
    ctx: &ServiceCtx,
    request_event: &Event,
    client_pubkey: &PublicKey,
    method: nip47::Method,
    result: Result<nip47::ResponseResult, nip47::NIP47Error>,
    enc: Enc,
) -> Result<(), String> {
    let response = match result {
        Ok(r) => nip47::Response {
            result_type: method,
            error: None,
            result: Some(r),
        },
        Err(e) => nip47::Response {
            result_type: method,
            error: Some(e),
            result: None,
        },
    };

    let content = encrypt_content(&ctx.keys, client_pubkey, &response.as_json(), enc)?;

    let builder = EventBuilder::new(Kind::WalletConnectResponse, content).tags([
        Tag::public_key(*client_pubkey),
        Tag::event(request_event.id),
    ]);

    ctx.client
        .send_event_builder(builder)
        .await
        .map_err(|e| format!("Failed to publish response: {e}"))?;
    Ok(())
}

/// Encrypt and publish a raw-JSON NIP-47 response (kind 23195). Used for the
/// `rln_` extension methods (and allowlist rejections), whose `result_type` is
/// an arbitrary method string the typed [`nip47::Response`] can't represent.
async fn respond_json(
    ctx: &ServiceCtx,
    request_event: &Event,
    client_pubkey: &PublicKey,
    result_type: &str,
    result: Result<serde_json::Value, nip47::NIP47Error>,
    enc: Enc,
) -> Result<(), String> {
    let body = match result {
        Ok(value) => serde_json::json!({ "result_type": result_type, "result": value }),
        Err(e) => serde_json::json!({
            "result_type": result_type,
            "error": serde_json::to_value(&e).unwrap_or(serde_json::Value::Null),
        }),
    };

    let content = encrypt_content(&ctx.keys, client_pubkey, &body.to_string(), enc)?;

    let builder = EventBuilder::new(Kind::WalletConnectResponse, content).tags([
        Tag::public_key(*client_pubkey),
        Tag::event(request_event.id),
    ]);

    ctx.client
        .send_event_builder(builder)
        .await
        .map_err(|e| format!("Failed to publish response: {e}"))?;
    Ok(())
}

/// Dispatch an `rln_` extension method to its fixed RLN endpoint, forwarding the
/// raw JSON body and returning the raw JSON response. The path is server-chosen
/// per method; the client only controls the body.
async fn dispatch_rln(
    ctx: &ServiceCtx,
    method: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value, nip47::NIP47Error> {
    let obj = || {
        if params.is_object() {
            params.clone()
        } else {
            serde_json::json!({})
        }
    };
    match method {
        "rln_node_info" => rln_get::<serde_json::Value>(ctx, "/nodeinfo").await,
        "rln_list_channels" => rln_get::<serde_json::Value>(ctx, "/listchannels").await,
        "rln_list_payments" => rln_get::<serde_json::Value>(ctx, "/listpayments").await,
        "rln_get_address" => rln_post::<serde_json::Value>(ctx, "/address", obj()).await,
        "rln_decode_ln_invoice" => {
            rln_post::<serde_json::Value>(ctx, "/decodelninvoice", obj()).await
        }
        "rln_send_btc" => rln_post::<serde_json::Value>(ctx, "/sendbtc", obj()).await,
        "rln_list_assets" => {
            // RLN requires `filter_asset_schemas`; default to all schemas.
            let mut body = obj();
            if body.get("filter_asset_schemas").is_none() {
                body["filter_asset_schemas"] = serde_json::json!(["Nia", "Uda", "Cfa", "Ifa"]);
            }
            rln_post::<serde_json::Value>(ctx, "/listassets", body).await
        }
        "rln_asset_balance" => rln_post::<serde_json::Value>(ctx, "/assetbalance", obj()).await,
        "rln_rgb_invoice" => rln_post::<serde_json::Value>(ctx, "/rgbinvoice", obj()).await,
        // Lightning invoice. /lninvoice accepts an optional `asset_id` + `asset_amount`
        // to mint an RGB-over-Lightning invoice (the client supplies amt_msat etc).
        "rln_ln_invoice" => rln_post::<serde_json::Value>(ctx, "/lninvoice", obj()).await,
        "rln_decode_rgb_invoice" => {
            rln_post::<serde_json::Value>(ctx, "/decodergbinvoice", obj()).await
        }
        "rln_send_asset" => rln_post::<serde_json::Value>(ctx, "/sendrgb", obj()).await,
        _ => Err(err(
            nip47::ErrorCode::NotImplemented,
            format!("Unknown method '{method}'"),
        )),
    }
}

// ---------------------------------------------------------------------------
// RLN HTTP bridge (talks to the embedded node, no auth — local loopback)
// ---------------------------------------------------------------------------

async fn rln_post<T: DeserializeOwned>(
    ctx: &ServiceCtx,
    path: &str,
    body: serde_json::Value,
) -> Result<T, nip47::NIP47Error> {
    let url = format!("{}{}", ctx.node_url, path);
    let resp = ctx.http.post(&url).json(&body).send().await.map_err(|e| {
        err(
            nip47::ErrorCode::Internal,
            format!("RLN request failed: {e}"),
        )
    })?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(err(
            nip47::ErrorCode::Internal,
            format!("RLN {path} returned {status}: {text}"),
        ));
    }
    resp.json::<T>()
        .await
        .map_err(|e| err(nip47::ErrorCode::Internal, format!("RLN decode error: {e}")))
}

async fn rln_get<T: DeserializeOwned>(
    ctx: &ServiceCtx,
    path: &str,
) -> Result<T, nip47::NIP47Error> {
    let url = format!("{}{}", ctx.node_url, path);
    let resp = ctx.http.get(&url).send().await.map_err(|e| {
        err(
            nip47::ErrorCode::Internal,
            format!("RLN request failed: {e}"),
        )
    })?;
    if !resp.status().is_success() {
        let status = resp.status();
        return Err(err(
            nip47::ErrorCode::Internal,
            format!("RLN {path} returned {status}"),
        ));
    }
    resp.json::<T>()
        .await
        .map_err(|e| err(nip47::ErrorCode::Internal, format!("RLN decode error: {e}")))
}

// --- RLN response shapes (subset we consume) ---

#[derive(serde::Deserialize)]
struct RlnNodeInfo {
    pubkey: String,
}

#[derive(serde::Deserialize, Default)]
struct RlnBtcBalanceInner {
    #[serde(default)]
    spendable: u64,
}

#[derive(serde::Deserialize)]
struct RlnBtcBalance {
    vanilla: RlnBtcBalanceInner,
}

#[derive(serde::Deserialize)]
struct RlnInvoiceResp {
    invoice: String,
}

#[derive(serde::Deserialize)]
struct RlnSendPaymentResp {
    payment_id: String,
    #[serde(default)]
    payment_hash: Option<String>,
}

#[derive(serde::Deserialize)]
struct RlnKeysendResp {
    payment_preimage: String,
    status: String,
}

#[derive(serde::Deserialize, Clone)]
struct RlnPayment {
    #[serde(default)]
    amt_msat: Option<u64>,
    payment_hash: String,
    inbound: bool,
    status: String,
    created_at: i64,
    #[serde(default)]
    preimage: Option<String>,
}

#[derive(serde::Deserialize)]
struct RlnGetPaymentResp {
    payment: RlnPayment,
}

#[derive(serde::Deserialize)]
struct RlnListPaymentsResp {
    payments: Vec<RlnPayment>,
}

#[derive(serde::Deserialize, Default)]
struct RlnDecodeInvoiceResp {
    #[serde(default)]
    amt_msat: Option<u64>,
    #[serde(default)]
    payment_hash: Option<String>,
}

// --- method implementations ---

/// Raw-JSON `get_info` that reports the connection's actual method allowlist
/// (standard NIP-47 + any enabled `rln_*` extensions). Emitted instead of the
/// typed [`rln_get_info`] so custom `rln_*` strings survive — clients use these
/// to detect RGB Lightning Node capability.
async fn rln_get_info_json(
    ctx: &ServiceCtx,
    connection: &db::NwcConnection,
) -> Result<serde_json::Value, nip47::NIP47Error> {
    let info: RlnNodeInfo = rln_get(ctx, "/nodeinfo").await?;
    let methods: Vec<String> = serde_json::from_str(&connection.methods_json).unwrap_or_default();
    Ok(serde_json::json!({
        "alias": null,
        "color": null,
        "pubkey": info.pubkey,
        "network": ctx.network,
        "block_height": null,
        "block_hash": null,
        "methods": methods,
        "notifications": [],
    }))
}

async fn rln_get_info(ctx: &ServiceCtx) -> Result<nip47::GetInfoResponse, nip47::NIP47Error> {
    let info: RlnNodeInfo = rln_get(ctx, "/nodeinfo").await?;
    let methods: Vec<nip47::Method> = SUPPORTED_METHODS
        .iter()
        .filter_map(|m| nip47::Method::from_str(m).ok())
        .collect();
    Ok(nip47::GetInfoResponse {
        alias: None,
        color: None,
        pubkey: Some(info.pubkey),
        network: Some(ctx.network.clone()),
        block_height: None,
        block_hash: None,
        methods,
        notifications: Vec::new(),
    })
}

async fn rln_get_balance(ctx: &ServiceCtx) -> Result<nip47::GetBalanceResponse, nip47::NIP47Error> {
    let bal: RlnBtcBalance =
        rln_post(ctx, "/btcbalance", serde_json::json!({"skip_sync": false})).await?;
    // NWC balance is in millisatoshis; RLN reports spendable sats.
    Ok(nip47::GetBalanceResponse {
        balance: bal.vanilla.spendable.saturating_mul(1000),
    })
}

async fn rln_make_invoice(
    ctx: &ServiceCtx,
    p: nip47::MakeInvoiceRequest,
) -> Result<nip47::MakeInvoiceResponse, nip47::NIP47Error> {
    let expiry = p.expiry.unwrap_or(3600);
    let resp: RlnInvoiceResp = rln_post(
        ctx,
        "/lninvoice",
        serde_json::json!({ "amt_msat": p.amount, "expiry_sec": expiry }),
    )
    .await?;
    Ok(nip47::MakeInvoiceResponse {
        invoice: resp.invoice,
        payment_hash: None,
        description: p.description,
        description_hash: p.description_hash,
        preimage: None,
        amount: Some(p.amount),
        created_at: Some(Timestamp::now()),
        expires_at: Some(Timestamp::from(now_secs() as u64 + expiry)),
    })
}

async fn rln_decode_invoice(ctx: &ServiceCtx, invoice: &str) -> RlnDecodeInvoiceResp {
    rln_post(
        ctx,
        "/decodelninvoice",
        serde_json::json!({ "invoice": invoice }),
    )
    .await
    .unwrap_or_default()
}

/// Shared budget gate for payment methods.
fn check_budget(connection: &db::NwcConnection, amount_msat: u64) -> Result<(), nip47::NIP47Error> {
    if let Some(budget) = connection.budget_msat {
        let remaining = budget.saturating_sub(connection.spent_msat);
        if (amount_msat as i64) > remaining {
            return Err(err(
                nip47::ErrorCode::QuotaExceeded,
                "Payment exceeds the connection's spending budget",
            ));
        }
    }
    Ok(())
}

async fn rln_pay_invoice(
    ctx: &ServiceCtx,
    connection: &db::NwcConnection,
    p: nip47::PayInvoiceRequest,
) -> Result<nip47::PayInvoiceResponse, nip47::NIP47Error> {
    // Resolve amount for budget enforcement (explicit amount, else decode).
    let amount_msat = match p.amount {
        Some(a) => Some(a),
        None => rln_decode_invoice(ctx, &p.invoice).await.amt_msat,
    };

    if connection.budget_msat.is_some() {
        let amt = amount_msat.ok_or_else(|| {
            err(
                nip47::ErrorCode::QuotaExceeded,
                "Cannot enforce budget: invoice amount unknown",
            )
        })?;
        check_budget(connection, amt)?;
    }

    let send: RlnSendPaymentResp = rln_post(
        ctx,
        "/sendpayment",
        serde_json::json!({ "invoice": p.invoice, "amt_msat": p.amount }),
    )
    .await?;

    // RLN settles asynchronously; poll for the preimage.
    let hash = send.payment_hash.unwrap_or(send.payment_id);
    let preimage = poll_payment_preimage(ctx, &hash).await?;

    // Record spend against the budget (best-effort; fees not exposed by RLN).
    if let Some(amt) = amount_msat {
        let _ = db::add_nwc_spend(&connection.client_pubkey, amt as i64, now_secs());
    }

    Ok(nip47::PayInvoiceResponse {
        preimage,
        fees_paid: None,
    })
}

async fn poll_payment_preimage(
    ctx: &ServiceCtx,
    payment_hash: &str,
) -> Result<String, nip47::NIP47Error> {
    let deadline = now_secs() + PAY_POLL_TIMEOUT_SECS as i64;
    loop {
        let resp: RlnGetPaymentResp = rln_post(
            ctx,
            "/getpayment",
            serde_json::json!({ "payment_hash": payment_hash }),
        )
        .await?;
        match resp.payment.status.as_str() {
            "Succeeded" => {
                if let Some(preimage) = resp.payment.preimage {
                    return Ok(preimage);
                }
            }
            "Failed" => {
                return Err(err(nip47::ErrorCode::PaymentFailed, "Payment failed"));
            }
            _ => {}
        }
        if now_secs() >= deadline {
            return Err(err(
                nip47::ErrorCode::PaymentFailed,
                "Timed out waiting for payment to settle",
            ));
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

async fn rln_pay_keysend(
    ctx: &ServiceCtx,
    connection: &db::NwcConnection,
    p: nip47::PayKeysendRequest,
) -> Result<nip47::PayKeysendResponse, nip47::NIP47Error> {
    check_budget(connection, p.amount)?;

    let resp: RlnKeysendResp = rln_post(
        ctx,
        "/keysend",
        serde_json::json!({ "dest_pubkey": p.pubkey, "amt_msat": p.amount }),
    )
    .await?;

    if resp.status == "Failed" {
        return Err(err(nip47::ErrorCode::PaymentFailed, "Keysend failed"));
    }

    let _ = db::add_nwc_spend(&connection.client_pubkey, p.amount as i64, now_secs());

    Ok(nip47::PayKeysendResponse {
        preimage: resp.payment_preimage,
        fees_paid: None,
    })
}

fn status_to_state(status: &str) -> Option<nip47::TransactionState> {
    match status {
        "Succeeded" => Some(nip47::TransactionState::Settled),
        "Pending" => Some(nip47::TransactionState::Pending),
        "Failed" => Some(nip47::TransactionState::Failed),
        "Expired" => Some(nip47::TransactionState::Expired),
        _ => None,
    }
}

fn payment_to_lookup(p: RlnPayment) -> nip47::LookupInvoiceResponse {
    nip47::LookupInvoiceResponse {
        transaction_type: Some(if p.inbound {
            nip47::TransactionType::Incoming
        } else {
            nip47::TransactionType::Outgoing
        }),
        state: status_to_state(&p.status),
        invoice: None,
        description: None,
        description_hash: None,
        preimage: p.preimage,
        payment_hash: p.payment_hash,
        amount: p.amt_msat.unwrap_or(0),
        fees_paid: 0,
        created_at: Timestamp::from(p.created_at.max(0) as u64),
        expires_at: None,
        settled_at: None,
        metadata: None,
    }
}

async fn rln_lookup_invoice(
    ctx: &ServiceCtx,
    p: nip47::LookupInvoiceRequest,
) -> Result<nip47::LookupInvoiceResponse, nip47::NIP47Error> {
    let hash = match (p.payment_hash, p.invoice) {
        (Some(h), _) => h,
        (None, Some(inv)) => rln_decode_invoice(ctx, &inv)
            .await
            .payment_hash
            .ok_or_else(|| err(nip47::ErrorCode::NotFound, "Could not resolve payment hash"))?,
        (None, None) => {
            return Err(err(
                nip47::ErrorCode::Other,
                "Either payment_hash or invoice is required",
            ))
        }
    };

    let resp: RlnGetPaymentResp = rln_post(
        ctx,
        "/getpayment",
        serde_json::json!({ "payment_hash": hash }),
    )
    .await
    .map_err(|_| err(nip47::ErrorCode::NotFound, "Invoice not found"))?;

    Ok(payment_to_lookup(resp.payment))
}

async fn rln_list_transactions(
    ctx: &ServiceCtx,
    p: nip47::ListTransactionsRequest,
) -> Result<Vec<nip47::LookupInvoiceResponse>, nip47::NIP47Error> {
    let resp: RlnListPaymentsResp = rln_get(ctx, "/listpayments").await?;
    let mut items: Vec<nip47::LookupInvoiceResponse> = resp
        .payments
        .into_iter()
        .filter(|pay| match p.transaction_type {
            Some(nip47::TransactionType::Incoming) => pay.inbound,
            Some(nip47::TransactionType::Outgoing) => !pay.inbound,
            None => true,
        })
        .map(payment_to_lookup)
        .collect();

    // Newest first, then apply offset/limit.
    items.sort_by_key(|i| std::cmp::Reverse(i.created_at));
    let offset = p.offset.unwrap_or(0) as usize;
    if offset < items.len() {
        items = items.split_off(offset);
    } else {
        items.clear();
    }
    if let Some(limit) = p.limit {
        items.truncate(limit as usize);
    }
    Ok(items)
}
