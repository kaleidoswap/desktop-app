//! Secrets the app must read without the wallet password, kept in the OS
//! credential store (macOS Keychain, Windows Credential Manager, Secret
//! Service on Linux) instead of the SQLite database.

const SERVICE: &str = "com.kaleidoswap.desktop";

fn entry(name: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, name).map_err(|e| e.to_string())
}

/// `Ok(None)` when no secret is stored; `Err` when the store is unavailable.
pub fn get(name: &str) -> Result<Option<String>, String> {
    match entry(name)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn set(name: &str, secret: &str) -> Result<(), String> {
    entry(name)?.set_password(secret).map_err(|e| e.to_string())
}

pub fn delete(name: &str) -> Result<(), String> {
    match entry(name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    /// Touches the real OS credential store; run with `--ignored`.
    #[test]
    #[ignore]
    fn round_trip() {
        let name = "test-round-trip";
        super::set(name, "s3cret").unwrap();
        assert_eq!(super::get(name).unwrap().as_deref(), Some("s3cret"));
        super::delete(name).unwrap();
        assert_eq!(super::get(name).unwrap(), None);
        super::delete(name).unwrap();
    }
}
