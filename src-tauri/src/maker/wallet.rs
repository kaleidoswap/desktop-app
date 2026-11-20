//! The signer's wallet outside the signer: funding it, making the coins an asset can sit on,
//! minting an asset into it, and handing its RGB state to the hosted maker.
//!
//! This is the issuer's "launch a token" flow. Minting here, in the client's own wallet, gives the
//! signer the asset's RGB state from genesis, which it needs to sign a sale (signer-core refuses a
//! sale of an asset its wallet holds no state for). The hosted watch-only maker needs the same
//! state, so it gets an encrypted rgb-lib backup of this wallet: the wallet's database and stash,
//! no private key (the mnemonic is never written to the data directory; bdk keeps public
//! descriptors only).
//!
//! rgb-lib wants one user of a wallet directory at a time: while these commands run, the signer is
//! stopped, and the wallet they opened is the one the signer takes when it starts again.

use std::path::Path;
use std::str::FromStr;

use rgb_lib::wallet::{
    DatabaseType, Online, OnlineOptions, RgbWalletOpsOffline, SinglesigKeys, Wallet, WalletData,
};
use rgb_lib::AssetSchema;
use serde::Serialize;

use super::Secrets;

/// The signer wallet, open and online.
pub struct OpenWallet {
    pub network: String,
    pub wallet: Wallet,
    pub online: Online,
}

/// Open (and connect) the signer wallet in `dir`. Blocking: call it off the async workers.
pub(super) fn open(
    network: &str,
    indexer: &str,
    dir: &Path,
    s: &Secrets,
) -> Result<OpenWallet, String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let k = super::wallet_keys(network, s)?;
    let data = WalletData {
        data_dir: dir.to_string_lossy().into_owned(),
        bitcoin_network: rgb_lib::BitcoinNetwork::from_str(network).map_err(|e| e.to_string())?,
        database_type: DatabaseType::Sqlite,
        max_allocations_per_utxo: 5,
        supported_schemas: vec![AssetSchema::Nia],
        reuse_addresses: false,
    };
    let sk = SinglesigKeys {
        account_xpub_vanilla: k.account_xpub_vanilla,
        account_xpub_colored: k.account_xpub_colored,
        vanilla_keychain: None,
        master_fingerprint: k.master_fingerprint,
        mnemonic: Some(k.mnemonic),
        witness_version: k.witness_version,
    };
    let mut wallet = Wallet::new(data, sk).map_err(|e| format!("signer wallet: {e}"))?;
    let online = wallet
        .go_online(OnlineOptions {
            indexer_url: indexer.to_string(),
            skip_consistency_check: true,
            vanilla_sync_lookback: 20,
        })
        .map_err(|e| format!("signer wallet: {e}"))?;
    Ok(OpenWallet {
        network: network.to_string(),
        wallet,
        online,
    })
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Sats {
    pub settled: u64,
    pub spendable: u64,
    pub future: u64,
}

impl From<rgb_lib::wallet::Balance> for Sats {
    fn from(b: rgb_lib::wallet::Balance) -> Self {
        Self {
            settled: b.settled,
            spendable: b.spendable,
            future: b.future,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct AssetView {
    pub asset_id: String,
    pub ticker: String,
    pub name: String,
    pub precision: u8,
    pub issued_supply: u64,
    pub balance: Sats,
    /// How many coins carry some of it: how many sales can run at once.
    pub allocations: usize,
}

/// What the launch screen shows about the signer wallet.
#[derive(Debug, Serialize)]
pub struct WalletView {
    /// Bitcoin not set aside for assets: what funds new coins.
    pub btc: Sats,
    /// Bitcoin on the coins that can carry assets.
    pub colored: Sats,
    /// Coins that can carry an asset.
    pub coins: usize,
    /// Of those, the ones that exist on chain and carry nothing yet: where a mint can go.
    pub free_coins: usize,
    pub assets: Vec<AssetView>,
}

/// Sync and read the wallet.
pub fn view(w: &mut OpenWallet) -> Result<WalletView, String> {
    let bal = w
        .wallet
        .get_btc_balance(Some(w.online), false)
        .map_err(|e| e.to_string())?;
    let unspents = w
        .wallet
        .list_unspents(None, false, true)
        .map_err(|e| e.to_string())?;
    let colorable: Vec<_> = unspents.iter().filter(|u| u.utxo.colorable).collect();
    let free_coins = colorable
        .iter()
        .filter(|u| u.utxo.exists && u.rgb_allocations.is_empty() && u.pending_blinded == 0)
        .count();
    let assets = w
        .wallet
        .list_assets(vec![AssetSchema::Nia])
        .map_err(|e| e.to_string())?;
    let assets = assets
        .nia
        .unwrap_or_default()
        .into_iter()
        .map(|a| AssetView {
            allocations: colorable
                .iter()
                .filter(|u| {
                    u.rgb_allocations
                        .iter()
                        .any(|r| r.asset_id.as_deref() == Some(&a.asset_id))
                })
                .count(),
            asset_id: a.asset_id,
            ticker: a.ticker,
            name: a.name,
            precision: a.precision,
            issued_supply: a.issued_supply,
            balance: a.balance.into(),
        })
        .collect();
    Ok(WalletView {
        btc: bal.vanilla.into(),
        colored: bal.colored.into(),
        coins: colorable.len(),
        free_coins,
        assets,
    })
}

/// Make `num` coins of `size` sats that can carry assets, paying `fee_rate` sat/vB. Signed here.
pub fn create_coins(w: &mut OpenWallet, num: u8, size: u32, fee_rate: u64) -> Result<u8, String> {
    if num == 0 || num > 50 {
        return Err("make between 1 and 50 coins".into());
    }
    if !(1..=1_000).contains(&fee_rate) {
        return Err("the fee rate must be between 1 and 1000 sat/vB".into());
    }
    w.wallet
        .create_utxos(w.online, false, Some(num), Some(size), fee_rate, false)
        .map_err(|e| e.to_string())
}

/// What to mint.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Mint {
    pub ticker: String,
    pub name: String,
    pub precision: u8,
    /// Whole supply, in base units.
    pub supply: u64,
    /// How many coins to spread it over: how many sales can run at once.
    pub parts: u8,
}

impl Mint {
    pub fn check(&self) -> Result<(), String> {
        let t = &self.ticker;
        if t.is_empty()
            || t.len() > 8
            || !t.starts_with(|c: char| c.is_ascii_uppercase())
            || !t
                .chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
        {
            return Err(
                "the ticker is 1 to 8 capital letters or digits, starting with a letter".into(),
            );
        }
        let n = self.name.trim();
        if n.is_empty() || n.len() > 40 {
            return Err("the name is 1 to 40 characters".into());
        }
        if self.precision > 18 {
            return Err("the decimals are at most 18".into());
        }
        if self.parts == 0 {
            return Err("spread the supply over at least one coin".into());
        }
        if self.supply < u64::from(self.parts) {
            return Err("the supply is too small to spread over that many coins".into());
        }
        Ok(())
    }

    /// The supply in `parts` near-equal amounts, the remainder on the first.
    pub fn amounts(&self) -> Vec<u64> {
        let parts = u64::from(self.parts.max(1));
        let each = self.supply / parts;
        let mut v = vec![each; parts as usize];
        v[0] += self.supply - each * parts;
        v
    }
}

/// Mint an NIA asset into the wallet, spread over free coins.
pub fn mint(w: &mut OpenWallet, m: &Mint) -> Result<String, String> {
    m.check()?;
    let a = w
        .wallet
        .issue_asset_nia(
            m.ticker.clone(),
            m.name.trim().to_string(),
            m.precision,
            m.amounts(),
        )
        .map_err(|e| e.to_string())?;
    Ok(a.asset_id)
}

/// An encrypted backup of the wallet's state in `path` (which must not exist yet).
pub fn backup(w: &OpenWallet, path: &Path, password: &str) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    w.wallet
        .backup(&path.to_string_lossy(), password)
        .map_err(|e| format!("backup: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mint(supply: u64, parts: u8) -> Mint {
        Mint {
            ticker: "LAUNCH".into(),
            name: "Launch token".into(),
            precision: 2,
            supply,
            parts,
        }
    }

    #[test]
    fn the_supply_is_spread_whole_over_the_coins() {
        assert_eq!(mint(1_000, 3).amounts(), vec![334, 333, 333]);
        assert_eq!(mint(10, 1).amounts(), vec![10]);
        let m = mint(1_000_000_007, 6);
        assert_eq!(m.amounts().iter().sum::<u64>(), 1_000_000_007);
    }

    #[test]
    fn a_mint_needs_a_proper_ticker_name_and_enough_supply() {
        assert!(mint(1_000, 3).check().is_ok());
        for t in ["", "lower", "TOOLONGTICKER", "1ABC", "AB-C"] {
            let mut m = mint(1_000, 3);
            m.ticker = t.into();
            assert!(m.check().is_err(), "{t}");
        }
        let mut m = mint(1_000, 3);
        m.name = "  ".into();
        assert!(m.check().is_err());
        assert!(mint(2, 3).check().is_err());
        assert!(mint(1_000, 0).check().is_err());
        let mut m = mint(1_000, 3);
        m.precision = 19;
        assert!(m.check().is_err());
    }
}
