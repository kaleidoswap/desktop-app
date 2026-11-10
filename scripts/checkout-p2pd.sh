#!/usr/bin/env bash
# Fetch the pinned private source without putting the token in a URL or git config on disk.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${P2PD_REPO:?set P2PD_REPO to github.com/owner/repository.git}"
: "${P2PD_REPO_TOKEN:?set a Contents-read token limited to the daemon repository}"
case "$P2PD_REPO" in github.com/*) ;; *) echo 'P2PD_REPO must start with github.com/' >&2; exit 1 ;; esac
EXPECTED="$(tr -d '[:space:]' < "$ROOT/p2pd.ref")"
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || { echo 'p2pd.ref must be an exact commit' >&2; exit 1; }
DEST="$ROOT/.p2pd-src"
[ ! -e "$DEST" ] || { echo '.p2pd-src already exists; use its source explicitly or remove the disposable checkout first' >&2; exit 1; }
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0=http.https://github.com/.extraheader
export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$P2PD_REPO_TOKEN" | base64 | tr -d '\n')"
git clone --quiet "https://$P2PD_REPO" "$DEST"
git -C "$DEST" checkout --quiet "$EXPECTED"
[ "$(git -C "$DEST" rev-parse HEAD)" = "$EXPECTED" ]
[ -f "$DEST/Cargo.lock" ] || { echo 'Pinned daemon has no Cargo.lock' >&2; exit 1; }
echo 'Pinned daemon source checked out.'
