use rgb_lib::keys::{generate_keys, restore_keys, WitnessVersion};
use rgb_lib::wallet::{DatabaseType, SinglesigKeys, Wallet, WalletData};
use rgb_lib::{AssetSchema, BitcoinNetwork};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tempfile::{Builder, NamedTempFile};
use zeroize::{Zeroize, Zeroizing};

const CURRENT: &str = "wallet.json";
const STORAGE_ERROR: &str = "wallet_storage";
const EXISTS: &str = "wallet_exists";
const INVALID: &str = "invalid_mnemonic";

// Only a successful OS assertion can authorize a new passkey-backed wallet.
// Store the public fingerprint only, and keep the proof out of the IPC surface.
static VERIFIED_PASSKEY: Mutex<Option<String>> = Mutex::new(None);

pub(super) fn record_passkey_assertion(mnemonic: Option<&str>) -> Result<(), &'static str> {
    *VERIFIED_PASSKEY.lock().map_err(|_| "passkey_unavailable")? = mnemonic.map(fingerprint);
    Ok(())
}

fn fingerprint(normalized: &str) -> String {
    hex::encode(Sha256::digest(normalized.as_bytes()))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Method {
    Mnemonic,
    Passkey,
}

/// The fingerprint uses the Chrome extension's hash of the normalized BIP39 phrase.
/// The BIP32 master fingerprint identifies the corresponding rgb-lib directory.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Identity {
    method: Method,
    fingerprint: String,
    master_fingerprint: String,
}

#[derive(Deserialize, Serialize)]
struct Record {
    version: u8,
    directory: String,
    wallet: Identity,
}

/// Read-only subset of the pinned rgb-lib wallet manifest.
#[derive(Deserialize)]
struct RgbManifest {
    bitcoin_network: BitcoinNetwork,
    witness_version: WitnessVersion,
    master_fingerprint: String,
}

#[derive(Serialize)]
pub(crate) struct Status {
    state: &'static str,
    wallet: Option<Identity>,
}

impl From<Option<Identity>> for Status {
    fn from(wallet: Option<Identity>) -> Self {
        Self {
            state: if wallet.is_some() { "ready" } else { "empty" },
            wallet,
        }
    }
}

fn storage_root(app: &AppHandle) -> Result<PathBuf, &'static str> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join("onchain-mainnet"))
        .map_err(|_| STORAGE_ERROR)
}

fn read_record(root: &Path) -> Result<Option<Record>, &'static str> {
    let bytes = match fs::read(root.join(CURRENT)) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(STORAGE_ERROR),
    };
    let record: Record = serde_json::from_slice(&bytes).map_err(|_| STORAGE_ERROR)?;
    let hex_value = |s: &str, length| s.len() == length && s.bytes().all(|c| c.is_ascii_hexdigit());
    if record.version != 1
        || !record.directory.strip_prefix("rgb-").is_some_and(|suffix| {
            !suffix.is_empty() && suffix.bytes().all(|c| c.is_ascii_alphanumeric())
        })
        || !hex_value(&record.wallet.fingerprint, 64)
        || !hex_value(&record.wallet.master_fingerprint, 8)
    {
        return Err(STORAGE_ERROR);
    }
    let wallet_dir = root
        .join(&record.directory)
        .join(&record.wallet.master_fingerprint);
    let manifest_file =
        fs::File::open(wallet_dir.join("wallet_manifest.json")).map_err(|_| STORAGE_ERROR)?;
    let manifest: RgbManifest =
        serde_json::from_reader(manifest_file).map_err(|_| STORAGE_ERROR)?;
    if manifest.bitcoin_network != BitcoinNetwork::Mainnet
        || manifest.witness_version != WitnessVersion::Taproot
        || manifest.master_fingerprint != record.wallet.master_fingerprint
        || !wallet_dir.join("bdk_db_watch_only").is_file()
        || !wallet_dir.join("rgb_lib_db").is_file()
    {
        return Err(STORAGE_ERROR);
    }
    Ok(Some(record))
}

fn existing(record: Record, expected: &Identity) -> Result<Status, &'static str> {
    if record.wallet.fingerprint != expected.fingerprint
        || record.wallet.master_fingerprint != expected.master_fingerprint
    {
        return Err(EXISTS);
    }
    Ok(Some(record.wallet).into())
}

fn create(
    root: &Path,
    mnemonic: String,
    method: Method,
    assertion: &Mutex<Option<String>>,
) -> Result<Status, &'static str> {
    let input = Zeroizing::new(mnemonic);
    if input.len() > 1024 {
        return Err(INVALID);
    }
    let mut normalized = input.split_whitespace().collect::<Vec<_>>().join(" ");
    normalized.make_ascii_lowercase();
    if method == Method::Passkey && normalized.split_whitespace().count() != 24 {
        normalized.zeroize();
        return Err(INVALID);
    }
    let mut keys = restore_keys(BitcoinNetwork::Mainnet, normalized, WitnessVersion::Taproot)
        .map_err(|_| INVALID)?;
    let identity = Identity {
        method,
        fingerprint: fingerprint(&keys.mnemonic),
        master_fingerprint: keys.master_fingerprint.clone(),
    };
    let public_keys = SinglesigKeys::from_keys_no_mnemonic(&keys, None);
    keys.mnemonic.zeroize();
    drop(input);
    let mut verified = match method {
        Method::Passkey => Some(assertion.lock().map_err(|_| "passkey_unavailable")?),
        Method::Mnemonic => None,
    };
    if let Some(record) = read_record(root)? {
        return existing(record, &identity);
    }
    if let Some(proof) = &verified {
        if proof.as_deref() != Some(identity.fingerprint.as_str()) {
            return Err("passkey_invalid_credential");
        }
    }

    fs::create_dir_all(root).map_err(|_| STORAGE_ERROR)?;
    let directory = Builder::new()
        .prefix("rgb-")
        .tempdir_in(root)
        .map_err(|_| STORAGE_ERROR)?;
    let path = directory.path();
    let data = WalletData {
        data_dir: path.to_str().ok_or(STORAGE_ERROR)?.to_owned(),
        bitcoin_network: BitcoinNetwork::Mainnet,
        database_type: DatabaseType::Sqlite,
        max_allocations_per_utxo: 5,
        supported_schemas: vec![AssetSchema::Nia, AssetSchema::Uda, AssetSchema::Cfa],
        reuse_addresses: false,
    };
    // rgb-lib writes its BDK descriptors and asset databases using public keys only.
    drop(Wallet::new(data, public_keys).map_err(|_| "wallet_initialization")?);

    // Publish the completed directory with one exclusive write. Concurrent creators never
    // share a database. An interruption before publication leaves no active wallet and a
    // retry can proceed, even if an old staging directory survived a process crash.
    let record = Record {
        version: 1,
        directory: path
            .file_name()
            .and_then(|s| s.to_str())
            .ok_or(STORAGE_ERROR)?
            .into(),
        wallet: identity.clone(),
    };
    let mut metadata = NamedTempFile::new_in(root).map_err(|_| STORAGE_ERROR)?;
    serde_json::to_writer(metadata.as_file_mut(), &record).map_err(|_| STORAGE_ERROR)?;
    metadata.as_file().sync_all().map_err(|_| STORAGE_ERROR)?;
    let status = match metadata.persist_noclobber(root.join(CURRENT)) {
        Ok(_) => {
            let _ = directory.keep();
            Ok(Some(identity).into())
        }
        Err(error) if error.error.kind() == ErrorKind::AlreadyExists => {
            existing(read_record(root)?.ok_or(STORAGE_ERROR)?, &identity)
        }
        Err(_) => Err(STORAGE_ERROR),
    }?;
    // Disk failures leave the proof intact for retry. Repeating a successful commit
    // returns the existing wallet above, even after its one-use proof is consumed.
    if let Some(proof) = verified.as_mut() {
        **proof = None;
    }
    Ok(status)
}

#[tauri::command]
pub(crate) fn mainnet_wallet_status(app: AppHandle) -> Result<Status, &'static str> {
    Ok(read_record(&storage_root(&app)?)?
        .map(|record| record.wallet)
        .into())
}

/// No wallet is committed until the caller explicitly confirms the backup.
#[tauri::command]
pub(crate) async fn mainnet_wallet_generate() -> Result<String, &'static str> {
    tauri::async_runtime::spawn_blocking(|| {
        generate_keys(BitcoinNetwork::Mainnet, WitnessVersion::Taproot).mnemonic
    })
    .await
    .map_err(|_| "wallet_initialization")
}

#[tauri::command]
pub(crate) async fn mainnet_wallet_create(
    app: AppHandle,
    mnemonic: String,
    method: Method,
) -> Result<Status, &'static str> {
    let root = storage_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || create(&root, mnemonic, method, &VERIFIED_PASSKEY))
        .await
        .map_err(|_| "wallet_initialization")?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Barrier;

    // Public BIP39/BIP86 vectors; no network connection or real wallet data is used.
    const WORDS: &str =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const ADDRESS: &str = "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";

    #[test]
    fn generates_a_valid_english_backup_before_creating_the_wallet() {
        let phrase = tauri::async_runtime::block_on(mainnet_wallet_generate()).unwrap();
        assert_eq!(phrase.split_whitespace().count(), 12);
        assert!(restore_keys(BitcoinNetwork::Mainnet, phrase, WitnessVersion::Taproot).is_ok());
    }

    fn assert_public_files(path: &Path, phrase: &str) {
        for entry in fs::read_dir(path).unwrap() {
            let file = entry.unwrap().path();
            if file.is_dir() {
                assert_public_files(&file, phrase);
            } else {
                let bytes = fs::read(file).unwrap();
                let text = String::from_utf8_lossy(&bytes);
                assert!(!text.contains(phrase));
                assert!(!text.contains("xprv"));
            }
        }
    }

    #[test]
    fn creates_offline_watch_only_wallet_compatible_with_the_extension() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("onchain-mainnet");
        assert!(read_record(&root).unwrap().is_none());
        assert!(!root.exists());
        let result = create(
            &root,
            WORDS.replace(' ', "  ").to_uppercase(),
            Method::Mnemonic,
            &Mutex::new(None),
        )
        .unwrap();
        let record = read_record(&root).unwrap().unwrap();
        assert_eq!(result.state, "ready");
        assert_eq!(result.wallet.as_ref(), Some(&record.wallet));
        assert_eq!(record.wallet.master_fingerprint, "73c5da0a");
        assert_eq!(
            record.wallet.fingerprint,
            hex::encode(Sha256::digest(WORDS.as_bytes()))
        );
        let mut reopened = Wallet::load(
            root.join(&record.directory).to_str().unwrap(),
            &record.wallet.master_fingerprint,
            None,
        )
        .unwrap();
        assert!(reopened.get_keys().mnemonic.is_none());
        assert_eq!(reopened.get_address().unwrap(), ADDRESS);
        drop(reopened);
        assert_public_files(&root, WORDS);
        // A missing store cannot become a fresh database after a retry.
        fs::remove_file(
            root.join(&record.directory)
                .join(&record.wallet.master_fingerprint)
                .join("rgb_lib_db"),
        )
        .unwrap();
        assert!(matches!(
            create(&root, WORDS.into(), Method::Mnemonic, &Mutex::new(None)),
            Err(STORAGE_ERROR)
        ));
    }

    #[test]
    fn interrupted_setup_is_retryable_and_competing_wallets_cannot_replace_the_winner() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        fs::create_dir(root.join("rgb-abandoned")).unwrap();
        assert!(read_record(root).unwrap().is_none());
        let passkey_phrase = format!("{} art", ["abandon"; 23].join(" "));
        let verified = Mutex::new(Some(fingerprint(&passkey_phrase)));
        let records = [
            (WORDS, Method::Mnemonic),
            (&*passkey_phrase, Method::Passkey),
        ];
        let start = Barrier::new(2);
        let results = std::thread::scope(|threads| {
            let handles: Vec<_> = records
                .iter()
                .map(|(phrase, method)| {
                    let barrier = &start;
                    let proof = &verified;
                    threads.spawn(move || {
                        barrier.wait();
                        create(root, phrase.to_string(), *method, proof)
                    })
                })
                .collect();
            handles
                .into_iter()
                .map(|handle| handle.join().unwrap())
                .collect::<Vec<_>>()
        });
        assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
        assert_eq!(
            results
                .iter()
                .filter(|r| matches!(r, Err(error) if *error == EXISTS))
                .count(),
            1
        );
        let record = read_record(root).unwrap().unwrap();
        let winner = results.iter().position(Result::is_ok).unwrap();
        let (phrase, method) = records[winner];
        let retry = create(root, phrase.to_owned(), method, &verified).unwrap();
        assert_eq!(retry.wallet, Some(record.wallet));
        assert_eq!(
            read_record(root).unwrap().unwrap().directory,
            record.directory
        );
        assert_public_files(root, &passkey_phrase);
        assert_public_files(root, WORDS);
    }

    #[test]
    fn a_passkey_wallet_recognizes_its_mnemonic_backup_and_keeps_its_original_method() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        let phrase = format!("{} art", ["abandon"; 23].join(" "));
        let verified = Mutex::new(Some(fingerprint(&phrase)));
        let wallet = create(root, phrase.clone(), Method::Passkey, &verified)
            .unwrap()
            .wallet
            .unwrap();
        assert_eq!(wallet.method, Method::Passkey);
        assert_eq!(
            wallet.fingerprint,
            hex::encode(Sha256::digest(phrase.as_bytes()))
        );
        let original_directory = read_record(root).unwrap().unwrap().directory;
        assert_eq!(
            create(root, phrase.clone(), Method::Mnemonic, &Mutex::new(None))
                .unwrap()
                .wallet,
            Some(wallet)
        );
        assert_eq!(
            read_record(root).unwrap().unwrap().directory,
            original_directory
        );
        assert_public_files(root, &phrase);
    }

    #[test]
    fn passkey_commit_requires_the_matching_assertion_and_retries_after_a_storage_failure() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("wallet");
        let phrase = format!("{} art", ["abandon"; 23].join(" "));
        let proof = Mutex::new(None);
        for previous in [None, Some(fingerprint(WORDS))] {
            *proof.lock().unwrap() = previous;
            assert!(matches!(
                create(&root, phrase.clone(), Method::Passkey, &proof),
                Err("passkey_invalid_credential")
            ));
            assert!(!root.exists());
        }

        *proof.lock().unwrap() = Some(fingerprint(&phrase));
        fs::write(&root, "blocks the wallet directory").unwrap();
        assert!(matches!(
            create(&root, phrase.clone(), Method::Passkey, &proof),
            Err(STORAGE_ERROR)
        ));
        assert_eq!(*proof.lock().unwrap(), Some(fingerprint(&phrase)));
        fs::remove_file(&root).unwrap();
        assert!(create(&root, phrase.clone(), Method::Passkey, &proof).is_ok());
        assert!(proof.lock().unwrap().is_none());
        assert!(create(&root, phrase, Method::Passkey, &proof).is_ok());
    }

    #[test]
    fn rejects_invalid_input_and_preserves_an_unreadable_existing_record() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("mainnet");
        assert!(matches!(
            create(
                &root,
                "invalid seed".into(),
                Method::Mnemonic,
                &Mutex::new(None)
            ),
            Err(INVALID)
        ));
        assert!(matches!(
            create(&root, WORDS.into(), Method::Passkey, &Mutex::new(None)),
            Err(INVALID)
        ));
        assert!(!root.exists());
        fs::create_dir(&root).unwrap();
        fs::write(root.join(CURRENT), "old incomplete record").unwrap();
        assert!(matches!(
            create(&root, WORDS.into(), Method::Mnemonic, &Mutex::new(None)),
            Err(STORAGE_ERROR)
        ));
        assert_eq!(
            fs::read_to_string(root.join(CURRENT)).unwrap(),
            "old incomplete record"
        );
    }
}
