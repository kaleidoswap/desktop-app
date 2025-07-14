#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, RwLock};
use tauri::{Emitter, Manager, Window};
use once_cell::sync::Lazy;

mod db;
mod rgb_node;
mod log_cache;

use rgb_node::NodeProcess;

#[derive(Default)]
struct CurrentAccount(RwLock<Option<db::Account>>);

#[derive(serde::Serialize)]
pub struct NodeLogsResponse {
    logs: Vec<String>,
    total: u32,
}

fn main() {
    dotenv::dotenv().ok();

    let node_process = Arc::new(Mutex::new(NodeProcess::new()));

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
        .manage(CurrentAccount::default())
        .on_window_event({
            let node_process = Arc::clone(&node_process);
            move |window, event| {
                if window.label() == "main" {
                    match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            println!("Window close requested, initiating shutdown sequence...");

                            // Check if node is running before preventing close
                            let is_node_running = {
                                let node_process = node_process.lock().unwrap();
                                node_process.is_running()
                            };

                            if is_node_running {
                                // Only prevent close and show shutdown animation if node is running
                                let window = window.clone();
                                api.prevent_close();

                                // Trigger initial shutdown animation
                                window
                                    .emit("trigger-shutdown", "Preparing to shut down...")
                                    .unwrap();

                                // Clone Arc before moving into the new thread
                                let node_process = Arc::clone(&node_process);

                                // Create a new thread to handle the shutdown sequence
                                std::thread::spawn(move || {
                                    let node_process = node_process.lock().unwrap();

                                    // Update status
                                    window
                                        .emit(
                                            "update-shutdown-status",
                                            "Shutting down local node...",
                                        )
                                        .unwrap();
                                    println!("Shutting down node...");
                                    node_process.shutdown();

                                    // Wait for node to shut down gracefully with status updates
                                    let mut attempts = 0;
                                    while node_process.is_running() && attempts < 30 {
                                        std::thread::sleep(std::time::Duration::from_millis(100));
                                        attempts += 1;

                                        // Update status every second
                                        if attempts % 10 == 0 {
                                            window
                                                .emit(
                                                    "update-shutdown-status",
                                                    format!(
                                                    "Waiting for node to shut down ({} seconds)...",
                                                    attempts / 10
                                                ),
                                                )
                                                .unwrap();
                                        }
                                    }

                                    // Force kill if still running
                                    if node_process.is_running() {
                                        window
                                            .emit(
                                                "update-shutdown-status",
                                                "Force stopping node...",
                                            )
                                            .unwrap();
                                        println!(
                                            "Node still running after shutdown, forcing kill..."
                                        );
                                        node_process.force_kill();
                                        std::thread::sleep(std::time::Duration::from_millis(500));
                                    }

                                    // Final status update
                                    window
                                        .emit("update-shutdown-status", "Closing application...")
                                        .unwrap();
                                    std::thread::sleep(std::time::Duration::from_millis(500));

                                    // Close the window
                                    window.close().unwrap();
                                });
                            }
                            // If no node is running, allow the window to close normally
                            // by not calling api.prevent_close()
                        }
                        _ => {}
                    }
                }
            }
        })
        .setup({
            let node_process = Arc::clone(&node_process);
            move |app| {
                if let Some(main_window) = app.get_webview_window("main") {
                    node_process.lock().unwrap().set_window(main_window);
                }
                db::init();
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
            // ChannelOrders commands
            insert_channel_order,
            get_channel_orders,
            delete_channel_order,
            // New command
            is_local_node_supported,
            get_markdown_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn close_splashscreen(window: Window) {
    // Show main window first
    window.show().unwrap();
    std::thread::sleep(std::time::Duration::from_millis(1000));
    // Then close splashscreen
    if let Some(splashscreen) = window.get_webview_window("splashscreen") {
        splashscreen.close().unwrap();
    }
}

#[tauri::command]
fn start_node(
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

    // Lock the shared NodeProcess
    let node_process = match node_process.lock() {
        Ok(process) => process,
        Err(e) => {
            let err = format!("Failed to acquire lock on node process: {}", e);
            println!("{}", err);
            return Err(err);
        }
    };

    // Attempt to start; bubble up any errors
    match node_process.start(
        network,
        datapath,
        daemon_listening_port,
        ldk_peer_listening_port,
        account_name,
    ) {
        Ok(_) => {
            println!("Node started successfully");
            Ok(())
        }
        Err(e) => {
            println!("Failed to start node: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
fn stop_node(node_process: tauri::State<'_, Arc<Mutex<NodeProcess>>>) -> Result<(), String> {
    let node_process = node_process.lock().unwrap();
    if node_process.is_running() {
        node_process.stop();
        Ok(())
    } else {
        // Return an error or just Ok(()) – depends on your UI needs
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
    ) {
        Ok(num_rows) => Ok(num_rows),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
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
    _node_process: tauri::State<'_, Arc<Mutex<NodeProcess>>>,
    page: u32,
    page_size: u32
) -> Result<NodeLogsResponse, String> {
    let (logs, total) = log_cache::get_logs(page, page_size);
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
fn insert_channel_order(
    state: tauri::State<CurrentAccount>,
    #[allow(non_snake_case)] orderId: String, 
    status: String, 
    payload: String, 
    #[allow(non_snake_case)] createdAt: String
) -> Result<usize, String> {
    // Get current account
    let current_account = state.0.read().unwrap();
    let account = current_account.as_ref()
        .ok_or_else(|| "No account is currently selected. Please select an account first.".to_string())?;
    
    db::insert_channel_order(account.id, orderId, status, payload, createdAt)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_channel_orders(state: tauri::State<CurrentAccount>) -> Result<Vec<db::ChannelOrder>, String> {
    // Get current account
    let current_account = state.0.read().unwrap();
    let account_id = current_account.as_ref().map(|account| account.id);
    
    db::get_channel_orders(account_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_channel_order(
    state: tauri::State<CurrentAccount>,
    #[allow(non_snake_case)] orderId: String
) -> Result<usize, String> {
    // Get current account
    let current_account = state.0.read().unwrap();
    let account = current_account.as_ref()
        .ok_or_else(|| "No account is currently selected. Please select an account first.".to_string())?;
    
    db::delete_channel_order(account.id, orderId).map_err(|e| e.to_string())
}

#[tauri::command]
fn is_local_node_supported() -> bool {
    rgb_node::NodeProcess::is_local_node_supported()
}

#[tauri::command]
async fn get_markdown_content(file_path: String) -> Result<String, String> {
    let content = tokio::fs::read_to_string(file_path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(content)
}
