#!/usr/bin/env bash
set -e

###############################################################################
# KaleidoSwap Release GPG Signing Script
#
# Purpose:
#   - Downloads release artifacts from GitHub
#   - Signs each artifact with GPG using hardware security key (Yubikey)
#   - Creates .asc signature files
#   - Verifies signatures locally
#   - Uploads .asc files back to GitHub release
#
# Security:
#   - GPG private key never leaves hardware token
#   - No secrets stored in GitHub
#   - All signatures verified before upload
#
# Usage:
#   ./scripts/sign-release.sh v0.3.2
#   or
#   ./scripts/sign-release.sh  # Interactive mode
###############################################################################

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REPO="kaleidoswap/desktop-app"

# Functions
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Check prerequisites
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
    
    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI not authenticated. Run: gh auth login"
        exit 1
    fi
    
    if ! gpg --card-status &> /dev/null; then
        log_warning "Cannot access GPG card/Yubikey. Make sure it's connected."
        log_info "Continuing anyway - GPG will prompt when needed..."
    fi
    
    log_success "All prerequisites met!"
}

# Download release assets
download_assets() {
    local tag=$1
    local download_dir="./release-assets-$tag"
    
    log_info "Downloading assets for release: $tag" >&2
    mkdir -p "$download_dir"
    cd "$download_dir" || exit 1
    
    log_info "Downloading release artifacts..." >&2
    gh release download "$tag" --repo "$REPO" --pattern "*" --skip-existing >&2 2>&1 | grep -v "Downloading" || true
    
    log_success "Downloaded assets to: $download_dir" >&2
    ls -lh >&2
    
    cd - > /dev/null
    echo "$download_dir"
}

# Sign a file with GPG
sign_file() {
    local file=$1
    local sig_file="${file}.asc"
    
    if [ -f "$sig_file" ]; then
        log_warning "Signature already exists: $sig_file (skipping)"
        return 0
    fi
    
    log_info "Signing: $(basename "$file")"
    
    if gpg --detach-sign --armor --output "$sig_file" "$file"; then
        log_success "Created signature: $(basename "$sig_file")"
        return 0
    else
        log_error "Failed to sign: $file"
        return 1
    fi
}

# Sign all binary files
sign_all_files() {
    local download_dir=$1
    
    log_info "Signing release assets..."
    cd "$download_dir" || exit 1
    
    local signed=0
    
    # Sign binary files
    for file in *.{AppImage,dmg,exe,deb,msi,rpm}; do
        if [ -f "$file" ]; then
            if sign_file "$file"; then
                ((signed++))
            fi
        fi
    done
    
    # Sign updater packages
    for file in *.tar.gz *.zip; do
        if [ -f "$file" ] && [[ ! "$file" =~ \.app\. ]]; then
            if sign_file "$file"; then
                ((signed++))
            fi
        fi
    done
    
    cd - > /dev/null
    
    if [ $signed -eq 0 ]; then
        log_error "No files were signed!"
        exit 1
    fi
    
    log_success "Signed $signed file(s)"
}

# Verify signatures
verify_signatures() {
    local download_dir=$1
    
    log_info "Verifying GPG signatures..."
    cd "$download_dir" || exit 1
    
    local verified=0
    local failed=0
    
    for sig_file in *.asc; do
        if [ -f "$sig_file" ]; then
            original_file="${sig_file%.asc}"
            if [ -f "$original_file" ]; then
                log_info "Verifying: $original_file"
                if gpg --verify "$sig_file" "$original_file" 2>&1 | grep -q "Good signature"; then
                    log_success "Good signature: $original_file"
                    ((verified++))
                else
                    log_error "Bad signature: $original_file"
                    ((failed++))
                fi
            fi
        fi
    done
    
    cd - > /dev/null
    
    if [ $verified -gt 0 ]; then
        log_success "Verification complete: $verified good signatures"
    fi
    
    if [ $failed -gt 0 ]; then
        log_error "Failed verifications: $failed"
        exit 1
    fi
    
    if [ $verified -eq 0 ] && [ $failed -eq 0 ]; then
        log_warning "No GPG signatures (.asc) found to verify"
    fi
}

# Upload signatures to GitHub
upload_signatures() {
    local tag=$1
    local download_dir=$2
    
    log_info "Uploading GPG signatures to GitHub release: $tag"
    cd "$download_dir" || exit 1
    
    local uploaded=0
    for sig_file in *.asc; do
        if [ -f "$sig_file" ]; then
            log_info "Uploading: $sig_file"
            if gh release upload "$tag" "$sig_file" --repo "$REPO" --clobber 2>&1; then
                log_success "Uploaded: $sig_file"
                ((uploaded++))
            else
                log_error "Failed to upload: $sig_file"
            fi
        fi
    done
    
    cd - > /dev/null
    
    if [ $uploaded -eq 0 ]; then
        log_error "No signatures were uploaded!"
        exit 1
    fi
    
    log_success "Uploaded $uploaded GPG signature(s) to release $tag"
}

# Cleanup
cleanup() {
    local download_dir=$1
    
    echo
    read -p "$(echo -e "${YELLOW}?${NC} Delete downloaded files in $download_dir? [y/N] ")" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$download_dir"
        log_success "Cleaned up: $download_dir"
    else
        log_info "Files kept in: $download_dir"
    fi
}

# Main
main() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  KaleidoSwap Release Signing Script${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    check_prerequisites
    echo
    
    # Get release tag
    if [ -z "$1" ]; then
        log_info "Available releases:"
        gh release list --repo "$REPO" --limit 10
        echo
        read -p "$(echo -e "${YELLOW}?${NC} Enter release tag to sign (e.g., v0.3.1): ")" tag
    else
        tag=$1
    fi
    
    if [ -z "$tag" ]; then
        log_error "No release tag specified!"
        exit 1
    fi
    
    log_info "Processing release: $tag"
    echo
    
    # Download, sign, verify
    download_dir=$(download_assets "$tag")
    echo
    
    sign_all_files "$download_dir"
    echo
    
    verify_signatures "$download_dir"
    echo
    
    # Ask for confirmation before uploading
    read -p "$(echo -e "${YELLOW}?${NC} Upload signatures to GitHub release? [Y/n] ")" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        upload_signatures "$tag" "$download_dir"
        echo
        log_success "Release signing complete!"
        log_info "View release at: https://github.com/$REPO/releases/tag/$tag"
    else
        log_warning "Signatures not uploaded. Files are in: $download_dir"
    fi
    
    cleanup "$download_dir"
}

main "$@"

