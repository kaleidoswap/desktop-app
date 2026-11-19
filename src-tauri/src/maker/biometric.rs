//! Ask the person at the keyboard (Touch ID, Apple Watch, or the login password as the OS offers)
//! before the signing policy is signed. macOS only; elsewhere there is nothing to ask and the
//! policy is signed without a prompt.

/// `Ok(true)` once the user authenticated, `Ok(false)` where the OS has no such prompt, `Err` when
/// the user cancelled or authentication failed.
#[cfg(target_os = "macos")]
pub fn authenticate(reason: &str) -> Result<bool, String> {
    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_foundation::{NSError, NSString};
    use objc2_local_authentication::{LAContext, LAPolicy};
    use std::sync::mpsc;
    use std::time::Duration;

    // device-owner authentication: biometrics, falling back to the Watch or the login password,
    // so it also works on a Mac without Touch ID
    let policy = LAPolicy::DeviceOwnerAuthentication;
    let ctx = unsafe { LAContext::new() };
    if unsafe { ctx.canEvaluatePolicy_error(policy) }.is_err() {
        return Ok(false);
    }
    let (tx, rx) = mpsc::channel::<Result<(), String>>();
    let reply = RcBlock::new(move |ok: Bool, err: *mut NSError| {
        let out = if ok.as_bool() {
            Ok(())
        } else if err.is_null() {
            Err("authentication failed".to_string())
        } else {
            Err(unsafe { &*err }.localizedDescription().to_string())
        };
        let _ = tx.send(out);
    });
    unsafe {
        ctx.evaluatePolicy_localizedReason_reply(policy, &NSString::from_str(reason), &reply)
    };
    rx.recv_timeout(Duration::from_secs(120))
        .map_err(|_| "no answer to the authentication prompt".to_string())??;
    Ok(true)
}

#[cfg(not(target_os = "macos"))]
pub fn authenticate(_reason: &str) -> Result<bool, String> {
    Ok(false)
}
