#!/usr/bin/env bash
###############################################################################
# KaleidoSwap Release Signing Script
#
# Purpose:
#   - Downloads every asset of a GitHub release
#   - Computes SHA256SUMS over the assets exactly as GitHub serves them
#   - Signs SHA256SUMS with the release GPG key (hardware token)
#   - Verifies the signature and the checksums locally
#   - Uploads SHA256SUMS and SHA256SUMS.asc to the release
#
# Security:
#   - GPG private key never leaves the hardware token
#   - No signing secrets stored in GitHub
#   - Aborts if a SHA256SUMS already on the release disagrees with the assets
#
# Usage:
#   ./scripts/sign-release.sh v0.6.0
#   ./scripts/sign-release.sh                  # Interactive mode
#   GPG_SIGNING_KEY=<fingerprint> ./scripts/sign-release.sh v0.6.0
###############################################################################
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO="kaleidoswap/desktop-app"
# Release signing key, as published on https://kaleidoswap.com/downloads#verify
SIGNING_KEY="${GPG_SIGNING_KEY:-D22687EA589C508EE1FB27259EE396C0452755F0}"
SIGNING_KEY="$(echo "$SIGNING_KEY" | tr -d ' ' | tr '[:lower:]' '[:upper:]')"

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

sha256() {
    if command -v sha256sum &> /dev/null; then
        sha256sum "$@"
    else
        shasum -a 256 "$@"
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) not installed. Get it from: https://cli.github.com/"
        exit 1
    fi

    if ! command -v gpg &> /dev/null; then
        log_error "GPG is not installed."
        exit 1
    fi

    if ! command -v sha256sum &> /dev/null && ! command -v shasum &> /dev/null; then
        log_error "Neither sha256sum nor shasum is available."
        exit 1
    fi

    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI not authenticated. Run: gh auth login"
        exit 1
    fi

    if ! gpg --list-secret-keys "$SIGNING_KEY" &> /dev/null; then
        log_error "Secret key $SIGNING_KEY not available. Connect the hardware token (gpg --card-status)."
        exit 1
    fi

    log_success "All prerequisites met!"
}

download_assets() {
    local tag=$1
    local assets_dir=$2

    log_info "Downloading all assets of release $tag..."
    gh release download "$tag" --repo "$REPO" --dir "$assets_dir"
    log_success "Downloaded $(ls "$assets_dir" | wc -l | tr -d ' ') file(s)"
}

# Writes SHA256SUMS for every asset except SHA256SUMS itself and its signature
compute_checksums() {
    local assets_dir=$1
    local out=$2

    log_info "Computing SHA256SUMS..."
    (
        cd "$assets_dir"
        for file in *; do
            case "$file" in
                SHA256SUMS|SHA256SUMS.asc) continue ;;
            esac
            sha256 "$file"
        done
    ) | LC_ALL=C sort -k 2 > "$out"

    if [ ! -s "$out" ]; then
        log_error "No assets found to checksum!"
        exit 1
    fi

    cat "$out"
    log_success "Checksummed $(wc -l < "$out" | tr -d ' ') file(s)"
}

compare_with_published() {
    local assets_dir=$1
    local computed=$2

    if [ ! -f "$assets_dir/SHA256SUMS" ]; then
        log_info "No SHA256SUMS on the release yet; the computed one will be uploaded."
        return 0
    fi

    if ! diff -u "$assets_dir/SHA256SUMS" "$computed"; then
        log_error "SHA256SUMS on the release does not match the downloaded assets."
        log_error "Investigate before signing. If the published file is stale, delete it from the release and rerun."
        exit 1
    fi
    log_success "Published SHA256SUMS matches the downloaded assets"
}

sign_checksums() {
    local work_dir=$1

    log_info "Signing SHA256SUMS with $SIGNING_KEY (touch the hardware token if it blinks)..."
    gpg --local-user "$SIGNING_KEY" --armor --detach-sign \
        --output "$work_dir/SHA256SUMS.asc" "$work_dir/SHA256SUMS"
    log_success "Created SHA256SUMS.asc"
}

verify_signature() {
    local work_dir=$1
    local assets_dir=$2
    local status primary

    log_info "Verifying signature..."
    status=$(gpg --status-fd 1 --verify "$work_dir/SHA256SUMS.asc" "$work_dir/SHA256SUMS" 2> /dev/null || true)
    # VALIDSIG <sig-key-fpr> ... <primary-key-fpr>
    primary=$(echo "$status" | awk '$2 == "VALIDSIG" { print $NF }')
    if [ -z "$primary" ] || [[ "$primary" != *"$SIGNING_KEY" ]]; then
        log_error "Signature does not verify against $SIGNING_KEY"
        exit 1
    fi
    log_success "Good signature from $primary"

    log_info "Checking assets against the signed SHA256SUMS..."
    (cd "$assets_dir" && sha256 -c --quiet "$work_dir/SHA256SUMS")
    log_success "All checksums match"
}

upload_checksums() {
    local tag=$1
    local work_dir=$2

    log_info "Uploading SHA256SUMS and SHA256SUMS.asc to $tag..."
    gh release upload "$tag" "$work_dir/SHA256SUMS" "$work_dir/SHA256SUMS.asc" \
        --repo "$REPO" --clobber
    log_success "Uploaded SHA256SUMS and SHA256SUMS.asc"
}

main() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  KaleidoSwap Release Signing Script${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    check_prerequisites
    echo

    local tag="${1:-}"
    if [ -z "$tag" ]; then
        log_info "Available releases:"
        gh release list --repo "$REPO" --limit 10
        echo
        read -r -p "$(echo -e "${YELLOW}?${NC} Enter release tag to sign (e.g., v0.6.0): ")" tag
    fi

    if [ -z "$tag" ]; then
        log_error "No release tag specified!"
        exit 1
    fi

    local work_dir
    work_dir=$(mktemp -d "${TMPDIR:-/tmp}/kaleidoswap-sign-$tag.XXXXXX")
    trap 'rm -rf "$work_dir"' EXIT
    mkdir "$work_dir/assets"

    log_info "Processing release: $tag"
    echo

    download_assets "$tag" "$work_dir/assets"
    echo
    compute_checksums "$work_dir/assets" "$work_dir/SHA256SUMS"
    echo
    compare_with_published "$work_dir/assets" "$work_dir/SHA256SUMS"
    echo
    sign_checksums "$work_dir"
    echo
    verify_signature "$work_dir" "$work_dir/assets"
    echo

    read -r -p "$(echo -e "${YELLOW}?${NC} Upload SHA256SUMS and SHA256SUMS.asc to $tag? [Y/n] ")" reply
    if [[ "$reply" =~ ^[Nn]$ ]]; then
        log_warning "Nothing uploaded."
        exit 0
    fi

    upload_checksums "$tag" "$work_dir"
    echo
    log_success "Release signing complete!"
    log_info "View release at: https://github.com/$REPO/releases/tag/$tag"
}

main "$@"
