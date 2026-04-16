use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

use crate::rgb_node::NodeState;

const RLN_IMAGE: &str = "kaleidoswap/rgb-lightning-node:latest";
const DEFAULT_BASE_DAEMON_PORT: u16 = 3001;
const DEFAULT_BASE_PEER_PORT: u16 = 9735;
const DEFAULT_NETWORK_NAME: &str = "kaleidoswap-network";
const COMPOSE_FILE: &str = "docker-compose.yml";
const MAX_LOGS_IN_MEMORY: usize = 1000;
const MONITOR_INTERVAL_SECS: u64 = 3;

// Network name normalization — mirrors kaleido-cli config.py
fn normalize_network_name(network: &str) -> String {
    let lowered = network.trim().to_lowercase();
    match lowered.as_str() {
        "mutinynet" | "signetcustom" | "customsignet" => "signetcustom".to_string(),
        _ => lowered,
    }
}

/// Default base directory for Docker environments (~/.kaleido)
fn default_base_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".kaleido")
}

// ---------------------------------------------------------------------------
// Configuration structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerSpawnConfig {
    pub name: String,
    #[serde(default = "default_count")]
    pub count: u16,
    #[serde(default = "default_network")]
    pub network: String,
    #[serde(default = "default_daemon_port")]
    pub base_daemon_port: u16,
    #[serde(default = "default_peer_port")]
    pub base_peer_port: u16,
    #[serde(default = "default_true")]
    pub disable_authentication: bool,
}

fn default_count() -> u16 {
    1
}
fn default_network() -> String {
    "mutinynet".to_string()
}
fn default_daemon_port() -> u16 {
    DEFAULT_BASE_DAEMON_PORT
}
fn default_peer_port() -> u16 {
    DEFAULT_BASE_PEER_PORT
}
fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerEnvironment {
    pub name: String,
    pub compose_dir: String,
    pub node_count: u16,
    pub daemon_ports: Vec<u16>,
    pub peer_ports: Vec<u16>,
    pub network: String,
}

// ---------------------------------------------------------------------------
// Control message for monitoring thread
// ---------------------------------------------------------------------------

#[derive(Debug)]
enum ControlMessage {
    Stop,
}

// ---------------------------------------------------------------------------
// DockerNodeManager
// ---------------------------------------------------------------------------

#[allow(dead_code)]
pub struct DockerNodeManager {
    state: Arc<RwLock<NodeState>>,
    logs: Arc<Mutex<Vec<String>>>,
    window: Arc<Mutex<Option<WebviewWindow>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    current_environment: Arc<Mutex<Option<String>>>,
    compose_dir: Arc<Mutex<Option<PathBuf>>>,
    daemon_port: Arc<Mutex<Option<u16>>>,
    control_sender: Mutex<Option<Sender<ControlMessage>>>,
}

#[allow(dead_code)]
impl DockerNodeManager {
    pub fn new() -> Self {
        DockerNodeManager {
            state: Arc::new(RwLock::new(NodeState::Stopped)),
            logs: Arc::new(Mutex::new(Vec::new())),
            window: Arc::new(Mutex::new(None)),
            app_handle: Arc::new(Mutex::new(None)),
            current_environment: Arc::new(Mutex::new(None)),
            compose_dir: Arc::new(Mutex::new(None)),
            daemon_port: Arc::new(Mutex::new(None)),
            control_sender: Mutex::new(None),
        }
    }

    pub fn set_window(&self, window: WebviewWindow) {
        *self.app_handle.lock().unwrap() = Some(window.app_handle().clone());
        *self.window.lock().unwrap() = Some(window);
    }

    // ------------------------------------------------------------------
    // State management (mirrors NodeProcess patterns)
    // ------------------------------------------------------------------

    pub fn get_state(&self) -> NodeState {
        match self.state.read() {
            Ok(state) => state.clone(),
            Err(_) => NodeState::Failed("State lock poisoned".to_string()),
        }
    }

    fn set_state(&self, new_state: NodeState) {
        if let Ok(mut state) = self.state.write() {
            println!(
                "Docker node state transition: {:?} -> {:?}",
                *state, new_state
            );
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

    pub fn is_running(&self) -> bool {
        matches!(self.get_state(), NodeState::Running | NodeState::Starting)
    }

    pub fn get_current_environment(&self) -> Option<String> {
        self.current_environment.lock().ok().and_then(|g| g.clone())
    }

    pub fn get_daemon_port(&self) -> Option<u16> {
        self.daemon_port.lock().ok().and_then(|g| *g)
    }

    pub fn get_logs_paginated(&self, page: u32, page_size: u32) -> (Vec<String>, u32) {
        if let Ok(logs_guard) = self.logs.lock() {
            let total = logs_guard.len() as u32;
            let start = ((page - 1) * page_size) as usize;
            let end = std::cmp::min(start + page_size as usize, logs_guard.len());
            let logs = if start < logs_guard.len() {
                logs_guard[start..end].to_vec()
            } else {
                Vec::new()
            };
            (logs, total)
        } else {
            (Vec::new(), 0)
        }
    }

    // ------------------------------------------------------------------
    // Docker availability & environment discovery
    // ------------------------------------------------------------------

    /// Check if Docker is installed and available in PATH
    pub fn is_docker_available() -> bool {
        let mut cmd = Command::new("docker");
        cmd.arg("info")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.status().map(|s| s.success()).unwrap_or(false)
    }

    /// Format an account name into a Docker environment name.
    /// Mirrors the frontend `formatAccountName` logic: lowercase, replace
    /// non-alphanumeric with hyphens, collapse consecutive hyphens, strip
    /// leading/trailing hyphens, then prefix with `kaleidoswap-`.
    fn format_env_name(account_name: &str) -> String {
        let mut formatted = String::new();
        for ch in account_name.to_lowercase().chars() {
            if ch.is_ascii_alphanumeric() {
                formatted.push(ch);
            } else {
                formatted.push('-');
            }
        }
        // Collapse consecutive hyphens
        let collapsed = formatted
            .split('-')
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("-");
        format!("kaleidoswap-{}", collapsed)
    }

    /// Check if a Docker environment exists for the given account name
    /// and has persistent volume data. Returns the environment info if found.
    pub fn check_environment_exists(account_name: &str) -> Option<DockerEnvironment> {
        let env_name = Self::format_env_name(account_name);
        let base = default_base_dir();
        let env_dir = base.join(&env_name);
        let compose_path = env_dir.join(COMPOSE_FILE);

        if !compose_path.exists() {
            return None;
        }

        // Check if volumes directory has data (node was previously used)
        let volumes_dir = env_dir.join("volumes");
        let has_data = volumes_dir.exists()
            && std::fs::read_dir(&volumes_dir)
                .map(|mut entries| entries.next().is_some())
                .unwrap_or(false);

        if !has_data {
            return None;
        }

        // Parse the environment info from the compose file
        let envs = Self::list_environments(Some(&base));
        envs.into_iter().find(|e| e.name == env_name)
    }

    /// List all Docker environments under the base directory
    pub fn list_environments(base_dir: Option<&Path>) -> Vec<DockerEnvironment> {
        let base = base_dir.map(PathBuf::from).unwrap_or_else(default_base_dir);

        if !base.exists() {
            return Vec::new();
        }

        let mut envs = Vec::new();

        if let Ok(entries) = std::fs::read_dir(&base) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let compose_path = path.join(COMPOSE_FILE);
                if !compose_path.exists() {
                    continue;
                }

                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                // Parse compose file to extract node info
                if let Ok(content) = std::fs::read_to_string(&compose_path) {
                    if let Ok(doc) = serde_yaml::from_str::<serde_yaml::Value>(&content) {
                        let mut daemon_ports = Vec::new();
                        let mut peer_ports = Vec::new();
                        let mut network = String::new();

                        if let Some(services) = doc.get("services").and_then(|s| s.as_mapping()) {
                            let mut idx = 1;
                            loop {
                                let svc_name = format!("rgb_node_{}", idx);
                                if let Some(svc) =
                                    services.get(&serde_yaml::Value::String(svc_name))
                                {
                                    // Extract daemon port from ports list
                                    if let Some(ports) =
                                        svc.get("ports").and_then(|p| p.as_sequence())
                                    {
                                        if let Some(first_port) =
                                            ports.first().and_then(|p| p.as_str())
                                        {
                                            let parts: Vec<&str> = first_port.split(':').collect();
                                            if parts.len() >= 2 {
                                                if let Ok(p) = parts[parts.len() - 2].parse::<u16>()
                                                {
                                                    daemon_ports.push(p);
                                                }
                                            }
                                        }
                                        if let Some(second_port) =
                                            ports.get(1).and_then(|p| p.as_str())
                                        {
                                            let parts: Vec<&str> = second_port.split(':').collect();
                                            if parts.len() >= 2 {
                                                if let Ok(p) = parts[parts.len() - 2].parse::<u16>()
                                                {
                                                    peer_ports.push(p);
                                                }
                                            }
                                        }
                                    }

                                    // Extract network from environment
                                    if network.is_empty() {
                                        if let Some(env) =
                                            svc.get("environment").and_then(|e| e.as_mapping())
                                        {
                                            if let Some(net) = env
                                                .get(&serde_yaml::Value::String(
                                                    "NETWORK".to_string(),
                                                ))
                                                .and_then(|n| n.as_str())
                                            {
                                                // Strip ${NETWORK:-...} wrapper if present
                                                network = if net.starts_with("${NETWORK:-") {
                                                    net.trim_start_matches("${NETWORK:-")
                                                        .trim_end_matches('}')
                                                        .to_string()
                                                } else {
                                                    net.to_string()
                                                };
                                            }
                                        }
                                    }

                                    idx += 1;
                                } else {
                                    break;
                                }
                            }
                        }

                        envs.push(DockerEnvironment {
                            name,
                            compose_dir: path.to_string_lossy().to_string(),
                            node_count: daemon_ports.len() as u16,
                            daemon_ports,
                            peer_ports,
                            network,
                        });
                    }
                }
            }
        }

        envs.sort_by(|a, b| a.name.cmp(&b.name));
        envs
    }

    // ------------------------------------------------------------------
    // Environment creation (compose YAML generation)
    // ------------------------------------------------------------------

    /// Create a new Docker environment — generates docker-compose.yml
    pub fn create_environment(
        config: &DockerSpawnConfig,
        base_dir: Option<&Path>,
    ) -> Result<DockerEnvironment, String> {
        let base = base_dir.map(PathBuf::from).unwrap_or_else(default_base_dir);
        let env_dir = base.join(&config.name);

        // Create directory
        std::fs::create_dir_all(&env_dir)
            .map_err(|e| format!("Failed to create environment directory: {}", e))?;

        // Build compose dict
        let compose = Self::build_compose_dict(config);

        // Write YAML
        let compose_path = env_dir.join(COMPOSE_FILE);
        let yaml_str = serde_yaml::to_string(&compose)
            .map_err(|e| format!("Failed to serialize compose YAML: {}", e))?;
        std::fs::write(&compose_path, &yaml_str)
            .map_err(|e| format!("Failed to write compose file: {}", e))?;

        println!("Compose file written to {:?}", compose_path);

        // Build result
        let mut daemon_ports = Vec::new();
        let mut peer_ports = Vec::new();
        for i in 0..config.count {
            daemon_ports.push(config.base_daemon_port + i);
            peer_ports.push(config.base_peer_port + i);
        }

        Ok(DockerEnvironment {
            name: config.name.clone(),
            compose_dir: env_dir.to_string_lossy().to_string(),
            node_count: config.count,
            daemon_ports,
            peer_ports,
            network: normalize_network_name(&config.network),
        })
    }

    /// Build the docker-compose dict matching kaleido-cli's _build_compose_dict
    fn build_compose_dict(config: &DockerSpawnConfig) -> serde_yaml::Value {
        use serde_yaml::Value;

        let mut services = serde_yaml::Mapping::new();
        let rln_network = normalize_network_name(&config.network);

        for i in 0..config.count {
            let daemon_port = config.base_daemon_port + i;
            let peer_port = config.base_peer_port + i;
            let container_data = format!("/tmp/kaleidoswap/dataldk{}", i);
            let host_data = format!("./volumes/dataldk{}", i);

            let mut cmd_parts = vec![
                format!("{}/", container_data),
                format!("--daemon-listening-port {}", daemon_port),
                format!("--ldk-peer-listening-port {}", peer_port),
            ];
            if config.disable_authentication {
                cmd_parts.push("--disable-authentication".to_string());
            }
            cmd_parts.push(format!("--network {}", rln_network));

            let mut service = serde_yaml::Mapping::new();
            service.insert(
                Value::String("image".into()),
                Value::String(RLN_IMAGE.into()),
            );
            service.insert(
                Value::String("platform".into()),
                Value::String("linux/amd64".into()),
            );
            service.insert(
                Value::String("command".into()),
                Value::String(cmd_parts.join(" ")),
            );
            service.insert(
                Value::String("networks".into()),
                Value::Sequence(vec![Value::String(DEFAULT_NETWORK_NAME.into())]),
            );
            service.insert(
                Value::String("ports".into()),
                Value::Sequence(vec![
                    Value::String(format!("{}:{}", daemon_port, daemon_port)),
                    Value::String(format!("{}:{}", peer_port, peer_port)),
                ]),
            );
            service.insert(
                Value::String("volumes".into()),
                Value::Sequence(vec![Value::String(format!(
                    "{}:{}",
                    host_data, container_data
                ))]),
            );

            // Environment
            let mut env = serde_yaml::Mapping::new();
            env.insert(
                Value::String("APP_ENV".into()),
                Value::String("${APP_ENV:-test}".into()),
            );
            env.insert(
                Value::String("NETWORK".into()),
                Value::String(format!("${{NETWORK:-{}}}", rln_network)),
            );
            env.insert(
                Value::String("DAEMON_PORT".into()),
                Value::Number(daemon_port.into()),
            );
            service.insert(Value::String("environment".into()), Value::Mapping(env));

            // Healthcheck
            let mut healthcheck = serde_yaml::Mapping::new();
            healthcheck.insert(
                Value::String("test".into()),
                Value::Sequence(vec![
                    Value::String("CMD".into()),
                    Value::String("curl".into()),
                    Value::String("-f".into()),
                    Value::String(format!("http://localhost:{}/nodeinfo", daemon_port)),
                ]),
            );
            healthcheck.insert(
                Value::String("interval".into()),
                Value::String("10s".into()),
            );
            healthcheck.insert(Value::String("timeout".into()), Value::String("10s".into()));
            healthcheck.insert(Value::String("retries".into()), Value::Number(3.into()));
            healthcheck.insert(
                Value::String("start_period".into()),
                Value::String("10s".into()),
            );
            service.insert(
                Value::String("healthcheck".into()),
                Value::Mapping(healthcheck),
            );

            service.insert(
                Value::String("extra_hosts".into()),
                Value::Sequence(vec![Value::String("myproxy.local:host-gateway".into())]),
            );
            service.insert(
                Value::String("stop_grace_period".into()),
                Value::String("1m".into()),
            );
            service.insert(
                Value::String("stop_signal".into()),
                Value::String("SIGTERM".into()),
            );

            let svc_name = format!("rgb_node_{}", i + 1);
            services.insert(Value::String(svc_name), Value::Mapping(service));
        }

        // Networks
        let mut networks = serde_yaml::Mapping::new();
        networks.insert(
            Value::String(DEFAULT_NETWORK_NAME.into()),
            Value::Mapping(serde_yaml::Mapping::new()),
        );

        let mut root = serde_yaml::Mapping::new();
        root.insert(Value::String("services".into()), Value::Mapping(services));
        root.insert(Value::String("networks".into()), Value::Mapping(networks));

        Value::Mapping(root)
    }

    // ------------------------------------------------------------------
    // Docker Compose commands
    // ------------------------------------------------------------------

    fn run_compose(compose_dir: &Path, args: &[&str]) -> Result<std::process::Output, String> {
        let mut cmd = Command::new("docker");
        cmd.args(["compose", "--file", COMPOSE_FILE])
            .args(args)
            .current_dir(compose_dir);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd.output()
            .map_err(|e| format!("Failed to run docker compose: {}", e))
    }

    fn run_compose_status(compose_dir: &Path, args: &[&str]) -> Result<bool, String> {
        let output = Self::run_compose(compose_dir, args)?;
        Ok(output.status.success())
    }

    // ------------------------------------------------------------------
    // Node lifecycle
    // ------------------------------------------------------------------

    /// Start the Docker node for a given environment
    pub fn start(
        &self,
        env_name: &str,
        node_index: u16,
        base_dir: Option<&Path>,
    ) -> Result<u16, String> {
        let current_state = self.get_state();
        if matches!(current_state, NodeState::Starting) {
            return Err("Docker node is already starting".to_string());
        }
        if matches!(current_state, NodeState::Stopping) {
            // Wait for stop to complete
            let start = std::time::Instant::now();
            while matches!(self.get_state(), NodeState::Stopping) {
                if start.elapsed() > Duration::from_secs(15) {
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }
        }

        // If running, stop first
        if self.is_running() {
            self.stop()?;
            thread::sleep(Duration::from_secs(1));
        }

        let base = base_dir.map(PathBuf::from).unwrap_or_else(default_base_dir);
        let env_dir = base.join(env_name);
        let compose_path = env_dir.join(COMPOSE_FILE);

        if !compose_path.exists() {
            return Err(format!(
                "No {} found for environment '{}'",
                COMPOSE_FILE, env_name
            ));
        }

        if !Self::is_docker_available() {
            return Err("Docker is not installed or not running".to_string());
        }

        self.set_state(NodeState::Starting);

        // Determine daemon port from compose file
        let daemon_port = Self::get_daemon_port_from_compose(&compose_path, node_index)?;

        // Clear logs
        if let Ok(mut logs) = self.logs.lock() {
            logs.clear();
        }

        // Store current environment info
        if let Ok(mut env) = self.current_environment.lock() {
            *env = Some(env_name.to_string());
        }
        if let Ok(mut dir) = self.compose_dir.lock() {
            *dir = Some(env_dir.clone());
        }
        if let Ok(mut port) = self.daemon_port.lock() {
            *port = Some(daemon_port);
        }

        // Run docker compose up -d
        println!("Starting Docker environment '{}' ...", env_name);
        let output = Self::run_compose(&env_dir, &["up", "-d"])?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let err = format!("docker compose up failed: {}", stderr);
            self.set_state(NodeState::Failed(err.clone()));
            return Err(err);
        }

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        if !stdout_str.is_empty() {
            self.add_log(&stdout_str);
        }
        let stderr_str = String::from_utf8_lossy(&output.stderr);
        if !stderr_str.is_empty() {
            // docker compose up -d prints to stderr normally
            self.add_log(&stderr_str);
        }

        // Spawn monitoring thread
        let (tx, rx) = channel();
        *self.control_sender.lock().unwrap() = Some(tx);

        let state_for_thread = Arc::clone(&self.state);
        let logs_for_thread = Arc::clone(&self.logs);
        let window_for_thread = Arc::clone(&self.window);
        let app_handle_for_thread = Arc::clone(&self.app_handle);
        let current_env_for_thread = Arc::clone(&self.current_environment);
        let compose_dir_for_thread = Arc::clone(&self.compose_dir);
        let daemon_port_for_thread = Arc::clone(&self.daemon_port);
        let env_dir_for_monitor = env_dir.clone();
        let port_for_monitor = daemon_port;

        thread::spawn(move || {
            Self::monitor_loop(
                rx,
                &env_dir_for_monitor,
                port_for_monitor,
                state_for_thread,
                logs_for_thread,
                window_for_thread,
                app_handle_for_thread,
                current_env_for_thread,
                compose_dir_for_thread,
                daemon_port_for_thread,
            );
        });

        Ok(daemon_port)
    }

    /// Stop the running Docker node
    pub fn stop(&self) -> Result<(), String> {
        let state = self.get_state();
        match state {
            NodeState::Running | NodeState::Starting => {
                self.set_state(NodeState::Stopping);

                // Signal monitoring thread to stop
                if let Ok(sender_guard) = self.control_sender.lock() {
                    if let Some(sender) = sender_guard.as_ref() {
                        let _ = sender.send(ControlMessage::Stop);
                    }
                }

                // Run docker compose stop
                if let Ok(dir_guard) = self.compose_dir.lock() {
                    if let Some(dir) = dir_guard.as_ref() {
                        println!("Stopping Docker containers ...");
                        let _ = Self::run_compose(dir, &["stop"]);
                    }
                }

                // Clean up state
                if let Ok(mut env) = self.current_environment.lock() {
                    *env = None;
                }
                if let Ok(mut port) = self.daemon_port.lock() {
                    *port = None;
                }

                self.set_state(NodeState::Stopped);

                // Emit stopped events
                if let Ok(window_guard) = self.window.lock() {
                    if let Some(window) = window_guard.as_ref() {
                        let _ = window.emit("node-stopped", ());
                    }
                }
                if let Ok(app_handle_guard) = self.app_handle.lock() {
                    if let Some(ah) = app_handle_guard.as_ref() {
                        let _ = ah.emit("node-stopped", ());
                    }
                }

                Ok(())
            }
            NodeState::Stopping => {
                println!("Docker node is already stopping.");
                Ok(())
            }
            _ => Err("Docker node is not running".to_string()),
        }
    }

    /// Stop and remove containers
    pub fn down(env_name: &str, base_dir: Option<&Path>) -> Result<(), String> {
        let base = base_dir.map(PathBuf::from).unwrap_or_else(default_base_dir);
        let env_dir = base.join(env_name);

        if !env_dir.join(COMPOSE_FILE).exists() {
            return Err(format!("Environment '{}' not found", env_name));
        }

        let success = Self::run_compose_status(&env_dir, &["down"])?;
        if success {
            Ok(())
        } else {
            Err("docker compose down failed".to_string())
        }
    }

    /// Get logs from Docker containers
    pub fn get_docker_logs(
        env_name: &str,
        tail: u16,
        base_dir: Option<&Path>,
    ) -> Result<Vec<String>, String> {
        let base = base_dir.map(PathBuf::from).unwrap_or_else(default_base_dir);
        let env_dir = base.join(env_name);

        let output = Self::run_compose(&env_dir, &["logs", "--tail", &tail.to_string()])?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        let mut lines: Vec<String> = Vec::new();
        for line in stdout.lines() {
            lines.push(line.to_string());
        }
        for line in stderr.lines() {
            if !line.is_empty() {
                lines.push(line.to_string());
            }
        }
        Ok(lines)
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    fn add_log(&self, msg: &str) {
        if let Ok(mut logs) = self.logs.lock() {
            for line in msg.lines() {
                logs.push(line.to_string());
                if logs.len() > MAX_LOGS_IN_MEMORY {
                    let drain_count = logs.len() - MAX_LOGS_IN_MEMORY;
                    logs.drain(0..drain_count);
                }
            }
        }
    }

    fn get_daemon_port_from_compose(compose_path: &Path, node_index: u16) -> Result<u16, String> {
        let content = std::fs::read_to_string(compose_path)
            .map_err(|e| format!("Failed to read compose file: {}", e))?;
        let doc: serde_yaml::Value = serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse compose YAML: {}", e))?;

        let svc_name = format!("rgb_node_{}", node_index + 1);

        let port_str = doc
            .get("services")
            .and_then(|s| s.get(&svc_name))
            .and_then(|s| s.get("ports"))
            .and_then(|p| p.as_sequence())
            .and_then(|p| p.first())
            .and_then(|p| p.as_str())
            .ok_or_else(|| {
                format!(
                    "Could not find ports for service '{}' in compose file",
                    svc_name
                )
            })?;

        // Parse "HOST:CONTAINER" format
        let parts: Vec<&str> = port_str.split(':').collect();
        if parts.len() >= 2 {
            parts[parts.len() - 2]
                .parse::<u16>()
                .map_err(|e| format!("Invalid port in compose file: {}", e))
        } else {
            Err("Invalid port format in compose file".to_string())
        }
    }

    /// Probe the node's HTTP endpoint for readiness
    /// Probe the node's HTTP endpoint for readiness.
    /// Returns true if the node responds (200 = unlocked, 403 = locked but running).
    fn probe_http(daemon_port: u16) -> bool {
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .ok()
            .and_then(|client| {
                client
                    .get(format!("http://127.0.0.1:{}/nodeinfo", daemon_port))
                    .send()
                    .ok()
            })
            .map(|r| {
                let status = r.status().as_u16();
                // 200 = ready, 403 = locked but node is running and accepting requests
                status == 200 || status == 403
            })
            .unwrap_or(false)
    }

    /// Check container status via docker compose ps
    fn check_container_running(compose_dir: &Path) -> bool {
        if let Ok(output) = Self::run_compose(compose_dir, &["ps", "--format", "json"]) {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // If we get non-empty JSON output with "running", containers are up
            stdout.contains("running")
        } else {
            false
        }
    }

    /// Monitoring loop — runs in a separate thread
    #[allow(clippy::too_many_arguments)]
    fn monitor_loop(
        rx: Receiver<ControlMessage>,
        compose_dir: &Path,
        daemon_port: u16,
        state: Arc<RwLock<NodeState>>,
        logs: Arc<Mutex<Vec<String>>>,
        window: Arc<Mutex<Option<WebviewWindow>>>,
        app_handle: Arc<Mutex<Option<AppHandle>>>,
        current_env: Arc<Mutex<Option<String>>>,
        _compose_dir_arc: Arc<Mutex<Option<PathBuf>>>,
        daemon_port_arc: Arc<Mutex<Option<u16>>>,
    ) {
        let mut became_ready = false;

        loop {
            // Check for stop signal
            match rx.try_recv() {
                Ok(ControlMessage::Stop) => {
                    println!("Docker monitor: received stop signal");
                    break;
                }
                Err(_) => {}
            }

            // Check container status
            let container_running = Self::check_container_running(compose_dir);

            if !container_running {
                // Container stopped or crashed
                let current_state = state
                    .read()
                    .map(|s| s.clone())
                    .unwrap_or(NodeState::Stopped);
                if matches!(current_state, NodeState::Starting | NodeState::Running) {
                    println!("Docker monitor: container stopped unexpectedly");
                    let failed_state =
                        NodeState::Failed("Docker container stopped unexpectedly".to_string());

                    if let Ok(mut s) = state.write() {
                        *s = failed_state.clone();
                    }

                    if let Ok(wg) = window.lock() {
                        if let Some(w) = wg.as_ref() {
                            let _ = w.emit("node-state-changed", failed_state.clone());
                            let _ = w.emit("node-crashed", "Container stopped");
                        }
                    }
                    if let Ok(ag) = app_handle.lock() {
                        if let Some(a) = ag.as_ref() {
                            let _ = a.emit("node-state-changed", failed_state);
                            let _ = a.emit("node-crashed", "Container stopped");
                        }
                    }

                    // Clean up
                    if let Ok(mut env) = current_env.lock() {
                        *env = None;
                    }
                    if let Ok(mut port) = daemon_port_arc.lock() {
                        *port = None;
                    }
                }
                break;
            }

            // Check HTTP readiness
            if !became_ready && Self::probe_http(daemon_port) {
                became_ready = true;
                println!("Docker monitor: node HTTP ready on port {}", daemon_port);

                if let Ok(mut s) = state.write() {
                    *s = NodeState::Running;
                }

                if let Ok(wg) = window.lock() {
                    if let Some(w) = wg.as_ref() {
                        let _ = w.emit("node-state-changed", NodeState::Running);
                        let env_name = current_env
                            .lock()
                            .ok()
                            .and_then(|g| g.clone())
                            .unwrap_or_default();
                        let _ = w.emit("node-started", env_name.clone());
                    }
                }
                if let Ok(ag) = app_handle.lock() {
                    if let Some(a) = ag.as_ref() {
                        let _ = a.emit("node-state-changed", NodeState::Running);
                        let env_name = current_env
                            .lock()
                            .ok()
                            .and_then(|g| g.clone())
                            .unwrap_or_default();
                        let _ = a.emit("node-started", env_name);
                    }
                }
            }

            // Fetch latest logs periodically
            if let Ok(output) =
                Self::run_compose(compose_dir, &["logs", "--tail", "5", "--no-log-prefix"])
            {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Ok(mut logs_guard) = logs.lock() {
                    for line in stdout.lines() {
                        let line_str = line.to_string();
                        // Avoid duplicate log lines
                        if logs_guard.last().map(|l| l != &line_str).unwrap_or(true) {
                            logs_guard.push(line_str.clone());
                            if logs_guard.len() > MAX_LOGS_IN_MEMORY {
                                let drain_count = logs_guard.len() - MAX_LOGS_IN_MEMORY;
                                logs_guard.drain(0..drain_count);
                            }

                            if let Ok(wg) = window.lock() {
                                if let Some(w) = wg.as_ref() {
                                    let _ = w.emit("node-log", line_str);
                                }
                            }
                        }
                    }
                }
            }

            thread::sleep(Duration::from_secs(MONITOR_INTERVAL_SECS));
        }
    }
}
