use std::env;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Manager;
use tauri::{AppHandle, Emitter, WebviewWindow};
use std::collections::HashMap;

const SHUTDOWN_TIMEOUT_SECS: u64 = 5;

#[derive(Debug)]
enum ControlMessage {
    Stop,
}

pub struct NodeProcess {
    child_process: Arc<Mutex<Option<Child>>>,
    control_sender: Sender<ControlMessage>,
    control_receiver: Arc<Mutex<Receiver<ControlMessage>>>,
    is_running: Arc<AtomicBool>,
    logs: Arc<Mutex<Vec<String>>>,
    window: Arc<Mutex<Option<WebviewWindow>>>,
    shutdown_timeout: Duration,
    current_account: Arc<Mutex<Option<String>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl NodeProcess {
    pub fn new() -> Self {
        let (tx, rx) = channel();
        NodeProcess {
            child_process: Arc::new(Mutex::new(None)),
            control_sender: tx,
            control_receiver: Arc::new(Mutex::new(rx)),
            is_running: Arc::new(AtomicBool::new(false)),
            logs: Arc::new(Mutex::new(Vec::new())),
            window: Arc::new(Mutex::new(None)),
            shutdown_timeout: Duration::from_secs(SHUTDOWN_TIMEOUT_SECS),
            current_account: Arc::new(Mutex::new(None)),
            app_handle: Arc::new(Mutex::new(None)),
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
        TcpListener::bind(("127.0.0.1", port)).is_ok()
    }

    /// Get a list of available ports starting from a base port
    pub fn find_available_ports(base_daemon_port: u16, base_ldk_port: u16) -> (u16, u16) {
        let mut daemon_port = base_daemon_port;
        let mut ldk_port = base_ldk_port;

        // Try up to 10 port numbers after the base ports
        for i in 0..10 {
            if Self::is_port_available(daemon_port + i) {
                daemon_port = daemon_port + i;
                break;
            }
        }

        for i in 0..10 {
            if Self::is_port_available(ldk_port + i) {
                ldk_port = ldk_port + i;
                break;
            }
        }

        (daemon_port, ldk_port)
    }

    /// Get the current running node's ports
    pub fn get_running_node_ports(&self) -> HashMap<String, String> {
        let mut ports = HashMap::new();
        if let Some(_) = self.child_process.lock().unwrap().as_ref() {
            if let Some(account) = self.current_account.lock().unwrap().as_ref() {
                if let Ok(Some(account_info)) = crate::db::get_account_by_name(account) {
                    ports.insert(account_info.daemon_listening_port, account.clone());
                    ports.insert(account_info.ldk_peer_listening_port, account.clone());
                }
            }
        }
        ports
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

    /// Starts a new RGB Lightning Node process (if none is running).
    /// If one is running, it is shut down first, then a new one is started.
    /// Returns an error if the node binary cannot be started.
    /// On Windows, this will always return an error since rgb-lightning-node is not supported.
    pub fn start(
        &self,
        network: String,
        datapath: Option<String>,
        daemon_listening_port: String,
        ldk_peer_listening_port: String,
        account_name: String,
    ) -> Result<(), String> {
        // RGB Lightning Node is not supported on Windows
        if cfg!(target_os = "windows") {
            let err = "RGB Lightning Node is not supported on Windows. Please use a remote node connection instead.".to_string();
            println!("{}", err);
            if let Some(window) = &*self.window.lock().unwrap() {
                let _ = window.emit("node-error", err.clone());
            }
            return Err(err);
        }

        println!("Starting node for account: {}", account_name);

        // Check if ports are available before proceeding
        let daemon_port = daemon_listening_port
            .parse::<u16>()
            .map_err(|e| format!("Invalid daemon port number: {}", e))?;
        let ldk_port = ldk_peer_listening_port
            .parse::<u16>()
            .map_err(|e| format!("Invalid LDK peer port number: {}", e))?;

        if !Self::is_port_available(daemon_port) {
            let err = format!("Port {} is already in use. Please make sure no other node is running or try a different port.", daemon_port);
            println!("{}", err);
            if let Some(window) = &*self.window.lock().unwrap() {
                let _ = window.emit("node-error", err.clone());
            }
            return Err(err);
        }

        if !Self::is_port_available(ldk_port) {
            let err = format!("Port {} is already in use. Please make sure no other node is running or try a different port.", ldk_port);
            println!("{}", err);
            if let Some(window) = &*self.window.lock().unwrap() {
                let _ = window.emit("node-error", err.clone());
            }
            return Err(err);
        }

        // Store the account name before starting the node
        *self.current_account.lock().unwrap() = Some(account_name.clone());

        // 1) If already running, attempt to stop & wait for complete shutdown
        if self.is_running() {
            println!(
                "Node is already running for account: {}. Stopping existing process...",
                self.current_account
                    .lock()
                    .unwrap()
                    .as_ref()
                    .unwrap_or(&"unknown".to_string())
            );

            // First try graceful shutdown
            self.shutdown();

            // Wait for up to 10 seconds for graceful shutdown
            let start_time = std::time::Instant::now();
            let graceful_timeout = Duration::from_secs(10);
            while self.is_running() {
                if start_time.elapsed() > graceful_timeout {
                    println!("Graceful shutdown timed out, attempting force kill...");
                    self.force_kill();

                    // Wait additional 5 seconds after force kill
                    thread::sleep(Duration::from_secs(5));

                    if self.is_running() {
                        let err = "Failed to stop existing node process. Please try restarting the application.".to_string();
                        println!("{}", err);
                        if let Some(window) = &*self.window.lock().unwrap() {
                            let _ = window.emit("node-error", err.clone());
                        }
                        return Err(err);
                    }
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }

            // Add a small delay to ensure resources are released
            thread::sleep(Duration::from_secs(2));
        }

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

        // 3) Actually spawn the child process
        let child = match self.run_rgb_lightning_node(
            &network,
            &final_datapath,
            &daemon_listening_port,
            &ldk_peer_listening_port,
        ) {
            Ok(child) => child,
            Err(e) => {
                let err = format!("Failed to start RGB Lightning Node: {}", e);
                println!("{}", err);
                if let Some(window) = &*self.window.lock().unwrap() {
                    let _ = window.emit("node-error", err.clone());
                }
                return Err(err);
            }
        };

        // 4) Store the child process and mark as running
        {
            let mut proc_guard = self.child_process.lock().unwrap();
            *proc_guard = Some(child);
        }
        self.is_running.store(true, Ordering::SeqCst);

        println!("Node started successfully for account: {}", account_name);

        // Emit an event so your UI knows a node started
        if let Some(window) = &*self.window.lock().unwrap() {
            let _ = window.emit("node-started", account_name.clone());
        }

        // 5) Spawn a thread to watch the child process output and handle shutdown
        let rx = Arc::clone(&self.control_receiver);
        let cp_for_thread = Arc::clone(&self.child_process);
        let is_running_for_thread = Arc::clone(&self.is_running);
        let logs_for_thread = Arc::clone(&self.logs);
        let window_for_thread = Arc::clone(&self.window);
        let shutdown_timeout = self.shutdown_timeout;

        std::thread::spawn(move || {
            let mut child_option = cp_for_thread.lock().unwrap();
            if let Some(ref mut child) = *child_option {
                // Capture stdout
                if let Some(stdout) = child.stdout.take() {
                    let logs_clone = Arc::clone(&logs_for_thread);
                    let window_clone = Arc::clone(&window_for_thread);
                    std::thread::spawn(move || {
                        let reader = BufReader::new(stdout);
                        for line in reader.lines() {
                            if let Ok(line) = line {
                                println!("Node stdout: {}", line);
                                logs_clone.lock().unwrap().push(line.clone());
                                if let Some(win) = &*window_clone.lock().unwrap() {
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
                    std::thread::spawn(move || {
                        let reader = BufReader::new(stderr);
                        for line in reader.lines() {
                            if let Ok(line) = line {
                                println!("Node stderr: {}", line);
                                logs_clone.lock().unwrap().push(format!("Error: {}", line));
                                if let Some(win) = &*window_clone.lock().unwrap() {
                                    let _ = win.emit("node-error", line);
                                }
                            }
                        }
                    });
                }
            }
            drop(child_option); // Release the lock

            // Monitoring loop
            loop {
                // Check if we got a Stop message
                match rx.lock().unwrap().try_recv() {
                    Ok(ControlMessage::Stop) => {
                        println!("Received Stop signal, breaking monitoring loop.");
                        break;
                    }
                    Err(_) => {
                        // Check if the child has exited
                        if let Some(ref mut child) = *cp_for_thread.lock().unwrap() {
                            match child.try_wait() {
                                Ok(Some(status)) => {
                                    println!("Node process exited with status: {:?}", status);
                                    break;
                                }
                                Ok(None) => {
                                    thread::sleep(Duration::from_secs(1));
                                }
                                Err(e) => {
                                    println!("Error waiting for child process: {:?}", e);
                                    break;
                                }
                            }
                        } else {
                            // No child process reference? Possibly already cleaned up
                            break;
                        }
                    }
                }
            }

            // Graceful shutdown attempt
            {
                let mut proc_guard = cp_for_thread.lock().unwrap();
                if let Some(mut child) = proc_guard.take() {
                    println!("Attempting graceful shutdown (kill)...");
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

            is_running_for_thread.store(false, Ordering::SeqCst);
            if let Some(win) = &*window_for_thread.lock().unwrap() {
                let _ = win.emit("node-stopped", ());
            }
        });

        Ok(())
    }

    /// Requests the process to stop. (Non-blocking)
    pub fn stop(&self) {
        if self.is_running() {
            println!("Sending Stop signal to node thread...");
            let _ = self.control_sender.send(ControlMessage::Stop);
            *self.current_account.lock().unwrap() = None; // Clear the current account
        } else {
            println!("Node is not running.");
        }
    }

    /// Gracefully shuts down the node and waits up to `shutdown_timeout`.
    /// Falls back to a force kill if still alive afterward.
    pub fn shutdown(&self) {
        if self.is_running() {
            println!("Shutting down node gracefully via Stop signal...");
            self.stop(); // reuse the same signal

            let start = std::time::Instant::now();
            while self.is_running() {
                if start.elapsed() > self.shutdown_timeout {
                    println!("Timed out waiting for shutdown. Force killing...");
                    self.force_kill();
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }

            // Add additional delay to ensure ports are released
            println!("Waiting for ports to be released...");
            thread::sleep(Duration::from_secs(1));
        }
    }

    /// Check if a process is currently marked as running.
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    /// Check if a process is running for a specific account.
    pub fn is_running_for_account(&self, account_name: &str) -> bool {
        if !self.is_running() {
            return false;
        }

        if let Some(current_account) = self.current_account.lock().unwrap().as_ref() {
            current_account == account_name
        } else {
            false
        }
    }

    /// Get the name of the account currently running, if any
    pub fn get_current_account(&self) -> Option<String> {
        self.current_account.lock().unwrap().clone()
    }

    /// Returns the path to the log file
    fn get_log_file_path(&self) -> Result<PathBuf, String> {
        let log_dir = if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("logs")
        } else {
            if cfg!(target_os = "macos") {
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
            }
        };

        Ok(log_dir.join("rgb-lightning-node.log"))
    }

    /// Returns any logs captured so far, including those from the log file
    pub fn get_logs(&self) -> Vec<String> {
        let mut logs = Vec::new();

        // First get any in-memory logs
        logs.extend(self.logs.lock().unwrap().clone());

        // Then try to read from the log file
        if let Ok(log_path) = self.get_log_file_path() {
            if let Ok(file) = File::open(log_path) {
                let reader = BufReader::new(file);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        logs.push(line);
                    }
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
        let mut proc_guard = self.child_process.lock().unwrap();
        if let Some(mut child) = proc_guard.take() {
            // Kill the main process
            let _ = child.kill();
            let _ = child.wait();

            // On Unix-like systems, try to ensure child processes are killed
            #[cfg(unix)]
            {
                use std::process::Command;
                let pid = child.id(); // This returns u32, not Option<u32>
                println!("Killing child processes of PID: {}", pid);
                let _ = Command::new("pkill")
                    .args(&["-P", &pid.to_string()])
                    .output();
            }
        }
        self.is_running.store(false, Ordering::SeqCst);
        *self.current_account.lock().unwrap() = None; // Clear the current account

        // Add additional delay to ensure ports are released
        println!("Waiting for ports to be released after force kill...");
        thread::sleep(Duration::from_secs(1));
    }

    /// Spawns the rgb-lightning-node process.
    /// Returns a `Child` on success or an error message otherwise.
    fn run_rgb_lightning_node(
        &self,
        network: &str,
        datapath: &str,
        daemon_listening_port: &str,
        ldk_peer_listening_port: &str,
    ) -> Result<Child, String> {
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
                .or_else(|_| Err("Failed to get resource directory".to_string()))?;

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
                    for entry in entries {
                        if let Ok(entry) = entry {
                            println!("  {:?}", entry.path());
                        }
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
        } else {
            if cfg!(target_os = "macos") {
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
            }
        };

        // Ensure log directory exists
        std::fs::create_dir_all(&log_dir)
            .map_err(|e| format!("Failed to create log directory: {}", e))?;

        let log_file = log_dir.join("rgb-lightning-node.log");
        println!("Log file path: {:?}", log_file);

        // Open log file for writing
        let log_file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
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

        let child = Command::new(&executable_path)
            .arg(datapath)
            .args(&["--daemon-listening-port", daemon_listening_port])
            .args(&["--ldk-peer-listening-port", ldk_peer_listening_port])
            .args(&["--network", network])
            .stdout(Stdio::from(stdout_log))
            .stderr(Stdio::from(stderr_log))
            .spawn();

        match child {
            Ok(child) => {
                println!("Successfully spawned RGB Lightning Node process");
                Ok(child)
            }
            Err(e) => {
                let err = format!("Failed to spawn rgb-lightning-node process: {}", e);
                println!("{}", err);
                Err(err)
            }
        }
    }
}
