use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MindHardware {
    total_memory_bytes: u64,
    available_memory_bytes: u64,
    logical_cores: usize,
    architecture: &'static str,
}

#[tauri::command]
pub fn mind_hardware() -> MindHardware {
    let mut system = sysinfo::System::new();
    system.refresh_memory();
    MindHardware {
        total_memory_bytes: system.total_memory(),
        available_memory_bytes: system.available_memory(),
        logical_cores: std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1),
        architecture: std::env::consts::ARCH,
    }
}
