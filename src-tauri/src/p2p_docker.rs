//! Running the P2P daemon under Docker, for systems where it is not bundled (Windows).
//!
//! The same daemon, in a container: its port is published on the host's loopback only, the wallet
//! lives in a named volume, and the key file in it is sealed with a passphrase the app made and keeps
//! in the OS credential store. The recovery phrase still reaches it on stdin, never in an argument,
//! and the passphrase and API token travel as environment variables, so neither shows in the
//! process list.
//!
//! The image is pinned like the node's: `p2pd.image` at the root of the repository names it, and a
//! placeholder there means it has not been published yet.

use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::p2p::P2pStartConfig;

const IMAGE_FILE: &str = include_str!("../../p2pd.image");

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// A `docker` command that does not flash a console window on Windows.
pub fn docker() -> Command {
    #[cfg_attr(not(target_os = "windows"), allow(unused_mut))]
    let mut c = Command::new("docker");
    #[cfg(target_os = "windows")]
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

/// The image to run, or why there is none. `KALEIDO_P2PD_IMAGE` overrides the pinned one in development.
pub fn image() -> Result<String, String> {
    let named =
        std::env::var("KALEIDO_P2PD_IMAGE").unwrap_or_else(|_| IMAGE_FILE.trim().to_string());
    pinned(&named)
}

fn pinned(image: &str) -> Result<String, String> {
    if image.is_empty() || image.contains("unpublished") {
        Err("the P2P daemon image is not published yet".into())
    } else {
        Ok(image.to_string())
    }
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Engine {
    /// No `docker` on this computer.
    Missing,
    /// Installed, but the engine is not running (Docker Desktop is not started).
    Stopped,
    Ready,
}

/// Whether Docker can run a container right now. `docker info` talks to the engine, so it fails
/// both when the program is missing and when the engine is down; a hung engine is cut off.
pub fn engine() -> Engine {
    let Ok(mut child) = docker()
        .args(["info", "--format", "{{.ServerVersion}}"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    else {
        return Engine::Missing;
    };
    let deadline = Instant::now() + Duration::from_secs(6);
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return if status.success() {
                    Engine::Ready
                } else {
                    Engine::Stopped
                }
            }
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(100)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Engine::Stopped;
            }
        }
    }
}

/// What the app can offer: where the daemon would run, or what is in the way.
#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct Availability {
    /// `native` (the bundled binary) or `docker`; none when neither can run.
    pub backend: Option<&'static str>,
    /// Why there is no backend: `docker_missing`, `docker_stopped` or `image_unpublished`.
    pub hint: Option<&'static str>,
}

pub fn decide(native: bool, engine: Engine, image_ok: bool) -> Availability {
    if native {
        return Availability {
            backend: Some("native"),
            hint: None,
        };
    }
    match (engine, image_ok) {
        (Engine::Ready, true) => Availability {
            backend: Some("docker"),
            hint: None,
        },
        (Engine::Ready, false) => Availability {
            backend: None,
            hint: Some("image_unpublished"),
        },
        (Engine::Stopped, _) => Availability {
            backend: None,
            hint: Some("docker_stopped"),
        },
        (Engine::Missing, _) => Availability {
            backend: None,
            hint: Some("docker_missing"),
        },
    }
}

pub fn container_name(account: &str) -> String {
    let prefix = if cfg!(kaleidoswap_beta) {
        "kaleido-beta-p2pd"
    } else {
        "kaleido-p2pd"
    };
    format!("{prefix}-{account}")
}

fn volume_name(account: &str) -> String {
    format!("{}-data", container_name(account))
}

/// Where the container sees the app's listing file.
pub const LISTING_IN_CONTAINER: &str = "/listing.json";
/// Where the container sees the media the user picked: the daemon's own upload folder.
pub const MEDIA_IN_CONTAINER: &str = "/data/media-upload";

/// Files on the host the container reads, each mounted read-only.
#[derive(Debug, Default, Clone)]
pub struct HostFiles {
    /// The app's listing for the network (`--verified-assets`).
    pub listing: Option<String>,
    /// The folder the app copies picked media into.
    pub media_dir: Option<String>,
}

fn bind(source: &str, target: &str, readonly: bool) -> [String; 2] {
    let ro = if readonly { ",readonly" } else { "" };
    [
        "--mount".into(),
        format!("type=bind,source={source},target={target}{ro}"),
    ]
}

/// `docker run` up to and including the image. The port is the same inside and out because the
/// daemon accepts only requests whose `Host` names the port it was started on. Secrets are passed by
/// name (`-e NAME`): the value comes from this process's environment, not from the arguments.
/// The listing file is mounted read-only. The media folder is the app's own folder for this
/// wallet, mounted writable because the daemon sets its permissions at start.
pub fn run_args(account: &str, image: &str, port: u16, files: &HostFiles) -> Vec<String> {
    let mut a: Vec<String> = [
        "run".to_string(),
        "--rm".into(),
        "-i".into(),
        "--name".into(),
        container_name(account),
        "-p".into(),
        format!("127.0.0.1:{port}:{port}"),
        "-v".into(),
        format!("{}:/data", volume_name(account)),
        "-e".into(),
        "P2PD_API_TOKEN".into(),
        "-e".into(),
        "P2PD_PASSPHRASE".into(),
    ]
    .to_vec();
    if let Some(f) = &files.listing {
        a.extend(bind(f, LISTING_IN_CONTAINER, true));
    }
    if let Some(d) = &files.media_dir {
        a.extend(bind(d, MEDIA_IN_CONTAINER, false));
    }
    a.push(image.into());
    a
}

/// The path the daemon in the container is given for a media file the app staged on the host.
pub fn media_path_in_container(host_path: &str) -> Option<String> {
    let name = std::path::Path::new(host_path).file_name()?.to_str()?;
    Some(format!("{MEDIA_IN_CONTAINER}/{name}"))
}

/// The daemon's own arguments inside the container. The listing file is read where it is mounted
/// ([`LISTING_IN_CONTAINER`]), and the key file is sealed with the passphrase from the environment.
pub fn daemon_args(cfg: &P2pStartConfig, port: u16) -> Vec<String> {
    let mut a: Vec<String> = vec![
        "--name".into(),
        cfg.account.clone(),
        "--port".into(),
        port.to_string(),
        "--bind".into(),
        "0.0.0.0".into(),
        "--data-dir".into(),
        "/data".into(),
        "--network".into(),
        cfg.network.clone(),
        "--indexer".into(),
        cfg.indexer_url.clone(),
        "--proxy".into(),
        cfg.proxy_url.clone(),
        "--fee-address".into(),
        cfg.fee_address.clone(),
        "--fee-bps".into(),
        cfg.fee_bps.to_string(),
        "--min-fee-sat".into(),
        cfg.min_fee_sat.to_string(),
        "--keystore".into(),
        "encrypted".into(),
    ];
    for relay in &cfg.relays {
        a.extend(["--relay".into(), relay.clone()]);
    }
    if cfg.verified_assets_path.is_some() {
        a.extend(["--verified-assets".into(), LISTING_IN_CONTAINER.into()]);
    }
    if let Some(npub) = &cfg.listing_curator {
        a.extend(["--listing-curator".into(), npub.clone()]);
    }
    if cfg.seed_mnemonic.is_some() {
        a.push("--seed-stdin".into());
    }
    if cfg.rescan {
        a.push("--rescan".into());
    }
    a
}

/// The passphrase that seals the key file in this account's volume: made once, kept in the OS
/// credential store. Lose it and the volume's key file cannot be opened; the recovery phrase
/// still restores the wallet.
pub fn passphrase(account: &str) -> Result<String, String> {
    let name = format!("p2pd-passphrase-{account}");
    if let Some(existing) = crate::secret_store::get(&name)? {
        return Ok(existing);
    }
    let fresh = crate::p2p::new_token();
    crate::secret_store::set(&name, &fresh)?;
    Ok(fresh)
}

/// Pull the image if it is not here yet. The first start downloads it, which takes a while.
pub fn ensure_image(image: &str) -> Result<(), String> {
    let have = docker()
        .args(["image", "inspect", image])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|s| s.success());
    if have {
        return Ok(());
    }
    log::info!("[p2p] pulling {image}");
    let out = docker()
        .args(["pull", "--quiet", image])
        .output()
        .map_err(|e| format!("could not run docker: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!(
            "could not pull the P2P daemon image: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ))
    }
}

/// A container of this name left over from an earlier run holds the name and the wallet's volume.
pub fn remove_container(account: &str) {
    let _ = docker()
        .args(["rm", "-f", &container_name(account)])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

/// Ask the container to leave: the daemon takes its offers off the market first.
pub fn stop_container(name: &str) {
    let _ = docker()
        .args(["stop", "-t", "8", name])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg() -> P2pStartConfig {
        P2pStartConfig {
            account: "wallet-signetcustom".into(),
            network: "signetcustom".into(),
            indexer_url: "https://e".into(),
            proxy_url: "https://p".into(),
            relays: vec!["wss://r1".into(), "wss://r2".into()],
            fee_address: "tb1q".into(),
            fee_bps: 100,
            min_fee_sat: 1_000,
            verified_assets_path: Some("/host/only.json".into()),
            listing_curator: Some("npub1curator".into()),
            seed_mnemonic: Some(crate::p2p::Secret::new("abandon ability able")),
            rescan: false,
        }
    }

    #[test]
    fn the_container_publishes_its_port_on_loopback_only_and_keeps_the_wallet_in_a_volume() {
        let a = run_args(
            "wallet-signetcustom",
            "kaleidoswap/p2pd:1@sha256:abc",
            51234,
            &HostFiles::default(),
        );
        assert!(a.contains(&"127.0.0.1:51234:51234".to_string()));
        assert!(a.contains(&format!("{}:/data", volume_name("wallet-signetcustom"))));
        assert_eq!(a.last().unwrap(), "kaleidoswap/p2pd:1@sha256:abc");
        assert!(a.contains(&"--rm".to_string()) && a.contains(&"-i".to_string()));
    }

    #[test]
    fn secrets_go_by_name_never_by_value() {
        let args = [
            run_args("a", "img", 1, &HostFiles::default()),
            daemon_args(&cfg(), 1),
        ]
        .concat()
        .join(" ");
        assert!(args.contains("-e P2PD_API_TOKEN") && args.contains("-e P2PD_PASSPHRASE"));
        assert!(
            !args.contains("abandon"),
            "the recovery phrase is not an argument"
        );
        assert!(
            !args.contains("P2PD_API_TOKEN="),
            "no value is given with the name"
        );
    }

    #[test]
    fn the_daemon_listens_on_all_addresses_inside_and_seals_its_keys_with_a_passphrase() {
        let a = daemon_args(&cfg(), 4242);
        let at = |flag: &str| a.iter().position(|x| x == flag).map(|i| a[i + 1].as_str());
        assert_eq!(at("--bind"), Some("0.0.0.0"));
        assert_eq!(at("--port"), Some("4242"));
        assert_eq!(at("--data-dir"), Some("/data"));
        assert_eq!(at("--keystore"), Some("encrypted"));
        assert_eq!(a.iter().filter(|x| *x == "--relay").count(), 2);
        assert_eq!(at("--listing-curator"), Some("npub1curator"));
        assert!(a.contains(&"--seed-stdin".to_string()));
        assert!(
            !a.iter().any(|x| x.contains("/host/only.json")),
            "a path on the host means nothing in the container"
        );
        assert_eq!(at("--verified-assets"), Some(LISTING_IN_CONTAINER));
    }

    #[test]
    fn the_listing_and_media_are_mounted_before_the_image() {
        let files = HostFiles {
            listing: Some(r"C:\Users\a\listed-signetcustom.json".into()),
            media_dir: Some(r"C:\Users\a\wallet\media-upload".into()),
        };
        let a = run_args("a", "img", 1, &files);
        let mounts: Vec<&String> = a
            .iter()
            .enumerate()
            .filter(|(i, _)| *i > 0 && a[i - 1] == "--mount")
            .map(|(_, m)| m)
            .collect();
        assert_eq!(mounts.len(), 2);
        assert!(mounts[0].ends_with("target=/listing.json,readonly"));
        assert!(mounts[1].ends_with("target=/data/media-upload"));
        assert_eq!(a.last().unwrap(), "img");
        assert_eq!(
            media_path_in_container(r"/x/media-upload/ab12.png").as_deref(),
            Some("/data/media-upload/ab12.png")
        );
    }

    #[test]
    fn an_unpublished_image_is_refused_with_a_reason() {
        assert!(pinned("kaleidoswap/p2pd:unpublished").is_err());
        assert!(pinned("").is_err());
        assert_eq!(
            pinned("kaleidoswap/p2pd:1@sha256:abc").unwrap(),
            "kaleidoswap/p2pd:1@sha256:abc"
        );
    }

    #[test]
    fn what_the_app_offers_follows_what_is_there() {
        let native = decide(true, Engine::Missing, false);
        assert_eq!(native.backend, Some("native"));
        assert_eq!(decide(false, Engine::Ready, true).backend, Some("docker"));
        assert_eq!(
            decide(false, Engine::Ready, false).hint,
            Some("image_unpublished")
        );
        assert_eq!(
            decide(false, Engine::Stopped, true).hint,
            Some("docker_stopped")
        );
        assert_eq!(
            decide(false, Engine::Missing, true).hint,
            Some("docker_missing")
        );
    }
}
