#![cfg(target_os = "windows")]

/// Exercise the actual Windows Credential Manager backend, never a user credential.
#[test]
fn windows_credential_manager_round_trip() {
    let account = format!("beta-ci-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    let entry = keyring::Entry::new("com.kaleidoswap.beta.qa.disposable", &account).unwrap();
    let secret = "disposable-test-value-not-a-wallet-secret";
    entry.set_password(secret).unwrap();
    let read = entry.get_password();
    let deleted = entry.delete_credential();
    assert_eq!(read.unwrap(), secret);
    deleted.unwrap();
    assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
}
