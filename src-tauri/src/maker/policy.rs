//! The client's signing policy: what this app's signer agrees to sign for the hosted maker.
//!
//! The policy is written in the app, signed with the signer's own key (after Touch ID where the OS
//! has it) and checked here, never by the maker. A swap outside it is refused even when the hosted
//! maker asks for it: a compromised host can at most propose swaps the policy accepts.
//!
//! The checks run on `signer_core::Terms`. Until work package 2 lands, those terms are read from
//! the offer in the request (the maker's word), not derived from the PSBT; see
//! `docs/REMOTE-SIGNER.md` in the p2pd repository. That is why the signer is Mutinynet only.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use nostr_sdk::prelude::*;
use rgb_lib::wallet::OnchainSwapLegKind;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use signer_core::{Policy, SignRequest, Terms};

use super::journal::Journal;
use super::store::JsonFile;

/// Domain separation for the policy signature: a signature over anything else never verifies.
const SIGNING_TAG: &[u8] = b"kaleidoswap/maker-signing-policy/v1\n";
/// A BTC/USD reading older than this is not used: a USD-pegged market refuses until it is fresh.
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
    /// The client may buy the asset with BTC.
    pub buy: bool,
    pub reference: Reference,
    /// How far a swap may be priced against the client: below the reference when selling, above it
    /// when buying. Better prices are always accepted.
    pub band_bps: u32,
    /// Most asset base units in one swap.
    pub max_swap_units: u64,
    /// Most the day's swaps may move the asset holding, either way (bought minus sold, UTC day).
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
        let mut seen = std::collections::HashSet::new();
        for m in &self.markets {
            let bad = |why: &str| Err(format!("{}: {why}", m.asset_id));
            if !m.asset_id.starts_with("rgb:") || m.asset_id.len() > 128 {
                return bad("not an RGB contract id");
            }
            if !seen.insert(m.asset_id.as_str()) {
                return bad("listed twice");
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
            if m.max_swap_units == 0 {
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
        Ok(())
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

/// The client's side of a swap, as the policy sees it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Side {
    /// The client gives the asset and receives BTC.
    Sell,
    /// The client gives BTC and receives the asset.
    Buy,
}

/// The swap reduced to what the policy decides on.
///
/// Fees are left out on purpose: in an rgb-lib on-chain swap the taker funds both the network fee
/// and the platform fee, so the client's price is the two legs alone. A transaction that made the
/// client pay anything more (a fee taken from its change, an extra output) differs from the offer;
/// catching that needs the terms derived from the PSBT, the fee and output checks of work package
/// 2 in `signer-core`, which run before this policy once they land. Until then: Mutinynet only.
#[derive(Debug, Clone, PartialEq)]
pub struct Swap {
    pub side: Side,
    pub asset_id: String,
    pub units: u64,
    pub sat: u64,
}

impl Swap {
    pub fn of(terms: &Terms) -> Result<Self, String> {
        use OnchainSwapLegKind::{Btc, Rgb};
        let (side, asset_leg, btc_leg) = match (&terms.gives.kind, &terms.receives.kind) {
            (Rgb, Btc) => (Side::Sell, &terms.gives, &terms.receives),
            (Btc, Rgb) => (Side::Buy, &terms.receives, &terms.gives),
            _ => return Err("only asset/BTC swaps are signed".into()),
        };
        let asset_id = asset_leg
            .asset_id
            .clone()
            .ok_or("the asset leg names no asset")?;
        Ok(Self {
            side,
            asset_id,
            units: asset_leg.amount,
            sat: btc_leg.amount,
        })
    }
}

/// The signer's own BTC/USD reading: `(usd per btc, unix seconds read)`.
pub type PriceCache = Arc<Mutex<Option<(f64, u64)>>>;

/// How much each asset's holding moved on one UTC day through swaps the policy let through.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Exposure {
    pub date: String,
    /// Bought minus sold, in base units, per asset.
    pub net: BTreeMap<String, i128>,
}

impl Exposure {
    fn on(&self, date: &str, asset: &str) -> i128 {
        if self.date == date {
            self.net.get(asset).copied().unwrap_or(0)
        } else {
            0
        }
    }

    fn add(&mut self, date: &str, asset: &str, delta: i128) {
        if self.date != date {
            self.date = date.to_string();
            self.net.clear();
        }
        *self.net.entry(asset.to_string()).or_default() += delta;
    }
}

/// The reference price for `rule` at `now`, in sats per whole unit.
pub fn reference_price(
    rule: &MarketRule,
    btc_usd: Option<(f64, u64)>,
    now: u64,
) -> Result<f64, String> {
    match rule.reference {
        Reference::Fixed { sat_per_unit } => Ok(sat_per_unit),
        Reference::UsdPeg { usd_per_unit } => match btc_usd {
            Some((usd, at)) if now.saturating_sub(at) <= MAX_PRICE_AGE_SECS && usd > 0.0 => {
                Ok(usd_per_unit / usd * 100_000_000.0)
            }
            _ => Err("no fresh BTC/USD reference price".into()),
        },
    }
}

/// Whether `swap` fits `policy` given the day's exposure so far. `Ok` carries the exposure change.
pub fn decide(
    policy: &SigningPolicy,
    swap: &Swap,
    exposure: &Exposure,
    btc_usd: Option<(f64, u64)>,
    now: u64,
) -> Result<i128, String> {
    let rule = policy
        .markets
        .iter()
        .find(|m| m.asset_id == swap.asset_id)
        .ok_or_else(|| format!("{} is not in the policy", swap.asset_id))?;
    let name = rule.ticker.as_deref().unwrap_or(&rule.asset_id);
    match swap.side {
        Side::Sell if !rule.sell => return Err(format!("selling {name} is not allowed")),
        Side::Buy if !rule.buy => return Err(format!("buying {name} is not allowed")),
        _ => {}
    }
    if swap.units == 0 || swap.sat == 0 {
        return Err("a swap with a zero amount".into());
    }
    if swap.units > rule.max_swap_units {
        return Err(format!(
            "{} {name} base units is over the {} allowed per swap",
            swap.units, rule.max_swap_units
        ));
    }
    let reference = reference_price(rule, btc_usd, now)?;
    let price = swap.sat as f64 / (swap.units as f64 / 10f64.powi(i32::from(rule.precision)));
    let band = f64::from(rule.band_bps) / 10_000.0;
    match swap.side {
        Side::Sell if price < reference * (1.0 - band) => {
            return Err(format!(
                "selling at {price:.4} sat per unit, more than {:.2}% under the reference {reference:.4}",
                band * 100.0
            ))
        }
        Side::Buy if price > reference * (1.0 + band) => {
            return Err(format!(
                "buying at {price:.4} sat per unit, more than {:.2}% over the reference {reference:.4}",
                band * 100.0
            ))
        }
        _ => {}
    }
    let delta = match swap.side {
        Side::Sell => -i128::from(swap.units),
        Side::Buy => i128::from(swap.units),
    };
    let after = exposure.on(&utc_date(now), &swap.asset_id) + delta;
    if after.unsigned_abs() > u128::from(rule.max_daily_net_units) {
        return Err(format!(
            "the day's net {name} would reach {after} base units, over the {} allowed",
            rule.max_daily_net_units
        ));
    }
    Ok(delta)
}

/// The policy the signer runs: a verified [`SignedPolicy`], the day's exposure (kept on disk so a
/// restart does not reset the cap) and the signer's own price reading.
pub struct ClientPolicy {
    signed: SignedPolicy,
    exposure: Mutex<JsonFile<Exposure>>,
    prices: PriceCache,
    journal: Journal,
}

impl ClientPolicy {
    pub fn new(
        signed: SignedPolicy,
        exposure_path: PathBuf,
        prices: PriceCache,
        journal: Journal,
    ) -> Self {
        Self {
            signed,
            exposure: Mutex::new(JsonFile::load(exposure_path)),
            prices,
            journal,
        }
    }

    fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
        m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
    }
}

impl Policy for ClientPolicy {
    fn check(&self, request: &SignRequest, terms: &Terms) -> Result<(), String> {
        let now = Timestamp::now().as_secs();
        let swap = Swap::of(terms);
        let outcome = swap.as_ref().map_err(Clone::clone).and_then(|swap| {
            let mut exposure = Self::lock(&self.exposure);
            let btc_usd = *Self::lock(&self.prices);
            let delta = decide(&self.signed.policy, swap, &exposure.value, btc_usd, now)?;
            // counted when let through: a swap that then fails to sign or never confirms still
            // counts, which errs on the side of the cap
            exposure.value.add(&utc_date(now), &swap.asset_id, delta);
            exposure.save();
            Ok(())
        });
        self.journal.decided(
            &request.id,
            request.swap_id(),
            swap.ok().as_ref(),
            outcome.as_ref().err().map(String::as_str),
            now,
        );
        outcome
    }

    fn describe(&self) -> String {
        let names: Vec<&str> = self
            .signed
            .policy
            .markets
            .iter()
            .map(|m| m.ticker.as_deref().unwrap_or(&m.asset_id))
            .collect();
        format!(
            "client policy signed at {}: {}",
            self.signed.signed_at,
            names.join(", ")
        )
    }
}

/// The UTC date of `secs` (unix seconds) as `YYYY-MM-DD`, the day the exposure cap counts.
pub fn utc_date(secs: u64) -> String {
    // days since 1970-01-01 to a civil date (H. Hinnant's algorithm), as p2pd's metering does
    let z = (secs / 86_400) as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use rgb_lib::wallet::OnchainSwapLeg;

    const ASSET: &str = "rgb:usdt-test";
    const NOON: u64 = 1_794_571_200; // 2026-11-13 12:00 UTC

    fn rule() -> MarketRule {
        MarketRule {
            asset_id: ASSET.into(),
            ticker: Some("TUSD".into()),
            precision: 2,
            sell: true,
            buy: true,
            reference: Reference::Fixed {
                sat_per_unit: 1_000.0,
            },
            band_bps: 200,
            max_swap_units: 10_000,
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

    fn swap(side: Side, units: u64, sat: u64) -> Swap {
        Swap {
            side,
            asset_id: ASSET.into(),
            units,
            sat,
        }
    }

    #[test]
    fn a_swap_inside_every_limit_passes_and_counts_against_the_day() {
        // 50.00 units at 1000 sat each
        let delta = decide(
            &policy(),
            &swap(Side::Sell, 5_000, 50_000),
            &Exposure::default(),
            None,
            NOON,
        );
        assert_eq!(delta, Ok(-5_000));
    }

    #[test]
    fn the_price_band_only_guards_the_side_that_costs_the_client() {
        let e = Exposure::default();
        // selling 3% under the reference is refused, selling over it is fine
        assert!(
            decide(&policy(), &swap(Side::Sell, 100, 970), &e, None, NOON)
                .unwrap_err()
                .contains("under the reference")
        );
        assert!(decide(&policy(), &swap(Side::Sell, 100, 1_500), &e, None, NOON).is_ok());
        // buying 3% over it is refused, buying under it is fine
        assert!(
            decide(&policy(), &swap(Side::Buy, 100, 1_030), &e, None, NOON)
                .unwrap_err()
                .contains("over the reference")
        );
        assert!(decide(&policy(), &swap(Side::Buy, 100, 500), &e, None, NOON).is_ok());
        // at the edge of the band
        assert!(decide(&policy(), &swap(Side::Sell, 100, 980), &e, None, NOON).is_ok());
    }

    #[test]
    fn assets_sides_and_size_outside_the_policy_are_refused() {
        let e = Exposure::default();
        let mut other = swap(Side::Sell, 100, 1_000);
        other.asset_id = "rgb:other".into();
        assert!(decide(&policy(), &other, &e, None, NOON)
            .unwrap_err()
            .contains("not in the policy"));
        let mut p = policy();
        p.markets[0].buy = false;
        assert_eq!(
            decide(&p, &swap(Side::Buy, 100, 1_000), &e, None, NOON).unwrap_err(),
            "buying TUSD is not allowed"
        );
        assert!(decide(
            &policy(),
            &swap(Side::Sell, 10_001, 100_010),
            &e,
            None,
            NOON
        )
        .unwrap_err()
        .contains("allowed per swap"));
    }

    #[test]
    fn the_daily_net_cap_holds_either_way_and_resets_at_utc_midnight() {
        let mut e = Exposure::default();
        e.add(&utc_date(NOON), ASSET, -10_000);
        // another sale of 6000 would put the day at -16000
        assert!(
            decide(&policy(), &swap(Side::Sell, 6_000, 60_000), &e, None, NOON)
                .unwrap_err()
                .contains("day's net")
        );
        // a purchase brings it back towards zero
        assert_eq!(
            decide(&policy(), &swap(Side::Buy, 6_000, 60_000), &e, None, NOON),
            Ok(6_000)
        );
        // the next day starts from nothing
        assert!(decide(
            &policy(),
            &swap(Side::Sell, 6_000, 60_000),
            &e,
            None,
            NOON + 86_400
        )
        .is_ok());
    }

    #[test]
    fn a_usd_peg_needs_a_fresh_reading_of_its_own() {
        let mut p = policy();
        p.markets[0].reference = Reference::UsdPeg { usd_per_unit: 1.0 };
        let e = Exposure::default();
        // 1 USD at 100 000 USD/BTC is 1000 sat
        let fresh = Some((100_000.0, NOON - 10));
        assert!(decide(&p, &swap(Side::Sell, 100, 1_000), &e, fresh, NOON).is_ok());
        assert!(decide(&p, &swap(Side::Sell, 100, 900), &e, fresh, NOON).is_err());
        let stale = Some((100_000.0, NOON - MAX_PRICE_AGE_SECS - 1));
        assert_eq!(
            decide(&p, &swap(Side::Sell, 100, 1_000), &e, stale, NOON).unwrap_err(),
            "no fresh BTC/USD reference price"
        );
        assert!(decide(&p, &swap(Side::Sell, 100, 1_000), &e, None, NOON).is_err());
    }

    #[test]
    fn terms_become_the_clients_side_of_the_swap() {
        let leg = |kind, asset: Option<&str>, amount| OnchainSwapLeg {
            kind,
            asset_id: asset.map(str::to_string),
            amount,
        };
        let terms = |gives, receives| Terms {
            swap_id: "s".into(),
            gives,
            receives,
            platform_fee_sat: 0,
            network_fee_sat: 0,
            expires_at: None,
        };
        let sell = terms(
            leg(OnchainSwapLegKind::Rgb, Some(ASSET), 7),
            leg(OnchainSwapLegKind::Btc, None, 7_000),
        );
        assert_eq!(Swap::of(&sell), Ok(swap(Side::Sell, 7, 7_000)));
        let buy = terms(
            leg(OnchainSwapLegKind::Btc, None, 7_000),
            leg(OnchainSwapLegKind::Rgb, Some(ASSET), 7),
        );
        assert_eq!(Swap::of(&buy), Ok(swap(Side::Buy, 7, 7_000)));
        let odd = terms(
            leg(OnchainSwapLegKind::Btc, None, 1),
            leg(OnchainSwapLegKind::Btc, None, 1),
        );
        assert!(Swap::of(&odd).is_err());
    }

    #[test]
    fn a_signed_policy_verifies_only_unchanged_and_under_its_own_key() {
        let keys = Keys::generate();
        let signed = SignedPolicy::sign(policy(), &keys, NOON).unwrap();
        assert_eq!(signed.verify(&keys.public_key()), Ok(()));
        assert!(signed.verify(&Keys::generate().public_key()).is_err());
        let mut edited = signed.clone();
        edited.policy.markets[0].band_bps = 5_000;
        assert_eq!(
            edited.verify(&keys.public_key()).unwrap_err(),
            "the policy signature does not verify"
        );
        let mut redated = signed;
        redated.signed_at += 1;
        assert!(redated.verify(&keys.public_key()).is_err());
    }

    #[test]
    fn a_policy_for_mainnet_or_with_nothing_allowed_is_not_signed() {
        let keys = Keys::generate();
        let mut p = policy();
        p.network = "mainnet".into();
        assert!(SignedPolicy::sign(p, &keys, NOON).is_err());
        let mut p = policy();
        p.markets[0].sell = false;
        p.markets[0].buy = false;
        assert!(SignedPolicy::sign(p, &keys, NOON).is_err());
        let mut p = policy();
        p.markets[0].band_bps = 0;
        assert!(p.validate().is_err());
    }

    #[test]
    fn dates_are_utc_calendar_days() {
        assert_eq!(utc_date(0), "1970-01-01");
        assert_eq!(utc_date(1_794_528_000 - 1), "2026-11-12");
        assert_eq!(utc_date(1_794_528_000), "2026-11-13");
    }
}
