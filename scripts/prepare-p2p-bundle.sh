#!/usr/bin/env bash
# Stage the P2P market daemon (p2pd) and its UI for a packaged build.
#
# Produces bin/p2pd (bin/p2pd.exe on Windows) and src-tauri/resources/p2p-ui/, which
# src-tauri/tauri.p2p.conf.json adds to the bundle:
#
#   scripts/prepare-p2p-bundle.sh
#   pnpm tauri build --config src-tauri/tauri.p2p.conf.json
#
# The daemon lives in its own repository. Point P2PD_SRC at a checkout of its `p2p/`
# directory, or set P2PD_REPO_URL and P2PD_REF (a tag or commit) to have it cloned into
# .p2pd-src. A normal dev build does not need any of this: the app finds p2pd through
# KALEIDO_P2PD_BIN or the PATH, and its UI through KALEIDO_P2P_UI_DIR.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${P2PD_SRC:-}"

if [ -z "$SRC" ]; then
  : "${P2PD_REPO_URL:?set P2PD_SRC to a checkout of p2p/, or P2PD_REPO_URL and P2PD_REF}"
  : "${P2PD_REF:?set P2PD_REF to the tag or commit to bundle}"
  CLONE="$ROOT/.p2pd-src"
  rm -rf "$CLONE"
  git clone --quiet "$P2PD_REPO_URL" "$CLONE"
  git -C "$CLONE" checkout --quiet "$P2PD_REF"
  SRC="$CLONE/p2p"
fi
[ -f "$SRC/Cargo.toml" ] || { echo "no p2p crate at $SRC" >&2; exit 1; }

EXE="p2pd"
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) EXE="p2pd.exe" ;; esac

echo "==> building the daemon"
# the crate is its own workspace, so its target directory is under $SRC
cargo build --release --features keychain --bin p2pd --manifest-path "$SRC/Cargo.toml"

echo "==> building its UI"
( cd "$SRC/ui" && npm ci --no-audit --no-fund && npm run build )

mkdir -p "$ROOT/bin"
rm -f "$ROOT"/bin/p2pd "$ROOT"/bin/p2pd.exe
cp "$SRC/target/release/$EXE" "$ROOT/bin/$EXE"
rm -rf "$ROOT/src-tauri/resources/p2p-ui"
mkdir -p "$ROOT/src-tauri/resources"
cp -R "$SRC/ui/dist" "$ROOT/src-tauri/resources/p2p-ui"

if [ "$(uname -s)" = "Darwin" ] && [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  echo "==> signing"
  codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$ROOT/bin/$EXE"
fi

echo "staged bin/$EXE and src-tauri/resources/p2p-ui"
