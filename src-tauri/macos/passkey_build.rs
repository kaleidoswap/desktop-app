//! Compile the opt-in AuthenticationServices bridge with the target SDK and architecture.
use std::{env, path::PathBuf, process::Command};

pub fn compile() {
    let source = "macos/WalletPasskey.swift";
    println!("cargo:rerun-if-changed={source}");
    println!("cargo:rerun-if-changed=macos/passkey_build.rs");
    println!("cargo:rerun-if-env-changed=DEVELOPER_DIR");
    println!("cargo:rerun-if-env-changed=MACOSX_DEPLOYMENT_TARGET");
    let out = PathBuf::from(env::var_os("OUT_DIR").unwrap());
    let (arch, minimum) = match env::var("CARGO_CFG_TARGET_ARCH").unwrap().as_str() {
        "x86_64" => ("x86_64", "10.15"),
        "aarch64" => ("arm64", "11.0"),
        arch => panic!("Unsupported macOS passkey architecture {arch}"),
    };
    let target = format!("{arch}-apple-macosx{minimum}");
    let sdk = Command::new("xcrun")
        .args(["--sdk", "macosx", "--show-sdk-path"])
        .output()
        .expect("Xcode 16 or later is required for macOS passkeys");
    assert!(sdk.status.success(), "macOS SDK unavailable");
    let sdk = PathBuf::from(String::from_utf8(sdk.stdout).unwrap().trim());
    let status = Command::new("xcrun")
        .args([
            "--sdk",
            "macosx",
            "swiftc",
            "-swift-version",
            "5",
            "-parse-as-library",
            "-O",
            "-emit-library",
            "-static",
            "-module-name",
            "KaleidoWalletPasskey",
            "-target",
            &target,
            "-sdk",
        ])
        .arg(&sdk)
        .arg("-module-cache-path")
        .arg(out.join("swift-modules"))
        .args([source, "-o"])
        .arg(out.join("libKaleidoWalletPasskey.a"))
        .status()
        .expect("Could not invoke the Apple Swift compiler");
    assert!(
        status.success(),
        "Building the macOS passkey bridge requires the macOS 15 SDK or later"
    );
    // rustc links with clang, so supply Swift's runtime and compatibility library paths.
    let info = Command::new("xcrun")
        .args([
            "--sdk",
            "macosx",
            "swiftc",
            "-print-target-info",
            "-target",
            &target,
        ])
        .output()
        .expect("Could not locate Swift runtime libraries");
    assert!(info.status.success());
    let info: serde_json::Value = serde_json::from_slice(&info.stdout).unwrap();
    for path in info["paths"]["runtimeLibraryPaths"].as_array().unwrap() {
        println!("cargo:rustc-link-search=native={}", path.as_str().unwrap());
    }
    println!(
        "cargo:rustc-link-search=native={}",
        sdk.join("usr/lib/swift").display()
    );
    println!("cargo:rustc-link-search=native={}", out.display());
    println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
}
