use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs::File;
use std::io;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;
use tauri::{AppHandle, Emitter, WebviewWindow};

const SHUTDOWN_TIMEOUT_SECS: u64 = 5;
const STARTUP_TIMEOUT_SECS: u64 = 30;
const MAX_LOGS_IN_MEMORY: usize = 1000;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", content = "message")]
pub enum NodeState {
    Stopped,
    Starting,
    Running,
    Stopping,
    Failed(String),
}

#[derive(Debug)]
enum ControlMessage {
    Stop,
}

pub struct NodeProcess {
    child_process: Arc<Mutex<Option<Child>>>,
    control_sender: Sender<ControlMessage>,
    control_receiver: Arc<Mutex<Receiver<ControlMessage>>>,
    state: Arc<RwLock<NodeState>>,
    logs: Arc<Mutex<Vec<String>>>,
    window: Arc<Mutex<Option<WebviewWindow>>>,
    shutdown_timeout: Duration,
    current_account: Arc<Mutex<Option<String>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    daemon_port: Arc<Mutex<Option<u16>>>,
}

impl NodeProcess {
    pub fn new() -> Self {
        let (tx, rx) = channel();
        NodeProcess {
            child_process: Arc::new(Mutex::new(None)),
            control_sender: tx,
            control_receiver: Arc::new(Mutex::new(rx)),
            state: Arc::new(RwLock::new(NodeState::Stopped)),
            logs: Arc::new(Mutex::new(Vec::new())),
            window: Arc::new(Mutex::new(None)),
            shutdown_timeout: Duration::from_secs(SHUTDOWN_TIMEOUT_SECS),
            current_account: Arc::new(Mutex::new(None)),
            app_handle: Arc::new(Mutex::new(None)),
            daemon_port: Arc::new(Mutex::new(None)),
        }
    }

    /// Check if local RGB Lightning Node is supported on this platform
    pub fn is_local_node_supported() -> bool {
        !cfg!(target_os = "windows")
    }

    pub fn set_window(&self, window: WebviewWindow) {
        *self.window.lock().unwrap() = Some(window.clone());
        *self.app_handle.lock().unwrap() = Some(window.app_handle().clone());
    }

    /// Check if a port is available
    pub fn is_port_available(port: u16) -> bool {
        // Check both 127.0.0.1 and 0.0.0.0 — on macOS with SO_REUSEADDR,
        // binding 127.0.0.1 can succeed even when 0.0.0.0 is already bound.
        TcpListener::bind(("127.0.0.1", port)).is_ok()
            && TcpListener::bind(("0.0.0.0", port)).is_ok()
    }

    /// Get a list of available ports starting from a base port
    pub fn find_available_ports(base_daemon_port: u16, base_ldk_port: u16) -> (u16, u16) {
        let mut daemon_port = base_daemon_port;
        let mut ldk_port = base_ldk_port;

        // Try up to 10 port numbers after the base ports
        for i in 0..10 {
            if Self::is_port_available(daemon_port + i) {
                daemon_port += i;
                break;
            }
        }

        for i in 0..10 {
            if Self::is_port_available(ldk_port + i) {
                ldk_port += i;
                break;
            }
        }

        (daemon_port, ldk_port)
    }

    /// Get the daemon HTTP port for the currently running node
    pub fn get_daemon_port(&self) -> Option<u16> {
        self.daemon_port.lock().ok().and_then(|g| *g)
    }

    /// Get the current running node's ports
    pub fn get_running_node_ports(&self) -> HashMap<String, String> {
        let mut ports = HashMap::new();
        if let Ok(guard) = self.child_process.lock() {
            if guard.as_ref().is_some() {
                if let Ok(account_guard) = self.current_account.lock() {
                    if let Some(account) = account_guard.as_ref() {
                        if let Ok(Some(account_info)) = crate::db::get_account_by_name(account) {
                            ports.insert(account_info.daemon_listening_port, account.clone());
                            ports.insert(account_info.ldk_peer_listening_port, account.clone());
                        }
                    }
                }
            }
        }
        ports
    }

    /// Get current node state
    pub fn get_state(&self) -> NodeState {
        match self.state.read() {
            Ok(state) => state.clone(),
            Err(e) => {
                println!("Failed to read state: {}", e);
                NodeState::Failed("State lock poisoned".to_string())
            }
        }
    }

    /// Set node state
    fn set_state(&self, new_state: NodeState) {
        if let Ok(mut state) = self.state.write() {
            println!("Node state transition: {:?} -> {:?}", *state, new_state);
            *state = new_state.clone();
        }

        if let Ok(window_guard) = self.window.lock() {
            if let Some(window) = window_guard.as_ref() {
                let _ = window.emit("node-state-changed", new_state.clone());
            }
        }
        if let Ok(app_handle_guard) = self.app_handle.lock() {
            if let Some(app_handle) = app_handle_guard.as_ref() {
                let _ = app_handle.emit("node-state-changed", new_state);
            }
        }
    }

    /// Stop a specific node by account name
    pub fn stop_by_account(&self, account_name: &str) -> Result<(), String> {
        if let Some(current_account) = self.get_current_account() {
            if current_account == account_name {
                self.stop();
                Ok(())
            } else {
                Err(format!("Node for account {} is not running", account_name))
            }
        } else {
            Err("No node is currently running".to_string())
        }
    }

    /// Kill process tree on Unix systems
    #[cfg(unix)]
    fn kill_process_tree(pid: u32) -> Result<(), String> {
        println!("Attempting to kill process tree for PID: {}", pid);
        let pgid = pid as i32;

        let terminate_group = |signal: i32| -> Result<(), String> {
            let result = unsafe { libc::killpg(pgid, signal) };
            if result == 0 {
                return Ok(());
            }

            let error = io::Error::last_os_error();
            if error.raw_os_error() == Some(libc::ESRCH) {
                return Ok(());
            }

            Err(format!(
                "Failed to send signal {} to process group {}: {}",
                signal, pgid, error
            ))
        };

        terminate_group(libc::SIGTERM)?;
        thread::sleep(Duration::from_secs(2));
        let _ = terminate_group(libc::SIGKILL);

        Ok(())
    }

    #[cfg(not(unix))]
    fn kill_process_tree(_pid: u32) -> Result<(), String> {
        // Windows process tree cleanup handled differently
        Ok(())
    }

    /// Starts a new RGB Lightning Node process (if none is running).
    /// If one is running, it is shut down first, then a new one is started.
    /// Returns an error if the node binary cannot be started.
    /// On Windows, this will always return an error since rgb-lightning-node is not supported.
    #[allow(dead_code)]
    pub fn start(
        &self,
        network: String,
        datapath: Option<String>,
        daemon_listening_port: String,
        ldk_peer_listening_port: String,
        account_name: String,
    ) -> Result<(), String> {
        let daemon_port = self.start_inner(
            network,
            datapath,
            daemon_listening_port,
            ldk_peer_listening_port,
            account_name.clone(),
        )?;
        self.wait_and_finalize(daemon_port, &account_name)
    }

    /// Core spawn logic shared by `start` and `start_spawn_only`.
    /// Spawns the process + monitoring thread and returns the daemon port.
    /// Does NOT block on the HTTP readiness probe.
    fn start_inner(
        &self,
        network: String,
        datapath: Option<String>,
        daemon_listening_port: String,
        ldk_peer_listening_port: String,
        account_name: String,
    ) -> Result<u16, String> {
        // RGB Lightning Node is not supported on Windows
        if cfg!(target_os = "windows") {
            let err = "RGB Lightning Node is not supported on Windows. Please use a remote node connection instead.".to_string();
            println!("{}", err);
            self.set_state(NodeState::Failed(err.clone()));
            if let Ok(window_guard) = self.window.lock() {
                if let Some(window) = window_guard.as_ref() {
                    let _ = window.emit("node-error", err.clone());
                }
            }
            return Err(err);
        }

        println!("Starting node for account: {}", account_name);

        // Check current state
        let current_state = self.get_state();
        match current_state {
            NodeState::Starting => {
                return Err("Node is already starting. Please wait.".to_string());
            }
            NodeState::Stopping => {
                println!("Node is currently stopping. Waiting for it to finish before starting new node...");
                let wait_start = std::time::Instant::now();
                let wait_timeout = Duration::from_secs(15);
                while matches!(self.get_state(), NodeState::Stopping) {
                    if wait_start.elapsed() > wait_timeout {
                        println!("Timed out waiting for node to stop. Force killing...");
                        self.force_kill();
                        break;
                    }
                    thread::sleep(Duration::from_millis(100));
                }
                // Small delay to ensure ports are released
                thread::sleep(Duration::from_secs(1));
            }
            _ => {}
        }

        let was_running = matches!(current_state, NodeState::Running);

        // Check if ports are available before proceeding
        let daemon_port = daemon_listening_port.parse::<u16>().map_err(|e| {
            let err = format!("Invalid daemon port number: {}", e);
            if !was_running {
                self.set_state(NodeState::Failed(err.clone()));
            }
            err
        })?;
        let ldk_port = ldk_peer_listening_port.parse::<u16>().map_err(|e| {
            let err = format!("Invalid LDK peer port number: {}", e);
            if !was_running {
                self.set_state(NodeState::Failed(err.clone()));
            }
            err
        })?;

        if !Self::is_port_available(daemon_port) {
            let err = format!("Port {} is already in use. Please make sure no other node is running or try a different port.", daemon_port);
            println!("{}", err);
            if !was_running {
                self.set_state(NodeState::Failed(err.clone()));
            }
            if let Ok(window_guard) = self.window.lock() {
                if let Some(window) = window_guard.as_ref() {
                    let _ = window.emit("node-error", err.clone());
                }
            }
            return Err(err);
        }

        if !Self::is_port_available(ldk_port) {
            let err = format!("Port {} is already in use. Please make sure no other node is running or try a different port.", ldk_port);
            println!("{}", err);
            if !was_running {
                self.set_state(NodeState::Failed(err.clone()));
            }
            if let Ok(window_guard) = self.window.lock() {
                if let Some(window) = window_guard.as_ref() {
                    let _ = window.emit("node-error", err.clone());
                }
            }
            return Err(err);
        }

        // 1) If already running, attempt to stop & wait for complete shutdown
        if was_running {
            println!(
                "Node is already running for account: {}. Stopping existing process...",
                self.current_account
                    .lock()
                    .ok()
                    .and_then(|g| g.as_ref().cloned())
                    .unwrap_or_else(|| "unknown".to_string())
            );

            self.shutdown();

            if self.is_process_active() {
                let err =
                    "Failed to stop existing node process. Please try restarting the application."
                        .to_string();
                println!("{}", err);
                self.set_state(NodeState::Failed(err.clone()));
                if let Ok(window_guard) = self.window.lock() {
                    if let Some(window) = window_guard.as_ref() {
                        let _ = window.emit("node-error", err.clone());
                    }
                }
                return Err(err);
            }

            // Add a small delay to ensure resources are released
            thread::sleep(Duration::from_secs(1));
        }

        // Set state to Starting now that the old node is stopped
        self.set_state(NodeState::Starting);

        // 2) Build the final data path for the node
        let app_data_dir = if cfg!(debug_assertions) {
            println!("Debug mode: Using local bin directory");
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../bin")
        } else if cfg!(target_os = "macos") {
            println!("MacOS: Using Application Support directory");
            let home =
                env::var("HOME").map_err(|e| format!("Failed to get HOME directory: {}", e))?;
            PathBuf::from(home).join("Library/Application Support/com.kaleidoswap.dev/data")
        } else if cfg!(target_os = "windows") {
            println!("Windows: Using LOCALAPPDATA directory");
            let local_app_data = env::var("LOCALAPPDATA")
                .map_err(|e| format!("Failed to get LOCALAPPDATA: {}", e))?;
            PathBuf::from(local_app_data).join("com.kaleidoswap.dev/data")
        } else {
            println!("Linux: Using .local/share directory");
            let home =
                env::var("HOME").map_err(|e| format!("Failed to get HOME directory: {}", e))?;
            PathBuf::from(home).join(".local/share/com.kaleidoswap.dev/data")
        };

        println!("App data directory: {:?}", app_data_dir);

        // Ensure base directory exists
        if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
            let err = format!("Failed to create data directory {:?}: {}", app_data_dir, e);
            println!("{}", err);
            return Err(err);
        }

        let final_datapath = match datapath {
            Some(path) => {
                let path = app_data_dir.join(path);
                println!("Using datapath: {:?}", path);
                path.to_string_lossy().to_string()
            }
            None => {
                println!("No datapath provided");
                "".to_string()
            }
        };

        if let Ok(mut logs_guard) = self.logs.lock() {
            logs_guard.clear();
        }

        if let Ok(mut account_guard) = self.current_account.lock() {
            *account_guard = Some(account_name.clone());
        }
        if let Ok(mut port_guard) = self.daemon_port.lock() {
            *port_guard = Some(daemon_port);
        }

        // 3) Actually spawn the child process
        let (child, stdout_log_file, stderr_log_file) = match self.run_rgb_lightning_node(
            &network,
            &final_datapath,
            &daemon_listening_port,
            &ldk_peer_listening_port,
        ) {
            Ok(result) => result,
            Err(e) => {
                let err = format!("Failed to start RGB Lightning Node: {}", e);
                println!("{}", err);
                self.set_state(NodeState::Failed(err.clone()));
                if let Ok(window_guard) = self.window.lock() {
                    if let Some(window) = window_guard.as_ref() {
                        let _ = window.emit("node-error", err.clone());
                    }
                }
                return Err(err);
            }
        };

        // 4) Store the child process and mark as running
        {
            let mut proc_guard = self.child_process.lock().map_err(|e| {
                let err = format!("Failed to acquire process lock: {}", e);
                self.set_state(NodeState::Failed(err.clone()));
                err
            })?;
            *proc_guard = Some(child);
        }

        // 5) Spawn a thread to watch the child process output and handle shutdown
        let rx = Arc::clone(&self.control_receiver);
        let cp_for_thread = Arc::clone(&self.child_process);
        let state_for_thread = Arc::clone(&self.state);
        let logs_for_thread = Arc::clone(&self.logs);
        let window_for_thread = Arc::clone(&self.window);
        let app_handle_for_thread = Arc::clone(&self.app_handle);
        let current_account_for_thread = Arc::clone(&self.current_account);
        let daemon_port_for_thread = Arc::clone(&self.daemon_port);
        let shutdown_timeout = self.shutdown_timeout;
        let stdout_log_for_thread = stdout_log_file;
        let stderr_log_for_thread = stderr_log_file;

        std::thread::spawn(move || {
            // Capture stdout and stderr
            if let Ok(mut child_option) = cp_for_thread.lock() {
                if let Some(ref mut child) = *child_option {
                    // Capture stdout
                    if let Some(stdout) = child.stdout.take() {
                        let logs_clone = Arc::clone(&logs_for_thread);
                        let window_clone = Arc::clone(&window_for_thread);
                        let mut log_file = stdout_log_for_thread;
                        std::thread::spawn(move || {
                            let reader = BufReader::new(stdout);
                            for line in reader.lines().map_while(Result::ok) {
                                println!("Node stdout: {}", line);
                                let _ = writeln!(log_file, "{}", line);
                                if let Ok(mut logs) = logs_clone.lock() {
                                    logs.push(line.clone());
                                    if logs.len() > MAX_LOGS_IN_MEMORY {
                                        let drain_count = logs.len() - MAX_LOGS_IN_MEMORY;
                                        logs.drain(0..drain_count);
                                    }
                                }
                                if let Ok(window_guard) = window_clone.lock() {
                                    if let Some(win) = window_guard.as_ref() {
                                        let _ = win.emit("node-log", line);
                                    }
                                }
                            }
                        });
                    }
                    // Capture stderr
                    if let Some(stderr) = child.stderr.take() {
                        let logs_clone = Arc::clone(&logs_for_thread);
                        let window_clone = Arc::clone(&window_for_thread);
                        let mut log_file = stderr_log_for_thread;
                        std::thread::spawn(move || {
                            let reader = BufReader::new(stderr);
                            for line in reader.lines().map_while(Result::ok) {
                                println!("Node stderr: {}", line);
                                let _ = writeln!(log_file, "Error: {}", line);
                                if let Ok(mut logs) = logs_clone.lock() {
                                    logs.push(format!("Error: {}", line));
                                    if logs.len() > MAX_LOGS_IN_MEMORY {
                                        let drain_count = logs.len() - MAX_LOGS_IN_MEMORY;
                                        logs.drain(0..drain_count);
                                    }
                                }
                                if let Ok(window_guard) = window_clone.lock() {
                                    if let Some(win) = window_guard.as_ref() {
                                        let _ = win.emit("node-error", line);
                                    }
                                }
                            }
                        });
                    }
                }
            }

            // Monitoring loop
            let mut should_emit_stopped = true;
            loop {
                // Check if we got a Stop message
                if let Ok(rx_guard) = rx.lock() {
                    match rx_guard.try_recv() {
                        Ok(ControlMessage::Stop) => {
                            println!("Received Stop signal, breaking monitoring loop.");
                            break;
                        }
                        Err(_) => {
                            // No message, continue monitoring
                        }
                    }
                }

                // Check if the child has exited
                if let Ok(mut proc_guard) = cp_for_thread.lock() {
                    if let Some(ref mut child) = *proc_guard {
                        match child.try_wait() {
                            Ok(Some(status)) => {
                                if status.success() {
                                    println!(
                                        "Node process exited cleanly with status: {:?}",
                                        status
                                    );
                                } else {
                                    should_emit_stopped = false;
                                    println!("Node process crashed with status: {:?}", status);
                                    let failed_state = NodeState::Failed(format!(
                                        "Process exited with status: {:?}",
                                        status
                                    ));
                                    let crash_msg = format!("Exit status: {:?}", status);
                                    if let Ok(mut state_guard) = state_for_thread.write() {
                                        *state_guard = failed_state.clone();
                                    }
                                    // Emit node-state-changed so that useNodeLifecycleEvents
                                    // and waitForNodeReady both update immediately, not only
                                    // via the separate node-crashed event.
                                    if let Ok(window_guard) = window_for_thread.lock() {
                                        if let Some(win) = window_guard.as_ref() {
                                            let _ = win
                                                .emit("node-state-changed", failed_state.clone());
                                            let _ = win.emit("node-crashed", crash_msg.clone());
                                        }
                                    }
                                    if let Ok(app_handle_guard) = app_handle_for_thread.lock() {
                                        if let Some(ah) = app_handle_guard.as_ref() {
                                            let _ = ah.emit("node-state-changed", failed_state);
                                            let _ = ah.emit("node-crashed", crash_msg);
                                        }
                                    }
                                }
                                break;
                            }
                            Ok(None) => {
                                // Process still running
                                thread::sleep(Duration::from_secs(1));
                            }
                            Err(e) => {
                                should_emit_stopped = false;
                                println!("Error waiting for child process: {:?}", e);
                                let failed_state =
                                    NodeState::Failed(format!("Process monitoring error: {:?}", e));
                                let err_msg = format!("Monitoring error: {:?}", e);
                                if let Ok(mut state_guard) = state_for_thread.write() {
                                    *state_guard = failed_state.clone();
                                }
                                if let Ok(window_guard) = window_for_thread.lock() {
                                    if let Some(win) = window_guard.as_ref() {
                                        let _ =
                                            win.emit("node-state-changed", failed_state.clone());
                                        let _ = win.emit("node-crashed", err_msg.clone());
                                    }
                                }
                                if let Ok(app_handle_guard) = app_handle_for_thread.lock() {
                                    if let Some(ah) = app_handle_guard.as_ref() {
                                        let _ = ah.emit("node-state-changed", failed_state);
                                        let _ = ah.emit("node-crashed", err_msg);
                                    }
                                }
                                break;
                            }
                        }
                    } else {
                        // No child process reference? Possibly already cleaned up
                        break;
                    }
                }
            }

            // Graceful shutdown attempt
            if let Ok(mut proc_guard) = cp_for_thread.lock() {
                if let Some(mut child) = proc_guard.take() {
                    println!("Attempting graceful shutdown (kill)...");

                    // Try to kill process tree on Unix
                    #[cfg(unix)]
                    {
                        let pid = child.id();
                        let _ = Self::kill_process_tree(pid);
                    }

                    let _ = child.kill();

                    // Wait up to shutdown_timeout
                    let start = std::time::Instant::now();
                    while start.elapsed() < shutdown_timeout {
                        match child.try_wait() {
                            Ok(Some(_)) => {
                                println!("Process exited gracefully.");
                                break;
                            }
                            Ok(None) => thread::sleep(Duration::from_millis(100)),
                            Err(e) => {
                                println!("Error waiting for process: {:?}", e);
                                break;
                            }
                        }
                    }

                    // Force kill if still running
                    if child.try_wait().map(|s| s.is_none()).unwrap_or(false) {
                        println!("Force killing child process (didn't exit in time).");
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }

            if let Ok(mut account_guard) = current_account_for_thread.lock() {
                *account_guard = None;
            }
            if let Ok(mut port_guard) = daemon_port_for_thread.lock() {
                *port_guard = None;
            }

            if should_emit_stopped {
                if let Ok(mut state_guard) = state_for_thread.write() {
                    *state_guard = NodeState::Stopped;
                }

                // Emit node-state-changed in addition to node-stopped so that
                // useNodeLifecycleEvents and waitForNodeReady react immediately.
                if let Ok(window_guard) = window_for_thread.lock() {
                    if let Some(win) = window_guard.as_ref() {
                        let _ = win.emit("node-state-changed", NodeState::Stopped);
                        let _ = win.emit("node-stopped", ());
                    }
                }
                if let Ok(app_handle_guard) = app_handle_for_thread.lock() {
                    if let Some(ah) = app_handle_guard.as_ref() {
                        let _ = ah.emit("node-state-changed", NodeState::Stopped);
                        let _ = ah.emit("node-stopped", ());
                    }
                }
            }
        });

        Ok(daemon_port)
    }

    /// Like `start()` but returns the daemon port immediately after the process and its
    /// monitoring thread have been spawned, *without* blocking on the HTTP readiness probe.
    ///
    /// The caller is responsible for calling `NodeProcess::wait_for_http_ready_static` and
    /// `NodeProcess::finalize_running` (or `handle_http_wait_error`) after releasing whatever
    /// lock they hold, so that other Tauri commands are not blocked during the ~30-second wait.
    #[allow(dead_code)]
    pub fn start_spawn_only(
        &self,
        network: String,
        datapath: Option<String>,
        daemon_listening_port: String,
        ldk_peer_listening_port: String,
        account_name: String,
    ) -> Result<u16, String> {
        self.start_inner(
            network,
            datapath,
            daemon_listening_port,
            ldk_peer_listening_port,
            account_name,
        )
    }

    /// Handle an HTTP-readiness failure that occurred after `start_spawn_only` returned.
    #[allow(dead_code)]
    pub fn handle_http_wait_error(&self, error: &str) {
        let err = format!("Node process started but never became ready: {}", error);
        println!("{}", err);
        self.force_kill();
        self.set_state(NodeState::Failed(err.clone()));
        if let Ok(wg) = self.window.lock() {
            if let Some(w) = wg.as_ref() {
                let _ = w.emit("node-error", err.clone());
            }
        }
        if let Ok(ag) = self.app_handle.lock() {
            if let Some(a) = ag.as_ref() {
                let _ = a.emit("node-error", err);
            }
        }
    }

    /// Block on the HTTP readiness probe then finalize, OR emit the error and return `Err`.
    #[allow(dead_code)]
    fn wait_and_finalize(&self, daemon_port: u16, account_name: &str) -> Result<(), String> {
        if let Err(error) = self.wait_for_http_ready(daemon_port) {
            let err = format!("Node process started but never became ready: {}", error);
            println!("{}", err);
            self.force_kill();
            self.set_state(NodeState::Failed(err.clone()));
            if let Ok(window_guard) = self.window.lock() {
                if let Some(window) = window_guard.as_ref() {
                    let _ = window.emit("node-error", err.clone());
                }
            }
            if let Ok(app_handle_guard) = self.app_handle.lock() {
                if let Some(ah) = app_handle_guard.as_ref() {
                    let _ = ah.emit("node-error", err.clone());
                }
            }
            return Err(err);
        }
        self.finalize_running(account_name);
        Ok(())
    }

    /// Transition to `Running`, emit `node-started`, and log success.
    /// Called after `wait_for_http_ready_static` succeeds.
    pub fn finalize_running(&self, account_name: &str) {
        self.set_state(NodeState::Running);
        println!("Node started successfully for account: {}", account_name);
        if let Ok(window_guard) = self.window.lock() {
            if let Some(window) = window_guard.as_ref() {
                let _ = window.emit("node-started", account_name.to_string());
            }
        }
        if let Ok(app_handle_guard) = self.app_handle.lock() {
            if let Some(ah) = app_handle_guard.as_ref() {
                let _ = ah.emit("node-started", account_name.to_string());
            }
        }
    }

    /// Requests the process to stop. (Non-blocking)
    pub fn stop(&self) {
        let state = self.get_state();
        match state {
            NodeState::Running | NodeState::Starting => {
                println!("Sending Stop signal to node thread...");
                self.set_state(NodeState::Stopping);
                let _ = self.control_sender.send(ControlMessage::Stop);
            }
            NodeState::Stopping => {
                println!("Node is already stopping.");
            }
            _ => {
                println!("Node is not running. Current state: {:?}", state);
            }
        }
    }

    /// Gracefully shuts down the node and waits up to `shutdown_timeout`.
    /// Falls back to a force kill if still alive afterward.
    pub fn shutdown(&self) {
        let state = self.get_state();
        match state {
            NodeState::Running | NodeState::Starting => {
                println!("Shutting down node gracefully via Stop signal...");
                self.stop();

                if !self.wait_for_process_exit(self.shutdown_timeout) {
                    println!("Timed out waiting for shutdown. Force killing...");
                    self.force_kill();
                }

                // Add additional delay to ensure ports are released
                println!("Waiting for ports to be released...");
                thread::sleep(Duration::from_secs(1));
            }
            NodeState::Stopping => {
                println!("Node is already stopping, waiting for completion...");
                if !self.wait_for_process_exit(self.shutdown_timeout) {
                    println!("Timed out waiting for shutdown. Force killing...");
                    self.force_kill();
                }
            }
            _ => {
                println!("Node is not running. Current state: {:?}", state);
            }
        }
    }

    fn has_live_process(&self) -> bool {
        self.child_process
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
    }

    fn is_process_active(&self) -> bool {
        matches!(
            self.get_state(),
            NodeState::Running | NodeState::Starting | NodeState::Stopping
        ) || self.has_live_process()
    }

    fn wait_for_process_exit(&self, timeout: Duration) -> bool {
        let start = Instant::now();
        while self.is_process_active() {
            if start.elapsed() > timeout {
                return false;
            }
            thread::sleep(Duration::from_millis(100));
        }
        true
    }

    /// Check if a process is currently marked as running.
    pub fn is_running(&self) -> bool {
        matches!(self.get_state(), NodeState::Running | NodeState::Starting)
    }

    /// Check if a process is running for a specific account.
    pub fn is_running_for_account(&self, account_name: &str) -> bool {
        if !self.is_running() {
            return false;
        }

        if let Ok(account_guard) = self.current_account.lock() {
            if let Some(current_account) = account_guard.as_ref() {
                return current_account == account_name;
            }
        }
        false
    }

    /// Get the name of the account currently running, if any
    pub fn get_current_account(&self) -> Option<String> {
        self.current_account
            .lock()
            .ok()
            .and_then(|guard| guard.clone())
    }

    /// Returns the path to the log file
    fn get_log_file_path(&self) -> Result<PathBuf, String> {
        let log_dir = if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("logs")
        } else if cfg!(target_os = "macos") {
            // macOS: ~/Library/Logs/com.kaleidoswap.dev/
            let home =
                env::var("HOME").map_err(|e| format!("Failed to get HOME directory: {}", e))?;
            PathBuf::from(home).join("Library/Logs/com.kaleidoswap.dev")
        } else if cfg!(target_os = "windows") {
            // Windows: %APPDATA%\com.kaleidoswap.dev\logs
            let app_data = env::var("APPDATA")
                .map_err(|e| format!("Failed to get APPDATA directory: {}", e))?;
            PathBuf::from(app_data)
                .join("com.kaleidoswap.dev")
                .join("logs")
        } else {
            // Linux: ~/.local/share/com.kaleidoswap.dev/logs
            let home =
                env::var("HOME").map_err(|e| format!("Failed to get HOME directory: {}", e))?;
            PathBuf::from(home).join(".local/share/com.kaleidoswap.dev/logs")
        };

        Ok(log_dir.join("rgb-lightning-node.log"))
    }

    /// Returns any logs captured so far, including those from the log file
    pub fn get_logs(&self) -> Vec<String> {
        let mut logs = Vec::new();

        // First get any in-memory logs
        if let Ok(logs_guard) = self.logs.lock() {
            logs.extend(logs_guard.clone());
        }

        // Then try to read from the log file
        if let Ok(log_path) = self.get_log_file_path() {
            if let Ok(file) = File::open(log_path) {
                let reader = BufReader::new(file);
                for line in reader.lines().map_while(Result::ok) {
                    logs.push(line);
                }
            }
        }

        logs
    }

    /// Save logs to a specific file
    pub fn save_logs_to_file(&self, file_path: &str) -> Result<(), String> {
        let logs = self.get_logs();
        std::fs::write(file_path, logs.join("\n"))
            .map_err(|e| format!("Failed to write logs to file: {}", e))
    }

    /// Force kill the process immediately, without waiting for graceful exit.
    pub fn force_kill(&self) {
        println!("Force killing node process...");
        self.set_state(NodeState::Stopping);

        if let Ok(mut proc_guard) = self.child_process.lock() {
            if let Some(mut child) = proc_guard.take() {
                let pid = child.id();

                // On Unix-like systems, try to kill entire process tree
                #[cfg(unix)]
                {
                    println!("Killing process tree for PID: {}", pid);
                    let _ = Self::kill_process_tree(pid);
                }

                // Kill the main process
                let _ = child.kill();
                let _ = child.wait();
            }
        }

        self.set_state(NodeState::Stopped);

        if let Ok(mut account_guard) = self.current_account.lock() {
            *account_guard = None;
        }
        if let Ok(mut port_guard) = self.daemon_port.lock() {
            *port_guard = None;
        }

        // Add additional delay to ensure ports are released
        println!("Waiting for ports to be released after force kill...");
        thread::sleep(Duration::from_secs(1));
    }

    /// Expose the state `Arc` so callers can poll readiness without holding the outer mutex.
    pub fn get_state_arc(&self) -> Arc<RwLock<NodeState>> {
        Arc::clone(&self.state)
    }

    /// Static version of the HTTP readiness poll — can be called without holding any
    /// `NodeProcess` mutex lock, allowing other Tauri commands to proceed concurrently.
    pub fn wait_for_http_ready_static(
        daemon_port: u16,
        state: Arc<RwLock<NodeState>>,
    ) -> Result<(), String> {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|e| format!("Failed to build readiness HTTP client: {}", e))?;

        let url = format!("http://127.0.0.1:{}/nodeinfo", daemon_port);
        let start = Instant::now();
        let timeout = Duration::from_secs(STARTUP_TIMEOUT_SECS);
        let mut last_error: Option<String> = None;

        while start.elapsed() < timeout {
            let current_state = state
                .read()
                .map(|s| s.clone())
                .unwrap_or(NodeState::Stopped);
            match current_state {
                NodeState::Failed(message) => return Err(message),
                NodeState::Stopped => {
                    return Err("Node process stopped before becoming ready".to_string());
                }
                _ => {}
            }

            match client.get(&url).send() {
                Ok(response) => {
                    println!(
                        "Node readiness probe succeeded on {} with status {}",
                        url,
                        response.status()
                    );
                    return Ok(());
                }
                Err(error) => {
                    last_error = Some(error.to_string());
                    thread::sleep(Duration::from_millis(500));
                }
            }
        }

        Err(format!(
            "Timed out waiting for node HTTP server on {}{}",
            url,
            last_error
                .map(|error| format!(" (last error: {})", error))
                .unwrap_or_default()
        ))
    }

    #[allow(dead_code)]
    fn wait_for_http_ready(&self, daemon_port: u16) -> Result<(), String> {
        Self::wait_for_http_ready_static(daemon_port, self.get_state_arc())
    }

    /// Spawns the rgb-lightning-node process.
    /// Returns a `Child` on success or an error message otherwise.
    fn run_rgb_lightning_node(
        &self,
        network: &str,
        datapath: &str,
        daemon_listening_port: &str,
        ldk_peer_listening_port: &str,
    ) -> Result<(Child, File, File), String> {
        let executable_path = if cfg!(debug_assertions) {
            // In debug mode, look in the bin directory relative to CARGO_MANIFEST_DIR
            let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../bin/rgb-lightning-node");
            println!("Debug mode: Looking for executable at {:?}", path);
            path
        } else {
            // In production mode, get the resource path from the app handle
            let app_handle = self.app_handle.lock().unwrap();
            let app_handle = app_handle.as_ref().ok_or_else(|| {
                "App handle not set. Make sure to call set_window first.".to_string()
            })?;

            let resource_dir = app_handle
                .path()
                .resource_dir()
                .map_err(|_| "Failed to get resource directory".to_string())?;

            // Platform-specific binary path resolution
            let binary_path = if cfg!(target_os = "macos") {
                // macOS: Resources/_up_/bin/rgb-lightning-node
                resource_dir
                    .join("_up_")
                    .join("bin")
                    .join("rgb-lightning-node")
            } else if cfg!(target_os = "windows") {
                // Windows: resources\rgb-lightning-node.exe
                resource_dir.join("rgb-lightning-node")
            } else {
                // Linux: resources/_up_/bin/rgb-lightning-node
                resource_dir
                    .join("_up_")
                    .join("bin")
                    .join("rgb-lightning-node")
            };

            println!(
                "Production mode: Looking for executable at {:?}",
                binary_path
            );
            binary_path
        };

        #[cfg(target_os = "windows")]
        let executable_path = executable_path.with_extension("exe");

        if !executable_path.exists() {
            // Print more detailed error information
            println!("Binary not found. Checking parent directories:");
            if let Some(parent) = executable_path.parent() {
                if let Ok(entries) = std::fs::read_dir(parent) {
                    println!("Contents of {:?}:", parent);
                    for entry in entries.flatten() {
                        println!("  {:?}", entry.path());
                    }
                }
            }
            return Err(format!(
                "rgb-lightning-node executable not found at: {:?}",
                executable_path
            ));
        }

        // Set up logging directory
        let log_dir = if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("logs")
        } else if cfg!(target_os = "macos") {
            // macOS: ~/Library/Logs/com.kaleidoswap.dev/
            let home =
                env::var("HOME").map_err(|e| format!("Failed to get HOME directory: {}", e))?;
            PathBuf::from(home).join("Library/Logs/com.kaleidoswap.dev")
        } else if cfg!(target_os = "windows") {
            // Windows: %APPDATA%\com.kaleidoswap.dev\logs
            let app_data = env::var("APPDATA")
                .map_err(|e| format!("Failed to get APPDATA directory: {}", e))?;
            PathBuf::from(app_data)
                .join("com.kaleidoswap.dev")
                .join("logs")
        } else {
            // Linux: ~/.local/share/com.kaleidoswap.dev/logs
            let home =
                env::var("HOME").map_err(|e| format!("Failed to get HOME directory: {}", e))?;
            PathBuf::from(home).join(".local/share/com.kaleidoswap.dev/logs")
        };

        // Ensure log directory exists
        std::fs::create_dir_all(&log_dir)
            .map_err(|e| format!("Failed to create log directory: {}", e))?;

        let log_file = log_dir.join("rgb-lightning-node.log");
        println!("Log file path: {:?}", log_file);

        // Open log file for writing
        let log_file = std::fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&log_file)
            .map_err(|e| format!("Failed to open log file: {}", e))?;

        println!("Starting RGB Lightning Node with arguments:");
        println!("  Executable: {:?}", executable_path);
        println!("  Network: {}", network);
        println!("  Data path: {}", datapath);
        println!("  Daemon port: {}", daemon_listening_port);
        println!("  LDK peer port: {}", ldk_peer_listening_port);
        println!("  Log file: {:?}", log_file);

        // Clone the file handles for stdout and stderr
        let stdout_log = log_file
            .try_clone()
            .map_err(|e| format!("Failed to clone log file for stdout: {}", e))?;
        let stderr_log = log_file
            .try_clone()
            .map_err(|e| format!("Failed to clone log file for stderr: {}", e))?;

        let mut command = Command::new(&executable_path);
        command
            .arg(datapath)
            .args(["--daemon-listening-port", daemon_listening_port])
            .args(["--ldk-peer-listening-port", ldk_peer_listening_port])
            .args(["--network", network])
            .args(["--disable-authentication"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(unix)]
        unsafe {
            command.pre_exec(|| {
                if libc::setpgid(0, 0) != 0 {
                    return Err(io::Error::last_os_error());
                }
                Ok(())
            });
        }

        let child = command.spawn();

        match child {
            Ok(child) => {
                println!("Successfully spawned RGB Lightning Node process");
                Ok((child, stdout_log, stderr_log))
            }
            Err(e) => {
                let err = format!("Failed to spawn rgb-lightning-node process: {}", e);
                println!("{}", err);
                Err(err)
            }
        }
    }
}
