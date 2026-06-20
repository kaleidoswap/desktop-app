//! On-demand download + install of the KaleidoMind agent runtime.
//!
//! The packaged installer no longer bundles the ~1.7 GB agent (provider + mcp +
//! Node). The first time the user enables KaleidoMind we download the
//! per-platform tarball from the `mind-assets-*` GitHub release into the app's
//! data dir, verify its sha256, extract it, and point the sidecar env vars
//! (read by mind.rs) at it. Progress streams to the frontend via the
//! `mind-runtime` event. In dev the sidecar still uses the sibling repos.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

/// GitHub release tag the agent tarballs live under. Bump when the agent
/// (provider/mcp/@qvac) version changes and new assets are published.
const ASSETS_TAG: &str = "mind-assets-v0.6.0";
const ASSETS_REPO: &str = "kaleidoswap/desktop-app";
const RUNTIME_EVENT: &str = "mind-runtime";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeProgress {
    /// "downloading" | "verifying" | "extracting" | "done" | "error"
    phase: String,
    downloaded: u64,
    total: u64,
    message: Option<String>,
}

fn emit(app: &AppHandle, phase: &str, downloaded: u64, total: u64, message: Option<String>) {
    let _ = app.emit(
        RUNTIME_EVENT,
        RuntimeProgress {
            phase: phase.to_string(),
            downloaded,
            total,
            message,
        },
    );
}

/// `<app_data>/kaleidomind` — the tarball extracts a `mind/` dir under here.
fn install_root(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("kaleidomind"))
}

/// The staged tree root `<app_data>/kaleidomind/mind` (provider/, mcp/, node).
fn runtime_base(app: &AppHandle) -> Option<PathBuf> {
    install_root(app).map(|r| r.join("mind"))
}

fn provider_entry(base: &Path) -> PathBuf {
    base.join("provider")
        .join("node_modules")
        .join("@kaleidorg")
        .join("mind-provider")
        .join("dist")
        .join("index.js")
}

fn mcp_entry(base: &Path) -> PathBuf {
    base.join("mcp")
        .join("node_modules")
        .join("kaleido-mcp")
        .join("dist")
        .join("index.js")
}

fn node_bin(base: &Path) -> PathBuf {
    base.join(if cfg!(windows) { "node.exe" } else { "node" })
}

/// True once the runtime has been downloaded + extracted.
pub fn is_installed(app: &AppHandle) -> bool {
    runtime_base(app)
        .map(|b| provider_entry(&b).exists())
        .unwrap_or(false)
}

// Path resolvers for the downloaded runtime. mind.rs reads these at
// sidecar-start time and passes them to the CHILD via cmd.env(...) — we never
// mutate this process's own environment (std::env::set_var is not thread-safe).

/// The downloaded provider package dir (`…/mind-provider`, parent of `dist/`),
/// if a runtime has been installed.
pub fn provider_dir(app: &AppHandle) -> Option<PathBuf> {
    let provider = provider_entry(&runtime_base(app)?);
    if !provider.exists() {
        return None;
    }
    // …/mind-provider/dist/index.js → …/mind-provider
    provider
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
}

/// The downloaded kaleido-mcp entry (`dist/index.js`), if installed.
pub fn mcp_path(app: &AppHandle) -> Option<PathBuf> {
    let p = mcp_entry(&runtime_base(app)?);
    p.exists().then_some(p)
}

/// The downloaded bundled Node binary, if installed.
pub fn node_bin_path(app: &AppHandle) -> Option<PathBuf> {
    let p = node_bin(&runtime_base(app)?);
    p.exists().then_some(p)
}

fn asset_name() -> Result<String, String> {
    let plat = match std::env::consts::OS {
        "macos" => "darwin",
        "linux" => "linux",
        "windows" => "win",
        other => return Err(format!("unsupported OS: {other}")),
    };
    let arch = match std::env::consts::ARCH {
        "aarch64" => "arm64",
        "x86_64" => "x64",
        other => return Err(format!("unsupported arch: {other}")),
    };
    Ok(format!("kaleidomind-{plat}-{arch}.tar.gz"))
}

fn asset_url(name: &str) -> String {
    format!("https://github.com/{ASSETS_REPO}/releases/download/{ASSETS_TAG}/{name}")
}

/// Kick off the download+install on a background thread. Returns immediately;
/// progress + completion are reported via the `mind-runtime` event.
pub fn install(app: AppHandle) -> Result<(), String> {
    if is_installed(&app) {
        emit(&app, "done", 0, 0, None);
        return Ok(());
    }
    let name = asset_name()?;
    let root = install_root(&app).ok_or("no app data dir")?;
    std::thread::spawn(move || {
        if let Err(e) = do_install(&app, &name, &root) {
            log::error!("[mind] runtime install failed: {e}");
            emit(&app, "error", 0, 0, Some(e));
        }
    });
    Ok(())
}

fn do_install(app: &AppHandle, name: &str, root: &Path) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    let url = asset_url(name);
    let client = reqwest::blocking::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    // 1. Download the tarball, streaming with throttled progress events.
    emit(app, "downloading", 0, 0, None);
    let mut resp = client.get(&url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("download failed ({}) for {url}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(0);
    let archive = root.join(name);
    {
        let mut file = File::create(&archive).map_err(|e| e.to_string())?;
        let mut buf = vec![0u8; 1 << 16];
        let mut downloaded: u64 = 0;
        let mut last_emit: u64 = 0;
        loop {
            let n = resp.read(&mut buf).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
            downloaded += n as u64;
            if downloaded - last_emit >= 4 << 20 {
                last_emit = downloaded;
                emit(app, "downloading", downloaded, total, None);
            }
        }
        file.flush().map_err(|e| e.to_string())?;
        emit(app, "downloading", downloaded, total, None);
    }

    // 2. Verify sha256 against the published checksum.
    emit(app, "verifying", total, total, None);
    let want = client
        .get(format!("{url}.sha256"))
        .send()
        .and_then(|r| r.error_for_status())
        .and_then(|r| r.text())
        .map_err(|e| format!("checksum fetch failed: {e}"))?;
    let want = want.split_whitespace().next().unwrap_or("").to_lowercase();
    let got = sha256_file(&archive)?;
    if want.is_empty() || got != want {
        let _ = fs::remove_file(&archive);
        return Err(format!("checksum mismatch (want {want}, got {got})"));
    }

    // 3. Extract, replacing any previous install.
    emit(app, "extracting", total, total, None);
    let base = root.join("mind");
    let _ = fs::remove_dir_all(&base);
    let tar_gz = File::open(&archive).map_err(|e| e.to_string())?;
    let dec = flate2::read::GzDecoder::new(tar_gz);
    let mut ar = tar::Archive::new(dec);
    ar.unpack(root).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&archive);

    if !provider_entry(&base).exists() {
        return Err("extracted tree missing provider entry".into());
    }

    // Done — no env mutation needed: mind.rs resolves this path on the next
    // sidecar start (provider_dir/mcp_path/node_bin_path) and passes it to the
    // child process, so the agent starts without an app restart.
    emit(app, "done", total, total, None);
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 16];
    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}
