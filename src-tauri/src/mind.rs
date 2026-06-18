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
//! Sidecar launch (dev-spawn, no bundling yet) is resolved in this order:
//!   1. `$KALEIDO_MIND_CMD` (+ optional `$KALEIDO_MIND_ARGS`, space-separated)
//!   2. `node <dir>/dist/index.js`        if that build exists
//!   3. `pnpm start` with cwd = `<dir>`    (runs `tsx src/index.ts`)
//!
//! where `<dir>` is `$KALEIDO_MIND_PROVIDER_DIR` or a sibling-path guess.

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

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
        if self.is_running() {
            return Ok(());
        }

        let (program, args, cwd) = resolve_sidecar_command()?;
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

        // Point the sidecar at kaleido-mcp so the agent gets real tools.
        // Without KALEIDO_MCP_PATH the provider runs "tool-less" — the model
        // narrates tool calls ("I'll check your balance…") it can never execute.
        // The MCP server reads RLN_NODE_URL (default http://localhost:3001) +
        // KALEIDOSWAP_API_URL + WDK_SEED from the inherited env.
        match resolve_mcp_path() {
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

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("failed to spawn KaleidoMind sidecar ({}): {}", program, e))?;

        // Take the pipes.
        let child_stdin = child.stdin.take().ok_or("no stdin on sidecar")?;
        let stdout = child.stdout.take().ok_or("no stdout on sidecar")?;
        let stderr = child.stderr.take().ok_or("no stderr on sidecar")?;

        *self.stdin.lock().unwrap() = Some(child_stdin);
        *self.child.lock().unwrap() = Some(child);

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
fn resolve_sidecar_command() -> Result<(String, Vec<String>, Option<PathBuf>), String> {
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
    let dir = resolve_provider_dir()
        .ok_or("KaleidoMind provider dir not found — set KALEIDO_MIND_PROVIDER_DIR")?;

    let dist_entry = dir.join("dist").join("index.js");
    if dist_entry.exists() {
        return Ok((
            "node".to_string(),
            vec![dist_entry.to_string_lossy().to_string()],
            Some(dir),
        ));
    }

    // Fall back to running the package's start script (tsx src/index.ts).
    Ok(("pnpm".to_string(), vec!["start".to_string()], Some(dir)))
}

/// Find the apps/provider directory: env override, then sibling-path guesses
/// relative to the current working directory (works under `tauri dev`).
fn resolve_provider_dir() -> Option<PathBuf> {
    if let Ok(d) = std::env::var("KALEIDO_MIND_PROVIDER_DIR") {
        let p = PathBuf::from(d);
        if p.join("package.json").exists() {
            return Some(p);
        }
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

/// Resolve the kaleido-mcp entry (`dist/index.js`) the sidecar connects as its
/// tool source. `$KALEIDO_MCP_PATH` override first, then sibling-path guesses
/// (`../kaleido-mcp/dist/index.js`) relative to the cwd — mirrors
/// [`resolve_provider_dir`]. Returns `None` if no built MCP is found.
fn resolve_mcp_path() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("KALEIDO_MCP_PATH") {
        let pb = PathBuf::from(p.trim());
        if pb.exists() {
            return Some(pb);
        }
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
