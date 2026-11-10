#!/usr/bin/env bash
# Stage the P2P market daemon (p2pd) for a packaged build.
#
# Produces bin/p2pd (bin/p2pd.exe on Windows), which src-tauri/tauri.p2p.conf.json adds to the
# bundle. The app draws the market itself and talks to the daemon through Rust, so the daemon's own
# web UI is not needed:
#
#   scripts/prepare-p2p-bundle.sh
#   pnpm tauri build --config src-tauri/tauri.p2p.conf.json
#
# The daemon lives in its own repository. Point P2PD_SRC at a checkout of its source
# directory, or set P2PD_REPO_URL and P2PD_REF (a tag or commit) to have it cloned into
# .p2pd-src. A normal dev build does not need any of this: the app finds p2pd through
# KALEIDO_P2PD_BIN or the PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${P2PD_SRC:-}"

if [ -z "$SRC" ]; then
  : "${P2PD_REPO_URL:?set P2PD_SRC to a checkout of its source, or P2PD_REPO_URL and P2PD_REF}"
  : "${P2PD_REF:?set P2PD_REF to the tag or commit to bundle}"
  CLONE="$ROOT/.p2pd-src"
  rm -rf "$CLONE"
  git clone --quiet "$P2PD_REPO_URL" "$CLONE"
  git -C "$CLONE" checkout --quiet "$P2PD_REF"
  SRC="$CLONE"
fi
[ -f "$SRC/Cargo.toml" ] || { echo "no daemon crate at $SRC" >&2; exit 1; }
[ -f "$SRC/Cargo.lock" ] || { echo "missing daemon Cargo.lock; a beta bundle needs locked dependencies" >&2; exit 1; }
EXPECTED_REF="$(tr -d '[:space:]' < "$ROOT/p2pd.ref")"
ACTUAL_REF="$(git -C "$SRC" rev-parse HEAD)"
[ "$ACTUAL_REF" = "$EXPECTED_REF" ] || { echo "daemon source does not match p2pd.ref ($EXPECTED_REF)" >&2; exit 1; }
[ -z "$(git -C "$SRC" status --porcelain --untracked-files=no)" ] || { echo "daemon source has uncommitted changes" >&2; exit 1; }

EXE="p2pd"
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) EXE="p2pd.exe" ;; esac

echo "==> building the daemon"
# the crate is its own workspace, so its target directory is under $SRC
cargo build --locked --release --features keychain --bin p2pd --manifest-path "$SRC/Cargo.toml"
TARGET_DIR="$(cargo metadata --locked --no-deps --format-version 1 --manifest-path "$SRC/Cargo.toml" | python3 -c 'import json,sys; print(json.load(sys.stdin)["target_directory"])')"

mkdir -p "$ROOT/bin"
rm -f "$ROOT"/bin/p2pd "$ROOT"/bin/p2pd.exe
cp "$TARGET_DIR/release/$EXE" "$ROOT/bin/$EXE"

if [ "$(uname -s)" = "Darwin" ] && [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  echo "==> signing"
  codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$ROOT/bin/$EXE"
fi

echo "staged bin/$EXE"
