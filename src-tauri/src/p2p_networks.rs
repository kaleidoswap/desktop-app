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

use serde::Serialize;

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
}

const NETWORKS: &[Network] = &[
    Network {
        key: "SignetCustom",
        label: "Mutinynet",
        daemon_network: "signetcustom",
        relays: &["wss://relay.kaleidoswap.com"],
        indexer_url: "https://esplora.signet.kaleidoswap.com",
        proxy_url: "https://proxy.iriswallet.com/0.2/json-rpc",
        fee_address: "tb1qksue05dv7z57mezp3j74cr64lrah57vufhjktw",
        fee_bps: 100,
        min_fee_sat: 1_000,
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

/// The full start configuration for what the page asked for: its network and wallet, nothing else.
pub fn resolve(req: P2pStartRequest) -> Result<P2pStartConfig, String> {
    let n = NETWORKS
        .iter()
        .find(|n| n.key == req.network_key)
        .ok_or_else(|| format!("unknown network {:?}", req.network_key))?;
    let mut cfg = P2pStartConfig {
        account: req.account,
        network: n.daemon_network.into(),
        indexer_url: n.indexer_url.into(),
        proxy_url: n.proxy_url.into(),
        relays: n.relays.iter().map(|r| r.to_string()).collect(),
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
        let cfg = resolve(request("SignetCustom")).unwrap();
        assert_eq!(cfg.network, "signetcustom");
        assert_eq!(cfg.relays, vec!["wss://relay.kaleidoswap.com".to_string()]);
        assert!(cfg.fee_address.starts_with("tb1q"));
        assert_eq!((cfg.fee_bps, cfg.min_fee_sat), (100, 1_000));
    }

    #[test]
    fn an_unknown_network_is_refused() {
        assert!(resolve(request("Moon")).is_err());
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
        let mut cfg = resolve(request("SignetCustom")).unwrap();
        apply_dev_overrides(&mut cfg, |k| match k {
            "KALEIDO_P2P_RELAYS" => Some("ws://127.0.0.1:7788, ws://127.0.0.1:7789".into()),
            "KALEIDO_P2P_PROXY_URL" => Some("http://127.0.0.1:3000/json-rpc".into()),
            _ => None,
        });
        assert_eq!(cfg.relays.len(), 2);
        assert_eq!(cfg.proxy_url, "http://127.0.0.1:3000/json-rpc");
        assert!(cfg.indexer_url.starts_with("https://esplora."));
    }
}
