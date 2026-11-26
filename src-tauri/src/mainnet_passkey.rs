//! The Desktop credential is scoped to its own associated domain. Public IDs may be
//! saved across prompts. The PRF output and derived recovery phrase stay in memory.
use serde::Serialize;
use zeroize::Zeroize;

#[derive(Serialize)]
pub(crate) struct Capability {
    available: bool,
    reason: Option<&'static str>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Registered {
    credential_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Derived {
    credential_id: String,
    mnemonic: String,
}

impl Drop for Derived {
    fn drop(&mut self) {
        self.mnemonic.zeroize();
    }
}

struct NativeCredential {
    credential_id: Vec<u8>,
    entropy: Option<zeroize::Zeroizing<[u8; 32]>>,
}

fn parse_credential_id(encoded: &str) -> Result<Vec<u8>, &'static str> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    if encoded.is_empty() || encoded.len() > 2048 {
        return Err("passkey_invalid_credential");
    }
    URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| "passkey_invalid_credential")
}

fn encode_credential_id(id: &[u8]) -> Result<String, &'static str> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    if id.is_empty() || id.len() > 1536 {
        return Err("passkey_invalid_credential");
    }
    Ok(URL_SAFE_NO_PAD.encode(id))
}

fn derive_mnemonic(entropy: &[u8; 32]) -> Result<String, &'static str> {
    nostr::bip39::Mnemonic::from_entropy(entropy)
        .map(|phrase| phrase.to_string())
        .map_err(|_| "passkey_prf_unsupported")
}

#[tauri::command]
pub(crate) fn mainnet_passkey_capability() -> Capability {
    let reason = platform::capability().err();
    Capability {
        available: reason.is_none(),
        reason,
    }
}

#[tauri::command]
pub(crate) async fn mainnet_passkey_register() -> Result<Registered, &'static str> {
    platform::capability()?;
    let credential = platform::request(true, None).await?;
    super::mainnet_wallet::record_passkey_assertion(None)?;
    Ok(Registered {
        credential_id: encode_credential_id(&credential.credential_id)?,
    })
}

#[tauri::command]
pub(crate) async fn mainnet_passkey_derive(
    credential_id: Option<String>,
) -> Result<Derived, &'static str> {
    platform::capability()?;
    let expected = credential_id
        .as_deref()
        .map(parse_credential_id)
        .transpose()?;
    let credential = platform::request(false, expected.clone()).await?;
    if expected.is_some_and(|id| id != credential.credential_id) {
        return Err("passkey_invalid_credential");
    }
    let entropy = credential.entropy.ok_or("passkey_prf_unsupported")?;
    let derived = Derived {
        credential_id: encode_credential_id(&credential.credential_id)?,
        mnemonic: derive_mnemonic(&entropy)?,
    };
    super::mainnet_wallet::record_passkey_assertion(Some(&derived.mnemonic))?;
    Ok(derived)
}

#[cfg(all(target_os = "macos", feature = "macos-passkeys"))]
mod platform {
    use super::NativeCredential;
    use std::{ffi::c_void, ptr, slice};
    use tokio::sync::oneshot;
    use zeroize::Zeroizing;

    type Sender = oneshot::Sender<Result<NativeCredential, &'static str>>;
    type Completion = unsafe extern "C" fn(*mut c_void, i32, *const u8, usize, *const u8, usize);

    #[link(name = "KaleidoWalletPasskey", kind = "static")]
    extern "C" {
        fn kaleido_passkey_capability() -> i32;
        fn kaleido_passkey_request(
            register: bool,
            id: *const u8,
            len: usize,
            context: *mut c_void,
            complete: Completion,
        );
    }

    fn error(code: i32) -> &'static str {
        match code {
            1 => "passkey_macos_version",
            2 => "passkey_not_provisioned",
            3 => "passkey_cancelled",
            4 => "passkey_prf_unsupported",
            5 => "passkey_invalid_credential",
            6 => "passkey_busy",
            8 => "passkey_legacy_test",
            _ => "passkey_unavailable",
        }
    }

    pub(super) fn capability() -> Result<(), &'static str> {
        // Pure OS version and signed entitlement check; never opens a credential prompt.
        match unsafe { kaleido_passkey_capability() } {
            0 => Ok(()),
            code => Err(error(code)),
        }
    }

    unsafe extern "C" fn complete(
        context: *mut c_void,
        status: i32,
        id: *const u8,
        id_len: usize,
        key: *const u8,
        key_len: usize,
    ) {
        // Swift completes exactly once and keeps ID and key storage alive during this call.
        let sender = Box::from_raw(context.cast::<Sender>());
        let result = if status != 0 {
            Err(error(status))
        } else if id.is_null() || id_len == 0 || id_len > 1536 {
            Err("passkey_invalid_credential")
        } else {
            let entropy = match (key.is_null(), key_len) {
                (true, 0) => None,
                (false, 32) => {
                    let mut bytes = Zeroizing::new([0u8; 32]);
                    bytes.copy_from_slice(slice::from_raw_parts(key, key_len));
                    Some(bytes)
                }
                _ => {
                    let _ = sender.send(Err("passkey_prf_unsupported"));
                    return;
                }
            };
            Ok(NativeCredential {
                credential_id: slice::from_raw_parts(id, id_len).to_vec(),
                entropy,
            })
        };
        let _ = sender.send(result);
    }

    pub(super) async fn request(
        register: bool,
        id: Option<Vec<u8>>,
    ) -> Result<NativeCredential, &'static str> {
        let (sender, receiver) = oneshot::channel();
        let context = Box::into_raw(Box::new(sender)).cast();
        let id = id.as_deref().unwrap_or_default();
        // Swift synchronously copies the optional ID before scheduling UI work on the main queue.
        unsafe {
            kaleido_passkey_request(
                register,
                if id.is_empty() {
                    ptr::null()
                } else {
                    id.as_ptr()
                },
                id.len(),
                context,
                complete,
            );
        }
        receiver.await.map_err(|_| "passkey_unavailable")?
    }
}

#[cfg(not(all(target_os = "macos", feature = "macos-passkeys")))]
mod platform {
    use super::NativeCredential;

    pub(super) fn capability() -> Result<(), &'static str> {
        #[cfg(target_os = "macos")]
        {
            let major = sysinfo::System::os_version()
                .and_then(|v| v.split('.').next()?.parse::<u32>().ok());
            if major.is_some_and(|v| v < 15) {
                return Err("passkey_macos_version");
            }
            Err("passkey_not_provisioned")
        }
        #[cfg(not(target_os = "macos"))]
        // Win32 WebAuthn accepts a caller-supplied RP without Desktop origin binding.
        // Linux currently has no app-bound provider integrated for this RP either.
        Err("passkey_unsupported_platform")
    }

    pub(super) async fn request(
        _: bool,
        _: Option<Vec<u8>>,
    ) -> Result<NativeCredential, &'static str> {
        Err("passkey_unavailable")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "macos")]
    #[test]
    fn test_executable_without_a_provisioned_bundle_never_offers_the_prompt() {
        let capability = mainnet_passkey_capability();
        assert!(!capability.available);
        assert!(matches!(
            capability.reason,
            Some("passkey_not_provisioned" | "passkey_macos_version")
        ));
    }

    #[test]
    fn prf_entropy_matches_english_bip39_wallet_derivation() {
        assert_eq!(
            derive_mnemonic(&[0; 32]).unwrap(),
            format!("{}art", "abandon ".repeat(23))
        );
        assert_eq!(
            derive_mnemonic(&[255; 32]).unwrap(),
            format!("{}vote", "zoo ".repeat(23))
        );
    }

    #[test]
    fn accepts_only_canonical_base64url_credential_ids() {
        for invalid in ["", "a", "AB", "+/8=", "-_8="] {
            assert!(parse_credential_id(invalid).is_err());
        }
        assert!(parse_credential_id(&"A".repeat(2049)).is_err());
        assert_eq!(
            encode_credential_id(&parse_credential_id("-_8").unwrap()).unwrap(),
            "-_8"
        );
    }
}
