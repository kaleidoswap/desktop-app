//! Media for issuing an RGB asset (a collectible's image, a unique item's file).
//!
//! The daemon embeds the file it is given in a contract that anyone can then read, so it must never
//! be handed an arbitrary path: the page could name the keystore. Here the user picks the file in
//! the native dialog (the page never supplies a path), it is checked to be an image by its content,
//! and copied into `<data dir>/media-upload/`, the only place the daemon reads media from.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};

/// The largest media file accepted, as the daemon does.
pub const MAX_MEDIA_BYTES: u64 = 10 * 1024 * 1024;

/// The folder under the daemon's data dir it takes media from.
pub const UPLOAD_DIR: &str = "media-upload";

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct StagedMedia {
    /// Where the copy is, for the daemon.
    pub path: String,
    /// The original file name, for the page to show.
    pub name: String,
}

/// The image type of `bytes` by its signature, if it is one this accepts.
pub fn image_kind(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("png")
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("jpg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("gif")
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("webp")
    } else {
        None
    }
}

/// Copy the picked file into `data_dir/media-upload/`, named by its content hash. Refuses anything
/// that is not a regular image file of at most [`MAX_MEDIA_BYTES`].
pub fn stage(source: &Path, data_dir: &Path) -> Result<StagedMedia, String> {
    let meta = fs::metadata(source).map_err(|e| format!("{}: {e}", source.display()))?;
    if !meta.is_file() {
        return Err("choose a file".into());
    }
    if meta.len() > MAX_MEDIA_BYTES {
        return Err("the file is larger than 10 MB".into());
    }
    let mut bytes = Vec::with_capacity(meta.len() as usize);
    fs::File::open(source)
        .and_then(|f| f.take(MAX_MEDIA_BYTES + 1).read_to_end(&mut bytes))
        .map_err(|e| format!("{}: {e}", source.display()))?;
    if bytes.len() as u64 > MAX_MEDIA_BYTES {
        return Err("the file is larger than 10 MB".into());
    }
    let kind = image_kind(&bytes).ok_or("choose a PNG, JPEG, GIF or WebP image")?;
    let dir = data_dir.join(UPLOAD_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&dir, fs::Permissions::from_mode(0o700));
    }
    let digest = hex::encode(Sha256::digest(&bytes));
    let dest: PathBuf = dir.join(format!("{}.{kind}", &digest[..32]));
    fs::write(&dest, &bytes).map_err(|e| format!("{}: {e}", dest.display()))?;
    Ok(StagedMedia {
        name: source
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        path: dest.to_string_lossy().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR";

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("p2p-media-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn an_image_is_copied_into_the_upload_folder_by_its_hash() {
        let d = tmp("ok");
        let src = d.join("cat.png");
        fs::write(&src, PNG).unwrap();
        let data = d.join("wallet");
        let staged = stage(&src, &data).unwrap();
        assert_eq!(staged.name, "cat.png");
        let p = PathBuf::from(&staged.path);
        assert!(p.starts_with(data.join(UPLOAD_DIR)));
        assert!(staged.path.ends_with(".png"));
        assert_eq!(fs::read(p).unwrap(), PNG);
    }

    #[test]
    fn anything_but_a_small_image_is_refused() {
        let d = tmp("bad");
        let data = d.join("wallet");
        let text = d.join("keystore.json");
        fs::write(&text, b"{\"mnemonic\":\"secret\"}").unwrap();
        assert!(stage(&text, &data).is_err());
        let renamed = d.join("secret.png");
        fs::write(&renamed, b"not an image").unwrap();
        assert!(stage(&renamed, &data).is_err());
        assert!(stage(&d, &data).is_err());
        let big = d.join("big.png");
        let mut bytes = PNG.to_vec();
        bytes.resize(MAX_MEDIA_BYTES as usize + 1, 0);
        fs::write(&big, bytes).unwrap();
        assert!(stage(&big, &data).is_err());
        assert!(
            !data.join(UPLOAD_DIR).exists()
                || fs::read_dir(data.join(UPLOAD_DIR))
                    .unwrap()
                    .next()
                    .is_none()
        );
    }

    #[test]
    fn image_kinds_are_told_by_their_signature() {
        assert_eq!(image_kind(PNG), Some("png"));
        assert_eq!(image_kind(&[0xff, 0xd8, 0xff, 0xe0]), Some("jpg"));
        assert_eq!(image_kind(b"GIF89a...."), Some("gif"));
        assert_eq!(image_kind(b"RIFF\x00\x00\x00\x00WEBPVP8 "), Some("webp"));
        assert_eq!(image_kind(b"<svg"), None);
        assert_eq!(image_kind(b""), None);
    }
}
