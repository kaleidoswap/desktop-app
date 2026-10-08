//! KaleidoMind sidecar bridge.
//!
//! Supervises the `@kaleidorg/mind-provider` Node sidecar and relays its
//! line-delimited JSON protocol (apps/provider/src/protocol.ts): commands go to
//! the child's stdin, stdout events are re-emitted verbatim as the `mind-event`
//! Tauri event, stderr goes to the Tauri log. Rust stays a transparent pipe —
//! all protocol/model logic lives in TS.
//!
//! Launch resolution order:
//!   1. `$KALEIDO_MIND_CMD` (+ optional space-separated `$KALEIDO_MIND_ARGS`)
//!   2. `node <dir>/dist/index.js`, if that build exists
//!   3. `pnpm start` with cwd = `<dir>`
//!
//! `<dir>` is `$KALEIDO_MIND_PROVIDER_DIR`, the downloaded runtime
//! (mind_runtime), or (debug builds) a dev sibling with @qvac/sdk. Resolved at start time and
//! passed to the child via cmd.env — never by mutating our own environment.

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
/// `CREATE_NO_WINDOW` — prevent a console window from flashing on Windows.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub const MIND_EVENT: &str = "mind-event";

const DESKTOP_SKILLS: &str = "rgb-lightning-node,channel-manager,kaleido-trading,portfolio-manager";
const DESKTOP_TOOL_PREFIXES: &str = "rln_,kaleidoswap_,get_price,get_market_data";

/// Supervises the single Node sidecar child process + its stdin handle.
#[derive(Default)]
pub struct MindProcess {
    child: Arc<Mutex<Option<Child>>>,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
}

impl MindProcess {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_running(&self) -> bool {
        let mut guard = self
            .child
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        match guard.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(Some(_)) => false, // exited
                Ok(None) => true,     // still running
                Err(_) => false,
            },
            None => false,
        }
    }

    /// Spawn the sidecar if it isn't already running, wiring stdout→events and
    /// stderr→log reader threads. Idempotent.
    pub fn ensure_started(&self, app: &AppHandle) -> Result<(), String> {
        // Hold the child lock for the entire check-and-spawn to prevent a race
        // where two concurrent callers both observe is_running()==false and each
        // try to spawn, producing multiple visible console windows on Windows.
        let mut child_guard = self
            .child
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let already_running = match child_guard.as_mut() {
            Some(c) => matches!(c.try_wait(), Ok(None)),
            None => false,
        };
        if already_running {
            return Ok(());
        }

        let (program, args, cwd) = resolve_sidecar_command(app)?;
        log::info!(
            "[mind] spawning sidecar: {} {} (cwd: {:?})",
            program,
            args.join(" "),
            cwd
        );

        let mut cmd = Command::new(&program);
        cmd.args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(dir) = &cwd {
            cmd.current_dir(dir);
        }
        // Suppress the console window that `node` / `pnpm` would otherwise
        // open on Windows whenever the sidecar is (re-)spawned.
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        // The desktop wallet is backed by RLN only. Keep legacy WDK/Spark
        // aliases out of the model's tool prompt so small local models do not
        // waste tokens choosing between duplicate wallet implementations.
        cmd.env("KALEIDO_MIND_RLN_ONLY", "1");
        // Only the RGB, RGB Lightning and KaleidoSwap skills and tools; the
        // Spark, Flashnet, Liquid, Bitrefill and paywall ones have no backing
        // wallet here.
        cmd.env("KALEIDO_MIND_SKILLS", DESKTOP_SKILLS);
        cmd.env("KALEIDO_MIND_TOOL_PREFIXES", DESKTOP_TOOL_PREFIXES);

        // Desktop defaults for local reasoning; the Agent tab changes them live.
        // The response cap is never removed so a turn cannot run away.
        if std::env::var_os("KALEIDO_MIND_MAX_THINKING_TOKENS").is_none() {
            cmd.env("KALEIDO_MIND_MAX_THINKING_TOKENS", "1024");
        }
        if std::env::var_os("KALEIDO_MIND_MAX_TOKENS").is_none() {
            cmd.env("KALEIDO_MIND_MAX_TOKENS", "4096");
        }
        if std::env::var_os("KALEIDO_MIND_MAX_TOKENS_CEILING").is_none() {
            cmd.env("KALEIDO_MIND_MAX_TOKENS_CEILING", "8192");
        }

        // Point the sidecar at kaleido-mcp so the agent gets real tools.
        // Without KALEIDO_MCP_PATH the provider runs "tool-less" — the model
        // narrates tool calls ("I'll check your balance…") it can never execute.
        // The MCP server's node/maker/network env comes from apply_account_env.
        match resolve_mcp_path(app) {
            Some(mcp) => {
                log::info!("[mind] KALEIDO_MCP_PATH={}", mcp.display());
                cmd.env("KALEIDO_MCP_PATH", mcp);
            }
            None => log::warn!(
                "[mind] kaleido-mcp not found — chat runs tool-less; set KALEIDO_MCP_PATH"
            ),
        }

        let account = app
            .try_state::<crate::CurrentAccount>()
            .and_then(|acc| acc.0.read().ok().and_then(|g| g.clone()));
        if let Some(account) = account {
            apply_account_env(&mut cmd, &account);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("failed to spawn KaleidoMind sidecar ({}): {}", program, e))?;

        // Take the pipes.
        let child_stdin = child.stdin.take().ok_or("no stdin on sidecar")?;
        let stdout = child.stdout.take().ok_or("no stdout on sidecar")?;
        let stderr = child.stderr.take().ok_or("no stderr on sidecar")?;

        *self
            .stdin
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(child_stdin);
        *child_guard = Some(child);
        drop(child_guard);

        // stdout → forward each JSON line to the webview as `mind-event`.
        let app_out = app.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            let mut warned_mock = false;
            for line in reader.lines() {
                let line = match line {
                    Ok(l) => l,
                    Err(_) => break,
                };
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                match serde_json::from_str::<serde_json::Value>(trimmed) {
                    Ok(value) => {
                        if !warned_mock && is_mock_status(&value) {
                            warned_mock = true;
                            log::warn!(
                                "[mind] sidecar is in MOCK mode (no @qvac/sdk) — chat replies are fake"
                            );
                        }
                        let _ = app_out.emit(MIND_EVENT, value);
                    }
                    Err(e) => {
                        log::warn!("[mind] non-JSON stdout line: {} ({})", trimmed, e);
                    }
                }
            }
            log::info!("[mind] sidecar stdout closed");
        });

        // stderr → Tauri log (diagnostics only).
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                if !line.trim().is_empty() {
                    log::info!("[mind:sidecar] {}", line);
                }
            }
        });

        Ok(())
    }

    /// Write one JSON command line to the sidecar's stdin.
    pub fn send(&self, app: &AppHandle, payload: &serde_json::Value) -> Result<(), String> {
        self.ensure_started(app)?;
        let mut guard = self
            .stdin
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let stdin = guard.as_mut().ok_or("sidecar stdin not available")?;
        let mut line = serde_json::to_string(payload).map_err(|e| e.to_string())?;
        line.push('\n');
        stdin
            .write_all(line.as_bytes())
            .map_err(|e| format!("failed to write to sidecar: {}", e))?;
        stdin.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Kill the sidecar (best-effort) and drop the pipes.
    pub fn stop(&self) {
        *self
            .stdin
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = None;
        if let Some(mut child) = self
            .child
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take()
        {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// kaleido-mcp only knows `mainnet` and `signet`; every test network maps to
/// `signet` and the explicit KALEIDOSWAP_API_URL / RGB_PROXY_ENDPOINT below
/// override its defaults.
fn mcp_network(network: &str) -> &'static str {
    if network.eq_ignore_ascii_case("mainnet") {
        "mainnet"
    } else {
        "signet"
    }
}

/// Point kaleido-mcp at the ACTIVE account: its RLN node, the maker the
/// trading UI uses, its RGB proxy and the matching network preset. On mainnet
/// kaleido-mcp has no default maker and exits without KALEIDOSWAP_API_URL.
fn apply_account_env(cmd: &mut Command, account: &crate::db::Account) {
    let network = mcp_network(&account.network);
    log::info!("[mind] KALEIDO_NETWORK={} ({})", network, account.network);
    cmd.env("KALEIDO_NETWORK", network);

    let node_url = account.node_url.trim();
    if !node_url.is_empty() {
        log::info!("[mind] RLN_NODE_URL={}", node_url);
        cmd.env("RLN_NODE_URL", node_url);
    }

    // Trim the trailing slash so the SDK's "/api/v1/lsps1/*" paths don't double up.
    let maker_url = account.default_maker_url.trim().trim_end_matches('/');
    if !maker_url.is_empty() {
        log::info!("[mind] KALEIDOSWAP_API_URL={}", maker_url);
        cmd.env("KALEIDOSWAP_API_URL", maker_url);
    } else if network == "mainnet" {
        log::warn!(
            "[mind] no maker URL on mainnet — kaleido-mcp will not start; chat runs tool-less"
        );
    }

    let proxy = account.proxy_endpoint.trim();
    if !proxy.is_empty() {
        cmd.env("RGB_PROXY_ENDPOINT", proxy);
    }
}

/// Resolve `(program, args, cwd)` for launching the sidecar (see module docs).
fn resolve_sidecar_command(
    app: &AppHandle,
) -> Result<(String, Vec<String>, Option<PathBuf>), String> {
    // 1. Explicit command override.
    if let Ok(cmd) = std::env::var("KALEIDO_MIND_CMD") {
        let cmd = cmd.trim().to_string();
        if !cmd.is_empty() {
            let args = std::env::var("KALEIDO_MIND_ARGS")
                .ok()
                .map(|a| a.split_whitespace().map(String::from).collect())
                .unwrap_or_default();
            let cwd = std::env::var("KALEIDO_MIND_PROVIDER_DIR")
                .ok()
                .map(PathBuf::from);
            return Ok((cmd, args, cwd));
        }
    }

    // 2/3. Resolve the provider directory, then prefer a built dist over pnpm.
    let dir = resolve_provider_dir(app)
        .ok_or("KaleidoMind provider dir not found — set KALEIDO_MIND_PROVIDER_DIR")?;

    let dist_entry = dir.join("dist").join("index.js");
    if dist_entry.exists() {
        // Prefer the Node runtime shipped with a downloaded agent (or the
        // KALEIDO_NODE_BIN override) so a packaged build doesn't need system
        // Node; fall back to `node` on PATH for dev.
        let node = std::env::var("KALEIDO_NODE_BIN")
            .ok()
            .filter(|p| !p.trim().is_empty())
            .or_else(|| {
                crate::mind_runtime::node_bin_path(app).map(|p| p.to_string_lossy().into_owned())
            })
            .unwrap_or_else(|| "node".to_string());
        return Ok((
            node,
            vec![dist_entry.to_string_lossy().to_string()],
            Some(dir),
        ));
    }

    // Fall back to running the package's start script (tsx src/index.ts).
    Ok(("pnpm".to_string(), vec!["start".to_string()], Some(dir)))
}

/// Whether the sidecar can resolve a provider to run — true if a current
/// runtime has been downloaded, or (debug builds only) a dev sibling checkout
/// that can actually load @qvac/sdk is present. Used by the UI to decide
/// whether the on-demand download is needed before showing KaleidoMind.
pub fn provider_available(app: &AppHandle) -> bool {
    resolve_provider_dir(app).is_some()
}

/// Find the provider dir: `KALEIDO_MIND_PROVIDER_DIR` override → the current
/// downloaded runtime → (debug builds only, no stale runtime) a dev sibling
/// `../kaleido-mind/apps/provider` that has @qvac/sdk installed.
fn resolve_provider_dir(app: &AppHandle) -> Option<PathBuf> {
    pick_provider_dir(
        std::env::var("KALEIDO_MIND_PROVIDER_DIR")
            .ok()
            .map(PathBuf::from),
        crate::mind_runtime::provider_dir(app),
        crate::mind_runtime::is_stale(app),
        cfg!(debug_assertions),
        std::env::current_dir().ok(),
    )
}

fn pick_provider_dir(
    override_dir: Option<PathBuf>,
    runtime_dir: Option<PathBuf>,
    runtime_stale: bool,
    allow_dev_sibling: bool,
    cwd: Option<PathBuf>,
) -> Option<PathBuf> {
    if let Some(p) = override_dir {
        if p.join("package.json").exists() {
            return Some(p);
        }
    }
    if runtime_dir.is_some() {
        return runtime_dir;
    }
    if !allow_dev_sibling || runtime_stale {
        return None;
    }
    let cwd = cwd?;
    [
        Some(cwd.clone()),
        cwd.parent().map(PathBuf::from),
        cwd.parent().and_then(|p| p.parent()).map(PathBuf::from),
    ]
    .into_iter()
    .flatten()
    .map(|base| base.join("kaleido-mind").join("apps").join("provider"))
    .find(|c| c.join("package.json").exists() && has_qvac_sdk(c))
}

/// Without @qvac/sdk the provider silently falls back to MOCK mode, so a dev
/// sibling only counts if pnpm installed it (package-local or hoisted to the
/// workspace root).
fn has_qvac_sdk(provider_dir: &std::path::Path) -> bool {
    let rel = ["node_modules", "@qvac", "sdk", "package.json"];
    let local = rel
        .iter()
        .fold(provider_dir.to_path_buf(), |p, s| p.join(s));
    let hoisted = provider_dir
        .parent()
        .and_then(|p| p.parent())
        .map(|root| rel.iter().fold(root.to_path_buf(), |p, s| p.join(s)));
    local.exists() || hoisted.is_some_and(|h| h.exists())
}

/// True for a `status` event whose inference backend is the provider's MOCK
/// fallback (no @qvac/sdk — every reply is fake).
fn is_mock_status(value: &serde_json::Value) -> bool {
    value.get("type").and_then(|t| t.as_str()) == Some("status")
        && value.get("inferenceDevice").and_then(|d| d.as_str()) == Some("mock")
}

/// Resolve the kaleido-mcp entry (`dist/index.js`) passed to the sidecar child:
/// `$KALEIDO_MCP_PATH` override → a downloaded runtime → dev sibling guesses.
/// Returns `None` if no built MCP is found.
fn resolve_mcp_path(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(p) = std::env::var("KALEIDO_MCP_PATH") {
        let pb = PathBuf::from(p.trim());
        if pb.exists() {
            return Some(pb);
        }
    }
    if let Some(p) = crate::mind_runtime::mcp_path(app) {
        return Some(p);
    }
    let cwd = std::env::current_dir().ok()?;
    for base in [
        Some(cwd.clone()),
        cwd.parent().map(PathBuf::from),
        cwd.parent().and_then(|p| p.parent()).map(PathBuf::from),
    ]
    .into_iter()
    .flatten()
    {
        let candidate = base.join("kaleido-mcp").join("dist").join("index.js");
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::{is_mock_status, mcp_network, pick_provider_dir};
    use std::fs;
    use std::path::{Path, PathBuf};

    fn tmp(name: &str) -> PathBuf {
        let d =
            std::env::temp_dir().join(format!("kaleido-mind-test-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn touch(p: &Path) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, "{}").unwrap();
    }

    /// `<root>/app` is the cwd; `<root>/kaleido-mind/apps/provider` the sibling.
    fn sibling(root: &Path, with_qvac: bool) -> PathBuf {
        let provider = root.join("kaleido-mind").join("apps").join("provider");
        touch(&provider.join("package.json"));
        if with_qvac {
            touch(&provider.join("node_modules/@qvac/sdk/package.json"));
        }
        fs::create_dir_all(root.join("app")).unwrap();
        provider
    }

    #[test]
    fn sibling_without_qvac_is_ignored() {
        let root = tmp("no-qvac");
        sibling(&root, false);
        assert_eq!(
            pick_provider_dir(None, None, false, true, Some(root.join("app"))),
            None
        );
    }

    #[test]
    fn stale_runtime_never_falls_back_to_sibling() {
        let root = tmp("stale");
        sibling(&root, true);
        assert_eq!(
            pick_provider_dir(None, None, true, true, Some(root.join("app"))),
            None
        );
    }

    #[test]
    fn sibling_requires_debug_build() {
        let root = tmp("release");
        sibling(&root, true);
        assert_eq!(
            pick_provider_dir(None, None, false, false, Some(root.join("app"))),
            None
        );
    }

    #[test]
    fn sibling_with_qvac_is_used_in_debug() {
        let root = tmp("qvac");
        let provider = sibling(&root, true);
        assert_eq!(
            pick_provider_dir(None, None, false, true, Some(root.join("app"))),
            Some(provider)
        );
    }

    #[test]
    fn sibling_with_hoisted_qvac_is_used_in_debug() {
        let root = tmp("hoisted");
        let provider = sibling(&root, false);
        touch(&root.join("kaleido-mind/node_modules/@qvac/sdk/package.json"));
        assert_eq!(
            pick_provider_dir(None, None, false, true, Some(root.join("app"))),
            Some(provider)
        );
    }

    #[test]
    fn override_dir_wins() {
        let root = tmp("override");
        let over = root.join("custom");
        touch(&over.join("package.json"));
        let runtime = root.join("runtime");
        assert_eq!(
            pick_provider_dir(
                Some(over.clone()),
                Some(runtime),
                true,
                false,
                Some(root.join("app"))
            ),
            Some(over)
        );
    }

    #[test]
    fn current_runtime_beats_sibling() {
        let root = tmp("runtime");
        sibling(&root, true);
        let runtime = root.join("runtime");
        assert_eq!(
            pick_provider_dir(
                None,
                Some(runtime.clone()),
                false,
                true,
                Some(root.join("app"))
            ),
            Some(runtime)
        );
    }

    #[test]
    fn detects_mock_status() {
        let mock = serde_json::json!({"type": "status", "inferenceDevice": "mock"});
        let gpu = serde_json::json!({"type": "status", "inferenceDevice": "gpu"});
        assert!(is_mock_status(&mock));
        assert!(!is_mock_status(&gpu));
    }

    #[test]
    fn maps_app_networks_to_mcp_presets() {
        assert_eq!(mcp_network("Mainnet"), "mainnet");
        for n in [
            "SignetCustom",
            "Signet",
            "Testnet",
            "Regtest",
            "LocalRegtest",
        ] {
            assert_eq!(mcp_network(n), "signet");
        }
    }
}
