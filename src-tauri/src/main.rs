#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock};
use tauri::{Emitter, Listener, Manager, Window};

mod crypto;
mod db;
mod dca;
mod docker_node;
mod node_backend;
mod rgb_node;
mod tray;

use dca::{DcaOrderInfo, DcaScheduler};
use docker_node::{DockerEnvironment, DockerNodeManager, DockerSpawnConfig};
use rgb_node::{NodeProcess, NodeState};

#[derive(Default)]
pub(crate) struct CurrentAccount(pub(crate) RwLock<Option<db::Account>>);

#[derive(serde::Serialize)]
pub struct NodeLogsResponse {
    pub logs: Vec<String>,
    pub total: u32,
}

fn main() {
    dotenvy::dotenv().ok();
    let _ = rustls::crypto::ring::default_provider().install_default();

    let node_process = Arc::new(Mutex::new(NodeProcess::new()));
    let docker_manager = Arc::new(Mutex::new(DockerNodeManager::new()));
    let dca_scheduler = Arc::new(DcaScheduler::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::clone(&node_process))
        .manage(Arc::clone(&docker_manager))
        .manage(Arc::clone(&dca_scheduler))
        .manage(CurrentAccount::default())
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.emit("confirm-app-close", ());
                }
            }
        })
        .setup({
            let node_process = Arc::clone(&node_process);
            let docker_manager = Arc::clone(&docker_manager);
            let dca_scheduler = Arc::clone(&dca_scheduler);
            move |app| {
                if let Some(main_window) = app.get_webview_window("main") {
                    node_process.lock().unwrap().set_window(main_window.clone());
                    docker_manager.lock().unwrap().set_window(main_window);
                }
                dca_scheduler.set_app_handle(app.handle().clone());
                // DCA scheduler is started lazily via dca_start_scheduler
                // when the frontend detects the node is unlocked.
                db::init();

                // Set up system tray
                tray::setup_tray(app.handle(), Arc::clone(&node_process))?;

                // Listen for node state changes to update tray menu
                let app_handle = app.handle().clone();
                app.listen("node-started", move |_| {
                    tray::update_tray_menu(&app_handle, NodeState::Running);
                });

                let app_handle = app.handle().clone();
                app.listen("node-stopped", move |_| {
                    tray::update_tray_menu(&app_handle, NodeState::Stopped);
                });

                let app_handle = app.handle().clone();
                app.listen("node-crashed", move |_| {
                    tray::update_tray_menu(
                        &app_handle,
                        NodeState::Failed("Node crashed".to_string()),
                    );
                });

                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            // DB commands
            get_accounts,
            insert_account,
            update_account,
            delete_account,
            check_account_exists,
            set_current_account,
            get_current_account,
            get_account_by_name,
            // Node commands
            start_node,
            stop_node,
            get_node_logs,
            save_logs_to_file,
            is_node_running,
            get_running_node_account,
            get_node_state,
            probe_node_http,
            hide_main_window,
            quit_app,
            shutdown_node_and_quit,
            // Port management commands
            check_ports_available,
            get_running_node_ports,
            find_available_ports,
            stop_node_by_account,
            kill_processes_on_ports,
            // ChannelOrders commands
            insert_channel_order,
            get_channel_orders,
            delete_channel_order,
            // Mnemonic encryption commands
            store_encrypted_mnemonic,
            get_decrypted_mnemonic,
            // New command
            is_local_node_supported,
            get_local_node_capabilities,
            get_markdown_content,
            // DCA commands
            dca_start_scheduler,
            dca_stop_scheduler,
            dca_set_orders,
            dca_order_executed,
            dca_get_orders,
            dca_upsert_order,
            dca_delete_order,
            // LimitOrder commands
            limit_get_orders,
            limit_upsert_order,
            limit_delete_order,
            // Docker node commands
            check_docker_environment,
            is_docker_available,
            list_docker_environments,
            create_docker_environment,
            start_docker_node,
            stop_docker_node,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn close_splashscreen(window: Window) {
    // Resolve the Tauri command immediately so renderer reloads don't leave a stale callback.
    window.show().unwrap();

    tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(std::time::Duration::from_millis(1000));
        if let Some(splashscreen) = window.get_webview_window("splashscreen") {
            let _ = splashscreen.close();
        }
    });
}

#[tauri::command]
fn hide_main_window(window: Window) -> Result<(), String> {
    window
        .hide()
        .map_err(|e| format!("Failed to hide main window: {}", e))?;

    #[cfg(target_os = "macos")]
    {
        let app = window.app_handle();
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }

    Ok(())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn shutdown_node_and_quit(
    app: tauri::AppHandle,
    node_process: tauri::State<'_, Arc<Mutex<NodeProcess>>>,
) {
    tray::shutdown_node_and_exit(app, Arc::clone(&*node_process));
}

#[tauri::command]
async fn start_node(
    node_process: tauri::State<'_, Arc<Mutex<NodeProcess>>>,
    network: String,
    datapath: Option<String>,
    daemon_listening_port: String,
    ldk_peer_listening_port: String,
    account_name: String,
) -> Result<(), String> {
    println!("Received start_node command for account: {}", account_name);
    println!("Parameters:");
    println!("  Network: {}", network);
    println!("  Datapath: {:?}", datapath);
    println!("  Daemon port: {}", daemon_listening_port);
    println!("  LDK peer port: {}", ldk_peer_listening_port);

    let node_process = Arc::clone(&*node_process);
    let account_name_for_spawn = account_name.clone();

    let spawn_result = tauri::async_runtime::spawn_blocking({
        let node_process = Arc::clone(&node_process);
        move || {
            let node_process = match node_process.lock() {
                Ok(process) => process,
                Err(e) => {
                    let err = format!("Failed to acquire lock on node process: {}", e);
                    println!("{}", err);
                    return Err(err);
                }
            };

            let state_arc = node_process.get_state_arc();
            let daemon_port = match node_process.start_spawn_only(
                network,
                datapath,
                daemon_listening_port,
                ldk_peer_listening_port,
                account_name_for_spawn,
            ) {
                Ok(port) => port,
                Err(e) => {
                    println!("Failed to start node: {}", e);
                    return Err(e);
                }
            };

            Ok::<_, String>((daemon_port, state_arc))
        }
    })
    .await
    .map_err(|e| format!("Failed to join node startup task: {}", e))?;

    let (daemon_port, state_arc) = spawn_result?;
    let node_process_for_readiness = Arc::clone(&node_process);
    let account_name_for_readiness = account_name.clone();

    tauri::async_runtime::spawn_blocking(move || {
        if let Err(readiness_error) =
            NodeProcess::wait_for_http_ready_static(daemon_port, state_arc)
        {
            let err = format!(
                "Node process started but never became ready: {}",
                readiness_error
            );

            if let Ok(node_process) = node_process_for_readiness.lock() {
                node_process.handle_http_wait_error(&readiness_error);
            }

            println!("Failed to start node: {}", err);
            return Err(err);
        }

        match node_process_for_readiness.lock() {
            Ok(node_process) => {
                node_process.finalize_running(&account_name_for_readiness);
                println!("Node started successfully");
                Ok(())
            }
            Err(e) => {
                let err = format!(
                    "Failed to acquire lock on node process after readiness: {}",
                    e
                );
                println!("{}", err);
                Err(err)
            }
        }
    })
    .await
    .map_err(|e| format!("Failed to join node readiness task: {}", e))??;

    println!("start_node command returning success");
    Ok(())
}

#[tauri::command]
fn stop_node(node_process: tauri::State<'_, Arc<Mutex<NodeProcess>>>) -> Result<(), String> {
    let node_process = node_process.lock().unwrap();
    if node_process.is_running() {
        node_process.stop();
        Ok(())
    } else {
        Err("RGB Lightning Node is not running.".to_string())
    }
}

#[tauri::command]
fn get_accounts() -> Result<Vec<db::Account>, String> {
    match db::get_accounts() {
        Ok(configs) => Ok(configs),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn insert_account(
    name: String,
    network: String,
    datapath: Option<String>,
    rpc_connection_url: String,
    node_url: String,
    indexer_url: String,
    proxy_endpoint: String,
    default_lsp_url: String,
    maker_urls: String,
    default_maker_url: String,
    daemon_listening_port: String,
    ldk_peer_listening_port: String,
    bearer_token: Option<String>,
    language: Option<String>,
) -> Result<usize, String> {
    match db::insert_account(
        name,
        network,
        datapath,
        rpc_connection_url,
        node_url,
        indexer_url,
        proxy_endpoint,
        default_lsp_url,
        maker_urls,
        default_maker_url,
        daemon_listening_port,
        ldk_peer_listening_port,
        bearer_token,
        language,
    ) {
        Ok(num_rows) => Ok(num_rows),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn update_account(
    name: String,
    network: String,
    datapath: Option<String>,
    rpc_connection_url: String,
    node_url: String,
    indexer_url: String,
    proxy_endpoint: String,
    default_lsp_url: String,
    maker_urls: String,
    default_maker_url: String,
    daemon_listening_port: String,
    ldk_peer_listening_port: String,
    bearer_token: Option<String>,
    language: Option<String>,
) -> Result<usize, String> {
    match db::update_account(
        name,
        network,
        datapath,
        rpc_connection_url,
        node_url,
        indexer_url,
        proxy_endpoint,
        default_lsp_url,
        maker_urls,
        default_maker_url,
        daemon_listening_port,
        ldk_peer_listening_port,
        bearer_token,
        language,
    ) {
        Ok(num_rows) => Ok(num_rows),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_account(
    node_process: tauri::State<Arc<Mutex<NodeProcess>>>,
    name: String,
) -> Result<usize, String> {
    println!("Attempting to delete account: {}", name);

    // Stop the node if it's running
    let node_process = node_process.lock().unwrap();
    if node_process.is_running() {
        println!("Stopping node for account: {}", name);
        node_process.stop();
    }

    match db::delete_account(name.clone()) {
        Ok(num_rows) => {
            println!("Successfully deleted account: {}", name);
            Ok(num_rows)
        }
        Err(e) => {
            println!("Failed to delete account {}: {}", name, e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
fn check_account_exists(name: String) -> Result<bool, String> {
    match db::check_account_exists(&name) {
        Ok(exists) => Ok(exists),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn set_current_account(
    state: tauri::State<CurrentAccount>,
    account_name: String,
) -> Result<db::Account, String> {
    let accounts = db::get_accounts().map_err(|e| e.to_string())?;
    let account = accounts
        .into_iter()
        .find(|a| a.name == account_name)
        .ok_or_else(|| "Account not found".to_string())?;

    *state.0.write().unwrap() = Some(account.clone());
    Ok(account)
}

#[tauri::command]
fn get_current_account(state: tauri::State<CurrentAccount>) -> Option<db::Account> {
    state.0.read().unwrap().clone()
}

#[tauri::command]
fn get_account_by_name(name: String) -> Result<Option<db::Account>, String> {
    match db::get_account_by_name(&name) {
        Ok(account) => Ok(account),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn get_node_logs(
    node_process: tauri::State<'_, Arc<Mutex<NodeProcess>>>,
    page: u32,
    page_size: u32,
) -> Result<NodeLogsResponse, String> {
    let node_process = node_process.lock().unwrap();
    let all_logs = node_process.get_logs();
    let total = all_logs.len() as u32;

    let start = ((page - 1) * page_size) as usize;
    let end = std::cmp::min(start + page_size as usize, all_logs.len());

    let logs = if start < all_logs.len() {
        all_logs[start..end].to_vec()
    } else {
        Vec::new()
    };

    Ok(NodeLogsResponse { logs, total })
}

#[tauri::command]
async fn save_logs_to_file(
    node_process: tauri::State<'_, Arc<Mutex<NodeProcess>>>,
    file_path: String,
) -> Result<(), String> {
    node_process.lock().unwrap().save_logs_to_file(&file_path)
}

#[tauri::command]
fn is_node_running(
    node_process: tauri::State<'_, Arc<Mutex<NodeProcess>>>,
    account_name: Option<String>,
) -> bool {
    let node_process = node_process.lock().unwrap();
    if let Some(account_name) = account_name {
        node_process.is_running_for_account(&account_name)
    } else {
        node_process.is_running()
    }
}

#[tauri::command]
fn get_running_node_account(
    node_process: tauri::State<'_, Arc<Mutex<NodeProcess>>>,
) -> Option<String> {
    node_process.lock().unwrap().get_current_account()
}

#[tauri::command]
fn get_node_state(node_process: tauri::State<'_, Arc<Mutex<NodeProcess>>>) -> rgb_node::NodeState {
    node_process.lock().unwrap().get_state()
}

#[tauri::command]
fn probe_node_http(daemon_port: u16) -> Result<u16, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(format!("http://127.0.0.1:{}/nodeinfo", daemon_port))
        .send()
        .map_err(|e| format!("Failed to reach node on port {}: {}", daemon_port, e))?;

    Ok(response.status().as_u16())
}

#[tauri::command]
fn check_ports_available(ports: Vec<String>) -> Result<HashMap<String, bool>, String> {
    let mut result = HashMap::new();
    for port in ports {
        match port.parse::<u16>() {
            Ok(port_num) => {
                result.insert(
                    port.clone(),
                    rgb_node::NodeProcess::is_port_available(port_num),
                );
            }
            Err(e) => {
                return Err(format!("Invalid port number {}: {}", port, e));
            }
        }
    }
    Ok(result)
}

#[tauri::command]
fn get_running_node_ports(
    node_process: tauri::State<Arc<Mutex<rgb_node::NodeProcess>>>,
) -> HashMap<String, String> {
    node_process.lock().unwrap().get_running_node_ports()
}

#[tauri::command]
fn find_available_ports(
    base_daemon_port: Option<u16>,
    base_ldk_port: Option<u16>,
) -> Result<HashMap<String, u16>, String> {
    let (daemon_port, ldk_port) = rgb_node::NodeProcess::find_available_ports(
        base_daemon_port.unwrap_or(3001),
        base_ldk_port.unwrap_or(9735),
    );

    let mut result = HashMap::new();
    result.insert("daemon".to_string(), daemon_port);
    result.insert("ldk".to_string(), ldk_port);
    Ok(result)
}

#[tauri::command]
fn stop_node_by_account(
    node_process: tauri::State<Arc<Mutex<rgb_node::NodeProcess>>>,
    account_name: String,
) -> Result<(), String> {
    let node_process = node_process.lock().unwrap();
    node_process.stop_by_account(&account_name)
}

#[tauri::command]
fn kill_processes_on_ports(ports: Vec<u16>) -> Result<HashMap<u16, bool>, String> {
    let mut results = HashMap::new();
    for port in ports {
        let killed = kill_process_on_port(port);
        results.insert(port, killed);
    }
    // Give OS time to release the ports
    std::thread::sleep(std::time::Duration::from_millis(1500));
    Ok(results)
}

#[cfg(unix)]
fn kill_process_on_port(port: u16) -> bool {
    use std::process::Command;

    // Use lsof to find the PID listening on the port
    let output = Command::new("lsof")
        .args(["-ti", &format!(":{}", port)])
        .output();

    match output {
        Ok(out) => {
            let pids_str = String::from_utf8_lossy(&out.stdout);
            let pids: Vec<&str> = pids_str.trim().lines().collect();
            if pids.is_empty() || pids[0].is_empty() {
                return false;
            }
            let mut any_killed = false;
            for pid_str in pids {
                if let Ok(pid) = pid_str.trim().parse::<i32>() {
                    println!("Killing process {} on port {}", pid, port);
                    unsafe {
                        libc::kill(pid, libc::SIGTERM);
                    }
                    any_killed = true;
                }
            }
            // If SIGTERM didn't work, try SIGKILL after a short wait
            if any_killed {
                std::thread::sleep(std::time::Duration::from_millis(500));
                let recheck = Command::new("lsof")
                    .args(["-ti", &format!(":{}", port)])
                    .output();
                if let Ok(out) = recheck {
                    let remaining = String::from_utf8_lossy(&out.stdout);
                    for pid_str in remaining.trim().lines() {
                        if let Ok(pid) = pid_str.trim().parse::<i32>() {
                            println!("Force killing process {} on port {}", pid, port);
                            unsafe {
                                libc::kill(pid, libc::SIGKILL);
                            }
                        }
                    }
                }
            }
            any_killed
        }
        Err(e) => {
            eprintln!("Failed to run lsof for port {}: {}", port, e);
            false
        }
    }
}

#[cfg(windows)]
fn kill_process_on_port(port: u16) -> bool {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Use netstat to find the PID listening on the port
    let output = Command::new("netstat")
        .args(["-ano", "-p", "TCP"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match output {
        Ok(out) => {
            let output_str = String::from_utf8_lossy(&out.stdout);
            let mut any_killed = false;

            for line in output_str.lines() {
                // Match lines like "  TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING    12345"
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 5 && parts[3] == "LISTENING" {
                    if let Some(addr) = parts[1].rsplit(':').next() {
                        if addr == port.to_string() {
                            if let Ok(pid) = parts[4].parse::<u32>() {
                                println!("Killing process {} on port {}", pid, port);
                                let kill_result = Command::new("taskkill")
                                    .args(["/PID", &pid.to_string(), "/F"])
                                    .creation_flags(CREATE_NO_WINDOW)
                                    .output();
                                if let Ok(kill_out) = kill_result {
                                    if kill_out.status.success() {
                                        any_killed = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            any_killed
        }
        Err(e) => {
            eprintln!("Failed to run netstat for port {}: {}", port, e);
            false
        }
    }
}

#[cfg(not(any(unix, windows)))]
fn kill_process_on_port(_port: u16) -> bool {
    false
}

#[tauri::command]
fn insert_channel_order(
    state: tauri::State<CurrentAccount>,
    #[allow(non_snake_case)] orderId: String,
    status: String,
    payload: String,
    #[allow(non_snake_case)] createdAt: String,
) -> Result<usize, String> {
    // Get current account
    let current_account = state.0.read().unwrap();
    let account = current_account.as_ref().ok_or_else(|| {
        "No account is currently selected. Please select an account first.".to_string()
    })?;

    db::insert_channel_order(account.id, orderId, status, payload, createdAt)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_channel_orders(
    state: tauri::State<CurrentAccount>,
) -> Result<Vec<db::ChannelOrder>, String> {
    // Get current account
    let current_account = state.0.read().unwrap();
    let account_id = current_account.as_ref().map(|account| account.id);

    db::get_channel_orders(account_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_channel_order(
    state: tauri::State<CurrentAccount>,
    #[allow(non_snake_case)] orderId: String,
) -> Result<usize, String> {
    // Get current account
    let current_account = state.0.read().unwrap();
    let account = current_account.as_ref().ok_or_else(|| {
        "No account is currently selected. Please select an account first.".to_string()
    })?;

    db::delete_channel_order(account.id, orderId).map_err(|e| e.to_string())
}

#[tauri::command]
fn is_local_node_supported() -> bool {
    // Local node is supported if native binary OR Docker is available
    rgb_node::NodeProcess::is_local_node_supported() || DockerNodeManager::is_docker_available()
}

#[tauri::command]
fn get_local_node_capabilities() -> HashMap<String, bool> {
    let mut caps = HashMap::new();
    caps.insert(
        "native".to_string(),
        rgb_node::NodeProcess::is_local_node_supported(),
    );
    caps.insert(
        "docker".to_string(),
        DockerNodeManager::is_docker_available(),
    );
    caps
}

#[tauri::command]
async fn get_markdown_content(app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    use std::path::PathBuf;

    // Resolve the file path: if it's a relative path starting with "../docs/",
    // resolve it against the resource directory (for bundled builds) or the
    // Cargo manifest directory (for dev builds).
    let resolved_path = if file_path.starts_with("../docs/") {
        let filename = file_path.strip_prefix("../docs/").unwrap_or(&file_path);

        if cfg!(debug_assertions) {
            // Dev mode: resolve relative to the Cargo manifest dir
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("docs")
                .join(filename)
        } else {
            // Production: resolve from the bundled resource directory
            let resource_dir = app
                .path()
                .resource_dir()
                .map_err(|e| format!("Failed to get resource directory: {}", e))?;

            // Tauri bundles "../docs" as "_up_/docs" on macOS/Linux
            let candidate = resource_dir.join("_up_").join("docs").join(filename);
            if candidate.exists() {
                candidate
            } else {
                // Fallback: try "docs" directly (Windows layout)
                resource_dir.join("docs").join(filename)
            }
        }
    } else {
        PathBuf::from(&file_path)
    };

    let content = tokio::fs::read_to_string(&resolved_path)
        .await
        .map_err(|e| format!("Failed to read {}: {}", resolved_path.display(), e))?;
    Ok(content)
}

/// Store encrypted mnemonic for an account
///
/// This command encrypts the mnemonic using the user's password and stores it securely
/// in the database. The encryption uses AES-256-GCM with Argon2id key derivation.
#[tauri::command]
fn store_encrypted_mnemonic(
    account_name: String,
    mnemonic: String,
    password: String,
) -> Result<(), String> {
    // Encrypt the mnemonic
    let (encrypted, salt, nonce) = crypto::encrypt_mnemonic(&mnemonic, &password)
        .map_err(|e| format!("Failed to encrypt mnemonic: {}", e))?;

    // Store in database
    db::store_encrypted_mnemonic(&account_name, &encrypted, &salt, &nonce)
        .map_err(|e| format!("Failed to store encrypted mnemonic: {}", e))?;

    Ok(())
}

#[tauri::command]
fn dca_get_orders(state: tauri::State<CurrentAccount>) -> Result<Vec<String>, String> {
    let current_account = state.0.read().unwrap();
    let account = current_account
        .as_ref()
        .ok_or_else(|| "No account selected".to_string())?;
    db::get_dca_orders(account.id).map_err(|e| e.to_string())
}

#[tauri::command]
fn dca_upsert_order(
    state: tauri::State<CurrentAccount>,
    order_id: String,
    payload: String,
) -> Result<usize, String> {
    let current_account = state.0.read().unwrap();
    let account = current_account
        .as_ref()
        .ok_or_else(|| "No account selected".to_string())?;
    db::upsert_dca_order(account.id, order_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn dca_delete_order(
    state: tauri::State<CurrentAccount>,
    order_id: String,
) -> Result<usize, String> {
    let current_account = state.0.read().unwrap();
    let account = current_account
        .as_ref()
        .ok_or_else(|| "No account selected".to_string())?;
    db::delete_dca_order(account.id, order_id).map_err(|e| e.to_string())
}

/// Start the DCA scheduler (called when node becomes unlocked).
#[tauri::command]
fn dca_start_scheduler(scheduler: tauri::State<'_, Arc<DcaScheduler>>) {
    scheduler.start();
}

/// Stop the DCA scheduler (called when node is locked/stopped).
#[tauri::command]
fn dca_stop_scheduler(scheduler: tauri::State<'_, Arc<DcaScheduler>>) {
    scheduler.stop();
}

/// Update the DCA scheduler with the current list of active orders from the frontend.
#[tauri::command]
fn dca_set_orders(scheduler: tauri::State<'_, Arc<DcaScheduler>>, orders: Vec<DcaOrderInfo>) {
    scheduler.set_orders(orders);
}

/// Called by the frontend after a DCA execution to update last_executed_at timestamp.
#[tauri::command]
fn dca_order_executed(
    scheduler: tauri::State<'_, Arc<DcaScheduler>>,
    order_id: String,
    timestamp: u64,
) {
    scheduler.update_last_executed(&order_id, timestamp);
}

#[tauri::command]
fn limit_get_orders(state: tauri::State<CurrentAccount>) -> Result<Vec<String>, String> {
    let current_account = state.0.read().unwrap();
    let account = current_account
        .as_ref()
        .ok_or_else(|| "No account selected".to_string())?;
    db::get_limit_orders(account.id).map_err(|e| e.to_string())
}

#[tauri::command]
fn limit_upsert_order(
    state: tauri::State<CurrentAccount>,
    order_id: String,
    payload: String,
) -> Result<usize, String> {
    let current_account = state.0.read().unwrap();
    let account = current_account
        .as_ref()
        .ok_or_else(|| "No account selected".to_string())?;
    db::upsert_limit_order(account.id, order_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn limit_delete_order(
    state: tauri::State<CurrentAccount>,
    order_id: String,
) -> Result<usize, String> {
    let current_account = state.0.read().unwrap();
    let account = current_account
        .as_ref()
        .ok_or_else(|| "No account selected".to_string())?;
    db::delete_limit_order(account.id, order_id).map_err(|e| e.to_string())
}

/// Retrieve and decrypt mnemonic for an account
///
/// This command retrieves the encrypted mnemonic from the database and decrypts it
/// using the provided password. Returns an error if the password is incorrect.
#[tauri::command]
fn get_decrypted_mnemonic(
    state: tauri::State<CurrentAccount>,
    password: String,
) -> Result<String, String> {
    // Get current account
    let current_account = state.0.read().unwrap();
    let account = current_account
        .as_ref()
        .ok_or_else(|| "No account is currently selected.".to_string())?;

    // Retrieve encrypted mnemonic from database
    let (encrypted, salt, nonce) = db::get_encrypted_mnemonic(&account.name)
        .map_err(|e| format!("Failed to retrieve encrypted mnemonic: {}", e))?
        .ok_or_else(|| "No mnemonic stored for this account.".to_string())?;

    // Decrypt the mnemonic
    let mnemonic = crypto::decrypt_mnemonic(&encrypted, &password, &salt, &nonce).map_err(|e| {
        format!(
            "Failed to decrypt mnemonic: {}. This usually means the password is incorrect.",
            e
        )
    })?;

    Ok(mnemonic)
}

// ---------------------------------------------------------------------------
// Docker node management commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn check_docker_environment(account_name: String) -> Option<DockerEnvironment> {
    DockerNodeManager::check_environment_exists(&account_name)
}

#[tauri::command]
fn is_docker_available() -> bool {
    DockerNodeManager::is_docker_available()
}

#[tauri::command]
fn list_docker_environments() -> Vec<DockerEnvironment> {
    DockerNodeManager::list_environments(None)
}

#[tauri::command]
fn create_docker_environment(config: DockerSpawnConfig) -> Result<DockerEnvironment, String> {
    DockerNodeManager::create_environment(&config, None)
}

#[tauri::command]
async fn start_docker_node(
    docker_manager: tauri::State<'_, Arc<Mutex<DockerNodeManager>>>,
    env_name: String,
    node_index: Option<u16>,
) -> Result<u16, String> {
    println!("Starting Docker node for environment: {}", env_name);
    let docker_manager = Arc::clone(&*docker_manager);
    let idx = node_index.unwrap_or(0);

    tauri::async_runtime::spawn_blocking(move || {
        let dm = docker_manager
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        dm.start(&env_name, idx, None)
    })
    .await
    .map_err(|e| format!("Failed to join Docker startup task: {}", e))?
}

#[tauri::command]
fn stop_docker_node(
    docker_manager: tauri::State<'_, Arc<Mutex<DockerNodeManager>>>,
) -> Result<(), String> {
    let dm = docker_manager.lock().unwrap();
    dm.stop()
}
