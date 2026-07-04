//! KaleidoMind sidecar bridge.
//!
//! Supervises the `@kaleidorg/mind-provider` Node sidecar (apps/provider) and
//! relays its line-delimited JSON protocol (see apps/provider/src/protocol.ts):
//!   - Commands  (Tauri → sidecar) are written to the child's stdin.
//!   - Events    (sidecar → Tauri) are read from stdout and re-emitted to the
//!     webview as the `mind-event` Tauri event (the JSON is forwarded verbatim).
//!   - stderr is human-readable diagnostics → forwarded to the Tauri log.
//!
//! Rust stays a transparent pipe; all protocol/model logic lives in TS. The
//! sidecar runs the QVAC model, the P2P provider (for phone delegation), skills
//! and MCP tools.
//!
//! Sidecar launch is resolved in this order:
//!   1. `$KALEIDO_MIND_CMD` (+ optional `$KALEIDO_MIND_ARGS`, space-separated)
//!   2. `node <dir>/dist/index.js`        if that build exists
//!   3. `pnpm start` with cwd = `<dir>`    (runs `tsx src/index.ts`)
//!
//! where `<dir>` is `$KALEIDO_MIND_PROVIDER_DIR` (override), the on-demand
//! runtime downloaded into app data (mind_runtime), or a dev sibling-path guess.
//! Resolution happens at start time and is passed to the child via cmd.env —
//! we never mutate this process's own environment.

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
        let mut guard = self.child.lock().unwrap();
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
        let mut child_guard = self.child.lock().unwrap();
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

        // Conservative desktop defaults for local reasoning. Users can still
        // override these through the inherited environment or Agent settings.
        if std::env::var_os("KALEIDO_MIND_MAX_THINKING_TOKENS").is_none() {
            cmd.env("KALEIDO_MIND_MAX_THINKING_TOKENS", "128");
        }
        if std::env::var_os("KALEIDO_MIND_MAX_TOKENS").is_none() {
            cmd.env("KALEIDO_MIND_MAX_TOKENS", "512");
        }

        // Point the sidecar at kaleido-mcp so the agent gets real tools.
        // Without KALEIDO_MCP_PATH the provider runs "tool-less" — the model
        // narrates tool calls ("I'll check your balance…") it can never execute.
        // The MCP server reads RLN_NODE_URL (default http://localhost:3001) +
        // KALEIDOSWAP_API_URL + WDK_SEED from the inherited env.
        match resolve_mcp_path(app) {
            Some(mcp) => {
                log::info!("[mind] KALEIDO_MCP_PATH={}", mcp.display());
                cmd.env("KALEIDO_MCP_PATH", mcp);
            }
            None => log::warn!(
                "[mind] kaleido-mcp not found — chat runs tool-less; set KALEIDO_MCP_PATH"
            ),
        }

        // Point the MCP server at the ACTIVE node so balances/channels work for
        // remote nodes too — not just the localhost:3001 default. The current
        // account's node_url is the RLN node HTTP API the rest of the app uses.
        if let Some(url) = app
            .try_state::<crate::CurrentAccount>()
            .and_then(|acc| {
                acc.0
                    .read()
                    .ok()
                    .and_then(|g| g.as_ref().map(|a| a.node_url.clone()))
            })
            .filter(|u| !u.trim().is_empty())
        {
            log::info!("[mind] RLN_NODE_URL={}", url);
            cmd.env("RLN_NODE_URL", url);
        }

        // Point the MCP at the SAME maker the trading UI uses. kaleido-mcp
        // defaults to mainnet api.kaleidoswap.com, which doesn't resolve on the
        // test networks (signet/regtest) — so without this the LSP + swap tools
        // "fetch failed". Source it from the active account's default_maker_url
        // (e.g. https://api.signet.kaleidoswap.com), trimming any trailing slash
        // so the SDK's "/api/v1/lsps1/*" paths don't double up.
        if let Some(url) = app
            .try_state::<crate::CurrentAccount>()
            .and_then(|acc| {
                acc.0
                    .read()
                    .ok()
                    .and_then(|g| g.as_ref().map(|a| a.default_maker_url.clone()))
            })
            .map(|u| u.trim().trim_end_matches('/').to_string())
            .filter(|u| !u.is_empty())
        {
            log::info!("[mind] KALEIDOSWAP_API_URL={}", url);
            cmd.env("KALEIDOSWAP_API_URL", url);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("failed to spawn KaleidoMind sidecar ({}): {}", program, e))?;

        // Take the pipes.
        let child_stdin = child.stdin.take().ok_or("no stdin on sidecar")?;
        let stdout = child.stdout.take().ok_or("no stdout on sidecar")?;
        let stderr = child.stderr.take().ok_or("no stderr on sidecar")?;

        *self.stdin.lock().unwrap() = Some(child_stdin);
        *child_guard = Some(child);
        drop(child_guard);

        // stdout → forward each JSON line to the webview as `mind-event`.
        let app_out = app.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
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
        let mut guard = self.stdin.lock().unwrap();
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
        *self.stdin.lock().unwrap() = None;
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
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

/// Whether the sidecar can resolve a provider to run — true if a runtime has
/// been downloaded OR the dev sibling repos are present. Used by the UI to
/// decide whether the on-demand download is needed before showing KaleidoMind.
pub fn provider_available(app: &AppHandle) -> bool {
    resolve_provider_dir(app).is_some()
}

/// Find the provider dir: `KALEIDO_MIND_PROVIDER_DIR` override (read-only) → a
/// downloaded runtime in app data → dev sibling repos relative to the cwd.
fn resolve_provider_dir(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(d) = std::env::var("KALEIDO_MIND_PROVIDER_DIR") {
        let p = PathBuf::from(d);
        if p.join("package.json").exists() {
            return Some(p);
        }
    }
    if let Some(p) = crate::mind_runtime::provider_dir(app) {
        return Some(p);
    }
    let rel = ["apps", "provider"];
    let cwd = std::env::current_dir().ok()?;
    // Candidate roots: cwd, parent, grandparent — each + ../kaleido-mind.
    for base in [
        Some(cwd.clone()),
        cwd.parent().map(PathBuf::from),
        cwd.parent().and_then(|p| p.parent()).map(PathBuf::from),
    ]
    .into_iter()
    .flatten()
    {
        let candidate = base.join("kaleido-mind").join(rel[0]).join(rel[1]);
        if candidate.join("package.json").exists() {
            return Some(candidate);
        }
    }
    None
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
