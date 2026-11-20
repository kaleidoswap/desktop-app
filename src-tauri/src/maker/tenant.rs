//! The maker's tenant API, reached from here: the strategy (`GET/PUT /api/bot`, pause and
//! resume), usage, and the read-only views the Live screen shows.
//!
//! Where the maker lives is configuration, not code: KaleidoSwap hands each client a pairing code
//! with its maker's endpoint, API token and Nostr key; a developer can type the same three for a
//! p2pd on this machine. The token stays in the OS keychain and is never handed back to the page.

use std::time::Duration;

use base64::Engine;
use nostr_sdk::prelude::*;
use serde::{Deserialize, Serialize};

/// Where a maker is and how to reach it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Endpoint {
    /// The p2pd base URL: `https://…`, or `http://` on this machine only.
    pub url: String,
    /// The maker's Nostr key: who the signer answers. Empty for a self-hosted maker, which signs
    /// by itself.
    #[serde(default)]
    pub maker_npub: String,
}

/// What KaleidoSwap gives a client to pair with its hosted maker (`kmaker1…`, base64url JSON).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct PairingCode {
    v: u8,
    network: String,
    url: String,
    token: String,
    maker_npub: String,
}

const CODE_PREFIX: &str = "kmaker1";
const REQUEST_PREFIX: &str = "ksigner1";

/// The endpoint and token in a pairing code, checked against the network it is used on.
pub fn parse_code(code: &str, network: &str) -> Result<(Endpoint, String), String> {
    let body = code
        .trim()
        .strip_prefix(CODE_PREFIX)
        .ok_or("this is not a maker pairing code")?;
    let raw = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(body)
        .map_err(|_| "the pairing code is damaged")?;
    let c: PairingCode = serde_json::from_slice(&raw).map_err(|_| "the pairing code is damaged")?;
    if c.v != 1 {
        return Err("this pairing code is for another version of the app".into());
    }
    if c.network != network {
        return Err(format!(
            "this pairing code is for {}, not {network}",
            c.network
        ));
    }
    let endpoint = Endpoint {
        url: c.url,
        maker_npub: c.maker_npub,
    };
    check(&endpoint, &c.token, true)?;
    Ok((endpoint, c.token))
}

/// A pairing code for `endpoint`, as the operator would write it (tests and tooling).
#[cfg(test)]
pub fn make_code(network: &str, endpoint: &Endpoint, token: &str) -> String {
    let json = serde_json::json!({ "v": 1, "network": network, "url": endpoint.url, "token": token, "maker_npub": endpoint.maker_npub });
    format!(
        "{CODE_PREFIX}{}",
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(json.to_string())
    )
}

/// What the client sends KaleidoSwap so the hosted maker can be set up for it: the signer's key,
/// which the maker gets as `--remote-signer`, and the wallet's public keys, from which the maker
/// opens its watch-only copy (`p2pd --watch-only-keys`, same field names). Nothing in it can spend.
pub fn pairing_request(network: &str, signer: &PublicKey, keys: &rgb_lib::keys::Keys) -> String {
    let json = serde_json::json!({
        "v": 1,
        "network": network,
        "signer_npub": signer.to_bech32().unwrap_or_default(),
        "account_xpub_vanilla": keys.account_xpub_vanilla,
        "account_xpub_colored": keys.account_xpub_colored,
        "master_fingerprint": keys.master_fingerprint,
        "witness_version": keys.witness_version,
    });
    format!(
        "{REQUEST_PREFIX}{}",
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(json.to_string())
    )
}

/// The endpoint is one the app will talk to, and the token looks like one. `needs_key`: the maker
/// signs through this app's signer, so its key must be known.
pub fn check(endpoint: &Endpoint, token: &str, needs_key: bool) -> Result<(), String> {
    let url = reqwest::Url::parse(&endpoint.url).map_err(|_| "the maker address is not a URL")?;
    let loopback = matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"));
    match url.scheme() {
        "https" => {}
        "http" if loopback => {}
        "http" => return Err("a maker on another machine must be reached over https".into()),
        _ => return Err("the maker address must start with https://".into()),
    }
    if !(url.path() == "/" || url.path().is_empty())
        || url.query().is_some()
        || !url.username().is_empty()
    {
        return Err("give the maker's base address only, without a path".into());
    }
    if token.is_empty() || token.len() > 256 || !token.chars().all(|c| c.is_ascii_graphic()) {
        return Err("the API token is not valid".into());
    }
    if needs_key || !endpoint.maker_npub.is_empty() {
        PublicKey::parse(&endpoint.maker_npub)
            .map_err(|e| format!("the maker's key is not valid: {e}"))?;
    }
    Ok(())
}

/// The tenant routes the app uses. Nothing that moves funds: the hosted maker holds no keys, and
/// this app never asks it to.
const ROUTES: &[(&str, &str)] = &[
    ("GET", "/api/info"),
    ("GET", "/api/balance"),
    ("GET", "/api/book"),
    ("GET", "/api/orders"),
    ("GET", "/api/trades"),
    ("GET", "/api/bot"),
    ("PUT", "/api/bot"),
    ("POST", "/api/bot/pause"),
    ("POST", "/api/bot/resume"),
    ("GET", "/api/usage"),
    // the signer wallet's RGB state, for a watch-only maker (encrypted rgb-lib backup, no key)
    ("POST", STATE_ROUTE),
];

/// How a 404 reads: the maker's p2pd is too old to have the route.
const NOT_OFFERED: &str = "the maker does not offer";

/// The maker answered 404 to this call: its p2pd does not have the route yet.
pub fn not_offered(error: &str) -> bool {
    error.starts_with(NOT_OFFERED)
}

/// Where the app hands the hosted maker its wallet's RGB state.
pub const STATE_ROUTE: &str = "/api/wallet/state";

/// Whether `method path` may be sent. `GET /api/usage` may carry `from` / `to` dates.
pub fn route_allowed(method: &str, path: &str) -> bool {
    let (route, query) = path.split_once('?').unwrap_or((path, ""));
    if !ROUTES.contains(&(method, route)) {
        return false;
    }
    if query.is_empty() {
        return true;
    }
    route == "/api/usage"
        && query.split('&').all(|kv| {
            matches!(kv.split_once('='), Some(("from" | "to", d)) if d.len() == 10 && d.chars().all(|c| c.is_ascii_digit() || c == '-'))
        })
}

/// Call the maker's API.
pub async fn request(
    endpoint: &Endpoint,
    token: &str,
    method: &str,
    path: &str,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    if !route_allowed(method, path) {
        return Err(format!("{method} {path} is not available from the app"));
    }
    let client = reqwest::Client::builder()
        // an import uploads the whole backup and restores it on the host
        .timeout(Duration::from_secs(if path == STATE_ROUTE {
            300
        } else {
            30
        }))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("{}{path}", endpoint.url.trim_end_matches('/'));
    let req = match method {
        "GET" => client.get(url),
        "POST" => client
            .post(url)
            .json(&body.unwrap_or(serde_json::json!({}))),
        "PUT" => client
            .put(url)
            .json(&body.unwrap_or(serde_json::Value::Null)),
        other => return Err(format!("unsupported method {other}")),
    }
    .bearer_auth(token);
    let res = req
        .send()
        .await
        .map_err(|e| format!("the maker did not answer: {e}"))?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(match status.as_u16() {
            401 => "the maker refused the API token".into(),
            404 => format!("{NOT_OFFERED} {path} yet"),
            _ if text.is_empty() => status.to_string(),
            _ => text,
        });
    }
    if text.is_empty() {
        return Ok(serde_json::Value::Null);
    }
    serde_json::from_str(&text).map_err(|e| format!("the maker sent something unreadable: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn endpoint(url: &str) -> Endpoint {
        Endpoint {
            url: url.into(),
            maker_npub: Keys::generate().public_key().to_bech32().unwrap(),
        }
    }

    #[test]
    fn only_https_or_this_machine_is_accepted() {
        assert!(check(&endpoint("https://maker-7.kaleidoswap.com"), "t0k", true).is_ok());
        assert!(check(&endpoint("http://127.0.0.1:4101"), "t0k", true).is_ok());
        assert!(check(&endpoint("http://localhost:4101/"), "t0k", true).is_ok());
        assert!(check(&endpoint("http://maker.example.com"), "t0k", true).is_err());
        assert!(check(&endpoint("ftp://maker.example.com"), "t0k", true).is_err());
        assert!(check(
            &endpoint("https://maker.example.com/api/btc/send"),
            "t0k",
            true
        )
        .is_err());
        assert!(check(&endpoint("https://maker.example.com"), "", true).is_err());
        assert!(check(&endpoint("https://maker.example.com"), "has space", true).is_err());
        let bad_key = Endpoint {
            url: "https://m.example.com".into(),
            maker_npub: "npub1nope".into(),
        };
        assert!(check(&bad_key, "t", true).is_err());
        let own = Endpoint {
            url: "http://127.0.0.1:4101".into(),
            maker_npub: String::new(),
        };
        assert!(
            check(&own, "t", false).is_ok(),
            "a self-hosted maker signs by itself: no key needed"
        );
        assert!(check(&own, "t", true).is_err());
    }

    #[test]
    fn a_pairing_code_round_trips_and_names_its_network() {
        let e = endpoint("https://maker-7.kaleidoswap.com");
        let code = make_code("signetcustom", &e, "secret-token");
        assert_eq!(
            parse_code(&code, "signetcustom"),
            Ok((e.clone(), "secret-token".into()))
        );
        assert!(parse_code(&code, "regtest")
            .unwrap_err()
            .contains("for signetcustom"));
        assert!(parse_code("kmaker1!!!", "signetcustom").is_err());
        assert!(parse_code("hello", "signetcustom").is_err());
        let plain_http = make_code("signetcustom", &endpoint("http://maker.example.com"), "t");
        assert!(parse_code(&plain_http, "signetcustom").is_err());
    }

    #[test]
    fn only_the_strategy_and_read_only_routes_are_reachable() {
        assert!(route_allowed("GET", "/api/bot"));
        assert!(route_allowed("PUT", "/api/bot"));
        assert!(route_allowed("POST", "/api/bot/pause"));
        assert!(route_allowed("POST", STATE_ROUTE));
        assert!(!route_allowed("GET", STATE_ROUTE));
        assert!(route_allowed(
            "GET",
            "/api/usage?from=2026-11-13&to=2026-11-13"
        ));
        assert!(!route_allowed("GET", "/api/usage?from=x;rm"));
        assert!(!route_allowed("GET", "/api/bot?x=1"));
        assert!(!route_allowed("POST", "/api/btc/send"));
        assert!(!route_allowed("POST", "/api/take"));
        assert!(!route_allowed("DELETE", "/api/orders/abc"));
        assert!(!route_allowed("POST", "/api/dev/fund"));
    }
}
