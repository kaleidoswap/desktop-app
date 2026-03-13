use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::{
    rgb_node::{NodeProcess, NodeState},
    CurrentAccount,
};

pub const TRAY_ID: &str = "main-tray";
const MENU_OPEN_ID: &str = "open";
const MENU_NODE_STATUS_ID: &str = "node-status";
const MENU_START_STOP_ID: &str = "start-stop-node";
const MENU_QUIT_ID: &str = "quit";

fn node_status_label(state: &NodeState) -> String {
    match state {
        NodeState::Stopped => "Node: Stopped".to_string(),
        NodeState::Starting => "Node: Starting...".to_string(),
        NodeState::Running => "Node: Running \u{25cf}".to_string(),
        NodeState::Stopping => "Node: Stopping...".to_string(),
        NodeState::Failed(_) => "Node: Failed".to_string(),
    }
}

fn start_stop_label(state: &NodeState) -> String {
    match state {
        NodeState::Running | NodeState::Starting | NodeState::Stopping => "Stop Node".to_string(),
        NodeState::Stopped | NodeState::Failed(_) => "Start Node".to_string(),
    }
}

fn build_tray_menu(app: &AppHandle, node_state: &NodeState) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;

    let open = MenuItem::with_id(app, MENU_OPEN_ID, "Open KaleidoSwap", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let node_status = MenuItem::with_id(
        app,
        MENU_NODE_STATUS_ID,
        node_status_label(node_state),
        false,
        None::<&str>,
    )?;
    let start_stop = MenuItem::with_id(
        app,
        MENU_START_STOP_ID,
        start_stop_label(node_state),
        true,
        None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, MENU_QUIT_ID, "Quit KaleidoSwap", true, None::<&str>)?;

    menu.append(&open)?;
    menu.append(&sep1)?;
    menu.append(&node_status)?;
    menu.append(&start_stop)?;
    menu.append(&sep2)?;
    menu.append(&quit)?;

    Ok(menu)
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        #[cfg(target_os = "macos")]
        {
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
        }
    }
}

pub fn update_tray_menu(app: &AppHandle, node_state: NodeState) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Ok(new_menu) = build_tray_menu(app, &node_state) {
            let _ = tray.set_menu(Some(new_menu));
        }
    }
}

pub fn setup_tray(app: &AppHandle, node_process: Arc<Mutex<NodeProcess>>) -> tauri::Result<()> {
    let icon = app.default_window_icon().cloned().unwrap();

    let node_state = node_process.lock().unwrap().get_state();
    let menu = build_tray_menu(app, &node_state)?;

    let np_for_menu = Arc::clone(&node_process);

    let tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .tooltip("KaleidoSwap")
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event.id().as_ref(), Arc::clone(&np_for_menu));
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { .. } = event {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    app.manage(tray);

    Ok(())
}

fn handle_menu_event(app: &AppHandle, id: &str, node_process: Arc<Mutex<NodeProcess>>) {
    match id {
        MENU_OPEN_ID => {
            show_main_window(app);
        }
        MENU_START_STOP_ID => {
            let state = node_process.lock().unwrap().get_state();
            match state {
                NodeState::Running | NodeState::Starting | NodeState::Stopping => {
                    update_tray_menu(app, NodeState::Stopping);
                    let np = Arc::clone(&node_process);
                    std::thread::spawn(move || {
                        perform_graceful_shutdown(np, None);
                    });
                }
                NodeState::Stopped | NodeState::Failed(_) => {
                    if !start_selected_local_node(app.clone(), Arc::clone(&node_process)) {
                        show_main_window(app);
                    }
                }
            }
        }
        MENU_QUIT_ID => {
            update_tray_menu(app, NodeState::Stopping);
            shutdown_node_and_exit(app.clone(), Arc::clone(&node_process));
        }
        _ => {}
    }
}

pub fn shutdown_node_and_exit(app: AppHandle, node_process: Arc<Mutex<NodeProcess>>) {
    std::thread::spawn(move || {
        perform_graceful_shutdown(node_process, None);
        app.exit(0);
    });
}

fn start_selected_local_node(app: AppHandle, node_process: Arc<Mutex<NodeProcess>>) -> bool {
    let account = match app
        .state::<CurrentAccount>()
        .0
        .read()
        .ok()
        .and_then(|g| g.clone())
    {
        Some(account) => account,
        None => return false,
    };

    let datapath = match account.datapath.clone() {
        Some(datapath) if !datapath.is_empty() => Some(datapath),
        _ => return false,
    };

    update_tray_menu(&app, NodeState::Starting);

    std::thread::spawn(move || {
        let result = node_process
            .lock()
            .map_err(|e| e.to_string())
            .and_then(|np| {
                np.start(
                    account.network.clone(),
                    datapath,
                    account.daemon_listening_port.clone(),
                    account.ldk_peer_listening_port.clone(),
                    account.name.clone(),
                )
            });

        if let Err(error) = result {
            eprintln!("Failed to start node from tray: {}", error);
            update_tray_menu(&app, NodeState::Failed(error));
            show_main_window(&app);
        }
    });

    true
}

fn perform_graceful_shutdown(
    node_process: Arc<Mutex<NodeProcess>>,
    status_cb: Option<Box<dyn Fn(String) + Send + 'static>>,
) {
    let daemon_port = node_process.lock().ok().and_then(|np| np.get_daemon_port());

    if let Some(port) = daemon_port {
        let http = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap_or_else(|_| reqwest::blocking::Client::new());

        if let Some(ref cb) = status_cb {
            cb("Shutting down local node...".to_string());
        }

        let _ = http
            .post(format!("http://127.0.0.1:{}/shutdown", port))
            .send();
    } else if let Some(ref cb) = status_cb {
        cb("Shutting down local node...".to_string());
    }

    let wait_start = Instant::now();
    let mut attempts = 0;
    while wait_start.elapsed() < Duration::from_secs(10) {
        let is_running = node_process
            .lock()
            .map(|np| np.is_running())
            .unwrap_or(false);
        if !is_running {
            break;
        }

        std::thread::sleep(std::time::Duration::from_millis(100));
        attempts += 1;

        if attempts % 10 == 0 {
            if let Some(ref cb) = status_cb {
                cb(format!(
                    "Waiting for node to shut down ({} seconds)...",
                    attempts / 10
                ));
            }
        }
    }

    let still_running = node_process
        .lock()
        .map(|np| np.is_running())
        .unwrap_or(false);

    if still_running {
        if let Some(ref cb) = status_cb {
            cb("Force stopping node...".to_string());
        }
        if let Ok(node_process) = node_process.lock() {
            node_process.force_kill();
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    }

    if let Some(ref cb) = status_cb {
        cb("Closing application...".to_string());
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
}
