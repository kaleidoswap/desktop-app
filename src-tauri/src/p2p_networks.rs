//! Where the P2P market lives on each network: its relays, the esplora, the RGB proxy and the
//! address the platform fee is paid to.
//!
//! These are the app's own choices, so they are here, in the code, and not something the page can
//! pass in: the page names a network and the wallet, and this table says the rest. A page (or
//! anything that can run in it) therefore cannot point the daemon at another relay or turn the fee
//! towards another address. They are all public values (URLs, and an address that shows on chain),
//! so they are versioned and reviewed like the rest of the code.
//!
//! Development builds can point the same table somewhere else through environment variables, for a
//! relay and proxy on this machine; a release build ignores them.
//!
//! The one exception is the relay list, which the user may change. Relays only carry the public
//! offers and end-to-end encrypted messages: one can hide offers or messages, but not move funds,
//! which the esplora, the proxy and the fee address could. So those stay fixed, and the relays the
//! user picks are checked here (public `wss://` hosts, a short list) before the daemon gets them.

use std::net::IpAddr;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::p2p::{P2pStartConfig, P2pStartRequest};

struct Network {
    /// The app's name for the network, which is what the page asks for.
    key: &'static str,
    label: &'static str,
    /// What the daemon calls it.
    daemon_network: &'static str,
    relays: &'static [&'static str],
    indexer_url: &'static str,
    proxy_url: &'static str,
    fee_address: &'static str,
    fee_bps: u64,
    min_fee_sat: u64,
    /// The assets KaleidoSwap lists on this network: (asset id, ticker, name). The daemon marks
    /// their offers as listed, and offers that borrow one of these tickers as imitations.
    listing: &'static [(&'static str, &'static str, &'static str)],
}

const NETWORKS: &[Network] = &[
    Network {
        key: "SignetCustom",
        label: "Mutinynet",
        daemon_network: "signetcustom",
        // ours first, then public relays that keep offers and gift wraps (checked 2026-11)
        relays: &[
            "wss://relay.kaleidoswap.com",
            "wss://nos.lol",
            "wss://relay.primal.net",
            "wss://offchain.pub",
        ],
        indexer_url: "https://esplora.signet.kaleidoswap.com",
        proxy_url: "https://proxy.iriswallet.com/0.2/json-rpc",
        fee_address: "tb1qksue05dv7z57mezp3j74cr64lrah57vufhjktw",
        fee_bps: 100,
        min_fee_sat: 1_000,
        listing: &[
            (
                "rgb:muAGMF3g-_jZC~RV-vn6bSzV-yHQhq_T-FAoMKhG-I3~EVcw",
                "TESTUSD",
                "Mosaik Demo Dollar",
            ),
            (
                "rgb:9giqbeZi-Cs6oZhu-V9SoNP~-c90osSp-1Ebv0G5-Mv~4CY0",
                "TESTXAU",
                "Mosaik Demo Gold",
            ),
        ],
    },
    // the default public signet: a different chain from Mutinynet, indexed by our own esplora
    Network {
        key: "Signet",
        label: "Signet",
        daemon_network: "signet",
        relays: &[
            "wss://relay.kaleidoswap.com",
            "wss://nos.lol",
            "wss://relay.primal.net",
            "wss://offchain.pub",
        ],
        indexer_url: "https://esplora.signet-next.kaleidoswap.com",
        proxy_url: "https://proxy.iriswallet.com/0.2/json-rpc",
        fee_address: "tb1qksue05dv7z57mezp3j74cr64lrah57vufhjktw",
        fee_bps: 100,
        min_fee_sat: 1_000,
        listing: &[],
    },
    // the local test stack, for development only
    #[cfg(debug_assertions)]
    Network {
        key: "LocalRegtest",
        label: "Regtest",
        daemon_network: "regtest",
        relays: &["ws://127.0.0.1:7788"],
        indexer_url: "http://127.0.0.1:23502",
        proxy_url: "http://127.0.0.1:23500/json-rpc",
        fee_address: "bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080",
        fee_bps: 100,
        min_fee_sat: 1_000,
        listing: &[],
    },
];

/// What the page needs to show a network and name its wallet.
#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct NetworkInfo {
    pub key: &'static str,
    pub label: &'static str,
    /// The daemon's name for it, which names the wallet.
    pub network: &'static str,
}

pub fn list() -> Vec<NetworkInfo> {
    NETWORKS
        .iter()
        .map(|n| NetworkInfo {
            key: n.key,
            label: n.label,
            network: n.daemon_network,
        })
        .collect()
}

fn find(key: &str) -> Result<&'static Network, String> {
    NETWORKS
        .iter()
        .find(|n| n.key == key)
        .ok_or_else(|| format!("unknown network {key:?}"))
}

/// The most relays a list may hold: each is a connection kept open, and a few are enough.
pub const MAX_RELAYS: usize = 8;

/// A test network runs on this machine, so its relays may be local and plain `ws://`.
fn is_local_network(n: &Network) -> bool {
    n.daemon_network == "regtest"
}

/// Whether `host` is this machine or a private network, which a relay list must not point at.
fn private_host(host: &str) -> bool {
    let host = host
        .trim_start_matches('[')
        .trim_end_matches(']')
        .trim_end_matches('.')
        .to_ascii_lowercase();
    if host == "localhost"
        || [".localhost", ".local", ".internal", ".lan", ".home.arpa"]
            .iter()
            .any(|s| host.ends_with(s))
    {
        return true;
    }
    match host.parse::<IpAddr>() {
        Ok(IpAddr::V4(ip)) => {
            let o = ip.octets();
            ip.is_loopback()
                || ip.is_private()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_broadcast()
                || (o[0] == 100 && (o[1] & 0xc0) == 64)
        }
        Ok(IpAddr::V6(ip)) => {
            let seg = ip.segments()[0];
            ip.is_loopback()
                || ip.is_unspecified()
                || (seg & 0xfe00) == 0xfc00
                || (seg & 0xffc0) == 0xfe80
                || ip.to_ipv4_mapped().is_some()
        }
        Err(_) => false,
    }
}

/// A relay list as the daemon will get it: trimmed, each once, `wss://` public hosts (on a local
/// test network, anything `ws://` or `wss://`), between one and [`MAX_RELAYS`].
pub fn check_relays(list: &[String], local: bool) -> Result<Vec<String>, String> {
    let mut out: Vec<String> = Vec::new();
    for raw in list {
        let r = raw.trim().trim_end_matches('/');
        if r.is_empty() {
            continue;
        }
        let url = url::Url::parse(r).map_err(|_| format!("{r} is not a relay address"))?;
        match url.scheme() {
            "wss" => {}
            "ws" if local => {}
            _ => return Err(format!("{r}: a relay address starts with wss://")),
        }
        let host = url.host_str().ok_or_else(|| format!("{r} has no host"))?;
        if !url.username().is_empty() || url.password().is_some() {
            return Err(format!("{r}: a relay address cannot carry a login"));
        }
        if url.query().is_some() || url.fragment().is_some() {
            return Err(format!("{r}: a relay address has no ? or # part"));
        }
        if !local && private_host(host) {
            return Err(format!("{r} is on this computer or a private network"));
        }
        if !out.iter().any(|o| o == r) {
            out.push(r.to_string());
        }
    }
    if out.is_empty() {
        return Err("add at least one relay".into());
    }
    if out.len() > MAX_RELAYS {
        return Err(format!("at most {MAX_RELAYS} relays"));
    }
    Ok(out)
}

#[derive(Serialize)]
struct ListedAsset {
    asset_id: &'static str,
    ticker: &'static str,
    name: &'static str,
}

/// The network's listing in the daemon's `--verified-assets` format, or `None` when it lists nothing.
pub fn listing_json(key: &str) -> Option<String> {
    let n = find(key).ok()?;
    if n.listing.is_empty() {
        return None;
    }
    let list: Vec<ListedAsset> = n
        .listing
        .iter()
        .map(|&(asset_id, ticker, name)| ListedAsset {
            asset_id,
            ticker,
            name,
        })
        .collect();
    serde_json::to_string_pretty(&list).ok()
}

/// The relays of a network: the app's defaults, and the user's own list if there is one.
#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct RelaySettings {
    pub defaults: Vec<String>,
    pub custom: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize)]
struct RelayFile {
    relays: Vec<String>,
}

/// Where the user's relay list for a network is kept, under the daemon's data directory.
fn relays_file(base: &Path, n: &Network) -> PathBuf {
    base.join(format!("relays-{}.json", n.daemon_network))
}

/// The user's list for a network, if one was saved and still passes the checks.
pub fn stored_relays(base: &Path, key: &str) -> Option<Vec<String>> {
    let n = find(key).ok()?;
    let text = std::fs::read_to_string(relays_file(base, n)).ok()?;
    let file: RelayFile = serde_json::from_str(&text).ok()?;
    match check_relays(&file.relays, is_local_network(n)) {
        Ok(list) => Some(list),
        Err(e) => {
            log::warn!("[p2p] ignoring the saved relay list for {key}: {e}");
            None
        }
    }
}

pub fn relay_settings(base: &Path, key: &str) -> Result<RelaySettings, String> {
    let n = find(key)?;
    Ok(RelaySettings {
        defaults: n.relays.iter().map(|r| r.to_string()).collect(),
        custom: stored_relays(base, key),
    })
}

/// Save the user's list for a network, or with `None` go back to the app's defaults. It applies
/// from the daemon's next start.
pub fn set_relays(
    base: &Path,
    key: &str,
    relays: Option<Vec<String>>,
) -> Result<RelaySettings, String> {
    let n = find(key)?;
    let path = relays_file(base, n);
    match relays {
        None => match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(format!("{}: {e}", path.display())),
        },
        Some(list) => {
            let list = check_relays(&list, is_local_network(n))?;
            std::fs::create_dir_all(base).map_err(|e| format!("{}: {e}", base.display()))?;
            let text = serde_json::to_string_pretty(&RelayFile { relays: list })
                .map_err(|e| e.to_string())?;
            std::fs::write(&path, text).map_err(|e| format!("{}: {e}", path.display()))?;
        }
    }
    relay_settings(base, key)
}

/// The full start configuration for what the page asked for: its network and wallet, nothing else,
/// on the user's relays when they saved a list.
pub fn resolve(
    req: P2pStartRequest,
    custom_relays: Option<Vec<String>>,
) -> Result<P2pStartConfig, String> {
    let n = find(&req.network_key)?;
    let mut cfg = P2pStartConfig {
        account: req.account,
        network: n.daemon_network.into(),
        indexer_url: n.indexer_url.into(),
        proxy_url: n.proxy_url.into(),
        relays: custom_relays.unwrap_or_else(|| n.relays.iter().map(|r| r.to_string()).collect()),
        fee_address: n.fee_address.into(),
        fee_bps: n.fee_bps,
        min_fee_sat: n.min_fee_sat,
        verified_assets_path: None,
        seed_mnemonic: req.seed_mnemonic,
        rescan: req.rescan,
    };
    #[cfg(debug_assertions)]
    apply_dev_overrides(&mut cfg, |k| std::env::var(k).ok());
    Ok(cfg)
}

/// A development build can aim the table at a relay, esplora or proxy of its own.
#[cfg(any(debug_assertions, test))]
pub(crate) fn apply_dev_overrides(cfg: &mut P2pStartConfig, get: impl Fn(&str) -> Option<String>) {
    let set = |name: &str| get(name).filter(|v| !v.trim().is_empty());
    if let Some(v) = set("KALEIDO_P2P_RELAYS") {
        cfg.relays = v
            .split(',')
            .map(|r| r.trim().to_string())
            .filter(|r| !r.is_empty())
            .collect();
    }
    if let Some(v) = set("KALEIDO_P2P_ESPLORA_URL") {
        cfg.indexer_url = v;
    }
    if let Some(v) = set("KALEIDO_P2P_PROXY_URL") {
        cfg.proxy_url = v;
    }
    if let Some(v) = set("KALEIDO_P2P_FEE_ADDRESS") {
        cfg.fee_address = v;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(key: &str) -> P2pStartRequest {
        serde_json::from_value(
            serde_json::json!({ "account": "wallet-signetcustom", "network_key": key }),
        )
        .unwrap()
    }

    #[test]
    fn a_network_name_gives_the_apps_own_endpoints_and_fee_address() {
        let cfg = resolve(request("SignetCustom"), None).unwrap();
        assert_eq!(cfg.network, "signetcustom");
        assert_eq!(cfg.relays[0], "wss://relay.kaleidoswap.com");
        assert!(cfg.relays.len() > 1, "not only our own relay");
        assert_eq!(check_relays(&cfg.relays, false).unwrap(), cfg.relays);
        assert!(cfg.fee_address.starts_with("tb1q"));
        assert_eq!((cfg.fee_bps, cfg.min_fee_sat), (100, 1_000));
    }

    #[test]
    fn signet_and_mutinynet_are_two_networks() {
        let signet = resolve(request("Signet"), None).unwrap();
        let mutiny = resolve(request("SignetCustom"), None).unwrap();
        assert_eq!(signet.network, "signet");
        assert_eq!(mutiny.network, "signetcustom");
        assert_ne!(signet.indexer_url, mutiny.indexer_url);
        assert!(list()
            .iter()
            .any(|n| n.key == "Signet" && n.label == "Signet"));
    }

    #[test]
    fn mutinynet_lists_the_demo_assets_and_signet_nothing_yet() {
        let json = listing_json("SignetCustom").unwrap();
        let list: Vec<serde_json::Value> = serde_json::from_str(&json).unwrap();
        let tickers: Vec<&str> = list.iter().map(|a| a["ticker"].as_str().unwrap()).collect();
        assert_eq!(tickers, vec!["TESTUSD", "TESTXAU"]);
        assert!(list
            .iter()
            .all(|a| a["asset_id"].as_str().unwrap().starts_with("rgb:")));
        assert_eq!(listing_json("Signet"), None);
        assert_eq!(listing_json("Moon"), None);
    }

    #[test]
    fn an_unknown_network_is_refused() {
        assert!(resolve(request("Moon"), None).is_err());
    }

    #[test]
    fn the_page_cannot_send_its_own_relay_proxy_or_fee_address() {
        for field in [
            "fee_address",
            "relays",
            "proxy_url",
            "indexer_url",
            "fee_bps",
        ] {
            let mut v = serde_json::json!({ "account": "a", "network_key": "SignetCustom" });
            v[field] = serde_json::json!("x");
            assert!(
                serde_json::from_value::<P2pStartRequest>(v).is_err(),
                "{field} must be refused"
            );
        }
    }

    #[test]
    fn the_listing_has_what_the_page_needs_and_no_endpoints() {
        let l = list();
        let m = l.iter().find(|n| n.key == "SignetCustom").unwrap();
        assert_eq!((m.label, m.network), ("Mutinynet", "signetcustom"));
        assert!(!serde_json::to_string(&l).unwrap().contains("http"));
    }

    #[test]
    fn a_development_build_can_aim_the_table_elsewhere() {
        let mut cfg = resolve(
            request("SignetCustom"),
            Some(vec!["wss://a.example".into()]),
        )
        .unwrap();
        apply_dev_overrides(&mut cfg, |k| match k {
            "KALEIDO_P2P_RELAYS" => Some("ws://127.0.0.1:7788, ws://127.0.0.1:7789".into()),
            "KALEIDO_P2P_PROXY_URL" => Some("http://127.0.0.1:3000/json-rpc".into()),
            _ => None,
        });
        assert_eq!(cfg.relays.len(), 2);
        assert_eq!(cfg.proxy_url, "http://127.0.0.1:3000/json-rpc");
        assert!(cfg.indexer_url.starts_with("https://esplora."));
    }

    fn strings(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn a_saved_list_replaces_the_defaults_and_nothing_else() {
        let cfg = resolve(request("SignetCustom"), Some(strings(&["wss://a.example"]))).unwrap();
        assert_eq!(cfg.relays, strings(&["wss://a.example"]));
        assert!(cfg.indexer_url.starts_with("https://esplora."));
        assert!(cfg.fee_address.starts_with("tb1q"));
    }

    #[test]
    fn a_relay_list_is_trimmed_and_each_relay_kept_once() {
        let got = check_relays(
            &strings(&[
                " wss://a.example/ ",
                "",
                "wss://a.example",
                "wss://b.example:4443/path",
            ]),
            false,
        )
        .unwrap();
        assert_eq!(
            got,
            strings(&["wss://a.example", "wss://b.example:4443/path"])
        );
    }

    #[test]
    fn a_relay_list_takes_only_public_secure_relays() {
        for bad in [
            "ws://relay.example.com",
            "https://relay.example.com",
            "relay.example.com",
            "wss://user:pw@relay.example.com",
            "wss://relay.example.com/?x=1",
            "wss://localhost:7777",
            "wss://box.local",
            "wss://localhost.",
            "wss://127.0.0.1",
            "wss://10.0.0.5",
            "wss://192.168.1.2",
            "wss://169.254.169.254",
            "wss://[::1]",
            "wss://[fd12::1]",
        ] {
            assert!(check_relays(&strings(&[bad]), false).is_err(), "{bad}");
        }
        assert!(check_relays(&[], false).is_err());
        let many: Vec<String> = (0..=MAX_RELAYS)
            .map(|i| format!("wss://r{i}.example"))
            .collect();
        assert!(check_relays(&many, false).is_err());
        assert!(check_relays(&strings(&["ws://127.0.0.1:7788"]), true).is_ok());
    }

    #[test]
    fn the_list_is_saved_per_network_and_reset_to_the_defaults() {
        let dir = std::env::temp_dir().join(format!("p2p-relays-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let s = relay_settings(&dir, "SignetCustom").unwrap();
        assert_eq!(s.custom, None);
        assert!(set_relays(&dir, "SignetCustom", Some(strings(&["ws://x.example"]))).is_err());
        let s = set_relays(&dir, "SignetCustom", Some(strings(&["wss://a.example/"]))).unwrap();
        assert_eq!(s.custom, Some(strings(&["wss://a.example"])));
        assert_eq!(
            stored_relays(&dir, "SignetCustom"),
            Some(strings(&["wss://a.example"]))
        );
        // a file changed behind the app's back is not used
        std::fs::write(
            dir.join("relays-signetcustom.json"),
            r#"{"relays":["wss://127.0.0.1"]}"#,
        )
        .unwrap();
        assert_eq!(stored_relays(&dir, "SignetCustom"), None);
        let s = set_relays(&dir, "SignetCustom", None).unwrap();
        assert_eq!(s.custom, None);
        assert!(set_relays(&dir, "Moon", None).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
