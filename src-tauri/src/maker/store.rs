//! A small JSON file per piece of maker state, written whole and private to the user.

use std::path::PathBuf;

use serde::de::DeserializeOwned;
use serde::Serialize;

pub struct JsonFile<T> {
    path: PathBuf,
    pub value: T,
}

impl<T: Serialize + DeserializeOwned + Default> JsonFile<T> {
    /// What `path` holds, or the default when it is missing or unreadable.
    pub fn load(path: PathBuf) -> Self {
        let value = std::fs::read(&path)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default();
        Self { path, value }
    }

    pub fn save(&self) {
        if let Err(e) = write(&self.path, &self.value) {
            log::error!("[maker] could not save {}: {e}", self.path.display());
        }
    }
}

/// Write `value` to `path` through a temporary file, readable by the user only.
pub fn write<T: Serialize>(path: &std::path::Path, value: &T) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    let body = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, body).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

pub fn read<T: DeserializeOwned>(path: &std::path::Path) -> Result<Option<T>, String> {
    match std::fs::read(path) {
        Ok(b) => serde_json::from_slice(&b)
            .map(Some)
            .map_err(|e| format!("{}: {e}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("{}: {e}", path.display())),
    }
}
