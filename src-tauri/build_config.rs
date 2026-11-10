use serde_json::Value;

/// Apply a JSON merge patch, as used by the Tauri CLI's configuration overlays.
pub fn merge_config(base: &mut Value, patch: Value) {
    if let Value::Object(patch) = patch {
        if !base.is_object() {
            *base = Value::Object(Default::default());
        }
        let base = base.as_object_mut().expect("object initialized");
        for (key, value) in patch {
            if value.is_null() {
                base.remove(&key);
            } else {
                merge_config(base.entry(key).or_insert(Value::Null), value);
            }
        }
    } else {
        *base = patch;
    }
}
