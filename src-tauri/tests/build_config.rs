#[path = "../build_config.rs"]
mod build_config;

use serde_json::json;

#[test]
fn beta_and_p2p_overlays_reach_the_embedded_app_without_losing_base_settings() {
    let mut config = json!({
        "version": "0.6.0",
        "identifier": "com.kaleidoswap.dev",
        "bundle": {"resources": ["../docs"], "macOS": {"hardenedRuntime": true}},
        "app": {"windows": [{"label": "splashscreen"}], "security": {"csp": "default-src 'self'"}}
    });
    build_config::merge_config(
        &mut config,
        json!({
            "version": "0.7.0-beta.1",
            "bundle": {"resources": ["../docs", "../bin/p2pd*"], "createUpdaterArtifacts": false},
            "app": {"windows": [{"label": "main"}]}
        }),
    );
    assert_eq!(config["version"], "0.7.0-beta.1");
    assert_eq!(
        config["bundle"]["resources"],
        json!(["../docs", "../bin/p2pd*"])
    );
    assert_eq!(config["bundle"]["macOS"]["hardenedRuntime"], true);
    assert_eq!(config["bundle"]["createUpdaterArtifacts"], false);
    assert_eq!(config["app"]["windows"], json!([{"label": "main"}]));
    assert_eq!(config["app"]["security"]["csp"], "default-src 'self'");
    assert_eq!(config["identifier"], "com.kaleidoswap.dev");
}

#[test]
fn null_removes_an_overridden_key() {
    let mut config = json!({"bundle": {"macOS": {"signingIdentity": "old"}}});
    build_config::merge_config(
        &mut config,
        json!({"bundle": {"macOS": {"signingIdentity": null}}}),
    );
    assert!(config["bundle"]["macOS"].get("signingIdentity").is_none());
}
