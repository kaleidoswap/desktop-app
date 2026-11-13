//! The client's signing policy, as the app keeps it: written in the app, signed with the signer's
//! own key (after Touch ID where the OS has it), and run by `signer-core`'s [`ClientPolicy`].
//!
//! The checks themselves are signer-core's (`docs/REMOTE-SIGNER.md` in the p2pd repository): they
//! run on the terms worked out from the PSBT and the client's own wallet, never on the maker's
//! word. What the app adds is the envelope around them: the policy is tied to one maker and one
//! network, signed so that a policy file changed behind the app's back is not run, and a USD peg
//! reference that the app turns into a price file of its own (signer-core reads a fixed price or
//! a file).
//!
//! [`ClientPolicy`]: signer_core::ClientPolicy

use std::collections::BTreeMap;
use std::path::Path;

use nostr_sdk::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use signer_core::{AssetRule, PolicyConfig};

/// Domain separation for the policy signature: a signature over anything else never verifies.
const SIGNING_TAG: &[u8] = b"kaleidoswap/maker-signing-policy/v1\n";
/// A USD-pegged reference written longer ago than this is refused by the signer.
pub const MAX_PRICE_AGE_SECS: u64 = 300;

/// Where a market's reference price comes from: the client's own, never the maker's.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Reference {
    /// A price the client sets, in sats per whole unit (an issuer-set price).
    Fixed { sat_per_unit: f64 },
    /// A USD-pegged asset: `usd_per_unit` USD, converted with the signer's own BTC/USD reading.
    UsdPeg { usd_per_unit: f64 },
}

/// What the signer accepts for one asset.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MarketRule {
    pub asset_id: String,
    /// For display only.
    #[serde(default)]
    pub ticker: Option<String>,
    /// Decimals of the asset: amounts are in base units, prices per whole unit.
    pub precision: u8,
    /// The client may sell the asset for BTC.
    pub sell: bool,
    /// The client may buy the asset with BTC. Off unless the client trusts its host: the signer
    /// cannot yet check that the asset a purchase delivers is valid (see REMOTE-SIGNER.md).
    pub buy: bool,
    pub reference: Reference,
    /// How far a swap may be priced against the client: below the reference when selling, above it
    /// when buying. Better prices are always accepted.
    pub band_bps: u32,
    /// Most asset base units in one swap.
    pub max_swap_units: u64,
    /// Most sats in one swap, if set.
    #[serde(default)]
    pub max_swap_sat: Option<u64>,
    /// Most the day's signed swaps may move the asset holding, either way (UTC day).
    pub max_daily_net_units: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SigningPolicy {
    pub version: u8,
    /// The daemon's name for the network (`signetcustom` for Mutinynet).
    pub network: String,
    /// The maker this policy is for.
    pub maker_npub: String,
    pub markets: Vec<MarketRule>,
}

impl SigningPolicy {
    pub fn validate(&self) -> Result<(), String> {
        if self.version != 1 {
            return Err(format!("policy version {} is not supported", self.version));
        }
        if !super::network_allowed(&self.network) {
            return Err(format!("the maker signer does not run on {}", self.network));
        }
        PublicKey::parse(&self.maker_npub).map_err(|e| format!("maker key: {e}"))?;
        if self.markets.is_empty() {
            return Err("the policy allows no market".into());
        }
        for m in &self.markets {
            let bad = |why: &str| Err(format!("{}: {why}", m.asset_id));
            if !m.asset_id.starts_with("rgb:") || m.asset_id.len() > 128 {
                return bad("not an RGB contract id");
            }
            if m.precision > 18 {
                return bad("precision is at most 18");
            }
            if !m.sell && !m.buy {
                return bad("allows neither selling nor buying");
            }
            if m.band_bps == 0 || m.band_bps > 5_000 {
                return bad("the price band must be between 0.01% and 50%");
            }
            if m.max_swap_units == 0 || m.max_swap_sat == Some(0) {
                return bad("the most per swap must be above zero");
            }
            let price = match m.reference {
                Reference::Fixed { sat_per_unit } => sat_per_unit,
                Reference::UsdPeg { usd_per_unit } => usd_per_unit,
            };
            if !price.is_finite() || price <= 0.0 {
                return bad("the reference price must be above zero");
            }
        }
        // the rest (duplicates, band) is signer-core's own check
        self.to_config(Path::new("reference-prices.json"))
            .validate()
    }

    /// signer-core's policy for these rules. A USD peg reads `prices`, the file the app keeps up
    /// to date from its own BTC/USD reading ([`reference_prices`]).
    pub fn to_config(&self, prices: &Path) -> PolicyConfig {
        PolicyConfig {
            assets: self
                .markets
                .iter()
                .map(|m| AssetRule {
                    asset_id: m.asset_id.clone(),
                    precision: m.precision,
                    sell: m.sell,
                    buy: m.buy,
                    reference: match m.reference {
                        Reference::Fixed { sat_per_unit } => {
                            signer_core::Reference::Fixed { sat_per_unit }
                        }
                        Reference::UsdPeg { .. } => signer_core::Reference::File {
                            path: prices.to_path_buf(),
                            max_age_secs: Some(MAX_PRICE_AGE_SECS),
                        },
                    },
                    band_bps: u64::from(m.band_bps),
                    max_asset_per_swap: Some(m.max_swap_units),
                    max_sat_per_swap: m.max_swap_sat,
                    max_daily_net: Some(m.max_daily_net_units),
                })
                .collect(),
        }
    }

    /// The USD-pegged markets, if any: they need the app's price file kept fresh.
    pub fn usd_pegs(&self) -> Vec<(String, f64)> {
        self.markets
            .iter()
            .filter_map(|m| match m.reference {
                Reference::UsdPeg { usd_per_unit } => Some((m.asset_id.clone(), usd_per_unit)),
                Reference::Fixed { .. } => None,
            })
            .collect()
    }

    fn digest(&self, signed_at: u64) -> Result<[u8; 32], String> {
        let body = serde_json::to_vec(self).map_err(|e| e.to_string())?;
        let mut h = Sha256::new();
        h.update(SIGNING_TAG);
        h.update(signed_at.to_string().as_bytes());
        h.update(b"\n");
        h.update(&body);
        Ok(h.finalize().into())
    }
}

/// The price file signer-core reads for USD-pegged assets: sats per whole unit at `btc_usd`.
pub fn reference_prices(pegs: &[(String, f64)], btc_usd: f64) -> BTreeMap<String, f64> {
    pegs.iter()
        .map(|(asset, usd)| (asset.clone(), usd / btc_usd * 100_000_000.0))
        .collect()
}

/// A policy with the signer key's Schnorr signature over it. The signer runs only a policy whose
/// signature verifies against its own key, so a policy file edited behind the app's back is refused.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SignedPolicy {
    pub policy: SigningPolicy,
    pub signed_at: u64,
    /// The signer's public key (hex).
    pub signer: String,
    /// Schnorr signature (hex).
    pub sig: String,
}

impl SignedPolicy {
    pub fn sign(policy: SigningPolicy, keys: &Keys, signed_at: u64) -> Result<Self, String> {
        policy.validate()?;
        let msg = secp256k1::Message::from_digest(policy.digest(signed_at)?);
        let sig = keys.sign_schnorr(&msg);
        Ok(Self {
            policy,
            signed_at,
            signer: keys.public_key().to_hex(),
            sig: sig.to_string(),
        })
    }

    /// Valid, and signed by `signer`.
    pub fn verify(&self, signer: &PublicKey) -> Result<(), String> {
        self.policy.validate()?;
        if self.signer != signer.to_hex() {
            return Err("the policy was signed by another key".into());
        }
        let sig: secp256k1::schnorr::Signature = self
            .sig
            .parse()
            .map_err(|_| "the policy signature is malformed")?;
        let msg = secp256k1::Message::from_digest(self.policy.digest(self.signed_at)?);
        let xonly = signer.xonly().map_err(|e| e.to_string())?;
        SECP256K1
            .verify_schnorr(&sig, &msg, &xonly)
            .map_err(|_| "the policy signature does not verify".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use signer_core::{ClientPolicy, Policy, Terms};

    const ASSET: &str = "rgb:usdt-test";
    const NOON: u64 = 1_794_571_200; // 2026-11-13 12:00 UTC

    fn rule() -> MarketRule {
        MarketRule {
            asset_id: ASSET.into(),
            ticker: Some("TUSD".into()),
            precision: 2,
            sell: true,
            buy: false,
            reference: Reference::Fixed {
                sat_per_unit: 1_000.0,
            },
            band_bps: 200,
            max_swap_units: 10_000,
            max_swap_sat: None,
            max_daily_net_units: 15_000,
        }
    }

    fn policy() -> SigningPolicy {
        SigningPolicy {
            version: 1,
            network: "signetcustom".into(),
            maker_npub: Keys::generate().public_key().to_bech32().unwrap(),
            markets: vec![rule()],
        }
    }

    fn terms(sells: bool, units: u64, sat: u64) -> Terms {
        Terms {
            swap_id: "s".into(),
            asset_id: ASSET.into(),
            sells,
            asset_amount: units,
            btc_amount: sat,
            expires_at: None,
        }
    }

    fn run(p: &SigningPolicy, prices: &Path) -> ClientPolicy {
        ClientPolicy::new(p.to_config(prices), None).unwrap()
    }

    #[test]
    fn the_rules_become_signer_cores_policy_and_it_decides_on_them() {
        let dir = tempfile::tempdir().unwrap();
        let cp = run(&policy(), &dir.path().join("p.json"));
        // 50.00 units at 1000 sat each
        assert_eq!(cp.check(&terms(true, 5_000, 50_000)), Ok(()));
        assert!(
            cp.check(&terms(true, 100, 970))
                .unwrap_err()
                .contains("below"),
            "3% under the reference"
        );
        assert!(
            cp.check(&terms(false, 100, 1_000))
                .unwrap_err()
                .contains("buying"),
            "buying is off"
        );
        assert!(cp
            .check(&terms(true, 10_001, 100_010))
            .unwrap_err()
            .contains("per swap"));
        let mut other = terms(true, 100, 1_000);
        other.asset_id = "rgb:other".into();
        assert!(cp.check(&other).is_err());
    }

    #[test]
    fn the_daily_cap_counts_signed_swaps() {
        let dir = tempfile::tempdir().unwrap();
        let cp = run(&policy(), &dir.path().join("p.json"));
        cp.signed(&terms(true, 10_000, 100_000));
        assert!(cp
            .check(&terms(true, 6_000, 60_000))
            .unwrap_err()
            .contains("a day"));
        assert_eq!(cp.check(&terms(true, 5_000, 50_000)), Ok(()));
    }

    #[test]
    fn a_usd_peg_reads_the_apps_own_price_file_and_refuses_without_it() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("reference-prices.json");
        let mut p = policy();
        p.markets[0].reference = Reference::UsdPeg { usd_per_unit: 1.0 };
        let cp = run(&p, &file);
        assert!(
            cp.check(&terms(true, 100, 1_000)).is_err(),
            "no price file yet"
        );
        // 1 USD at 100 000 USD/BTC is 1000 sat
        let prices = reference_prices(&p.usd_pegs(), 100_000.0);
        assert!((prices[ASSET] - 1_000.0).abs() < 1e-9);
        std::fs::write(&file, serde_json::to_vec(&prices).unwrap()).unwrap();
        assert_eq!(cp.check(&terms(true, 100, 1_000)), Ok(()));
        assert!(cp.check(&terms(true, 100, 900)).is_err());
    }

    #[test]
    fn a_signed_policy_verifies_only_unchanged_and_under_its_own_key() {
        let keys = Keys::generate();
        let signed = SignedPolicy::sign(policy(), &keys, NOON).unwrap();
        assert_eq!(signed.verify(&keys.public_key()), Ok(()));
        assert!(signed.verify(&Keys::generate().public_key()).is_err());
        let mut edited = signed.clone();
        edited.policy.markets[0].buy = true;
        assert_eq!(
            edited.verify(&keys.public_key()).unwrap_err(),
            "the policy signature does not verify"
        );
        let mut redated = signed;
        redated.signed_at += 1;
        assert!(redated.verify(&keys.public_key()).is_err());
    }

    #[test]
    fn a_policy_for_mainnet_with_nothing_allowed_or_twice_the_same_asset_is_not_signed() {
        let keys = Keys::generate();
        let mut p = policy();
        p.network = "mainnet".into();
        assert!(SignedPolicy::sign(p, &keys, NOON).is_err());
        let mut p = policy();
        p.markets[0].sell = false;
        assert!(SignedPolicy::sign(p, &keys, NOON).is_err());
        let mut p = policy();
        p.markets.push(rule());
        assert!(p.validate().unwrap_err().contains("listed twice"));
        let mut p = policy();
        p.markets[0].band_bps = 0;
        assert!(p.validate().is_err());
    }
}
