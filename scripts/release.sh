#!/bin/bash

# Release script for KaleidoSwap Desktop App
# Usage: ./scripts/release.sh [version] [--test]
# Example: ./scripts/release.sh 0.1.3
# Example: ./scripts/release.sh 0.1.3 --test (creates test-v0.1.3)

set -e

VERSION=$1
TEST_FLAG=$2

if [ -z "$VERSION" ]; then
    echo "Error: Version is required"
    echo "Usage: ./scripts/release.sh [version] [--test]"
    echo "Example: ./scripts/release.sh 0.1.3"
    exit 1
fi

# Validate version format (x.y.z)
# if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
#     echo "Error: Version must be in format x.y.z (e.g., 0.1.3)"
#     exit 1
# fi

# Determine tag prefix
if [ "$TEST_FLAG" = "--test" ]; then
    TAG_PREFIX="test-v"
    echo "Creating test release: $TAG_PREFIX$VERSION"
else
    TAG_PREFIX="v"
    echo "Creating production release: $TAG_PREFIX$VERSION"
fi

# Check if we're on the correct branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "dev" ]; then
    echo "Warning: You're not on the 'dev' branch. Current branch: $CURRENT_BRANCH"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "Error: You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

echo "Updating version to $VERSION..."

# Update version in tauri.conf.json
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json

# Update version in Cargo.toml
sed -i.bak "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# Remove backup files
rm -f src-tauri/tauri.conf.json.bak src-tauri/Cargo.toml.bak

# Update Cargo.lock
(cd src-tauri && cargo check)

echo "Version updated to $VERSION"

# Commit the version changes
git add src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "Release $TAG_PREFIX$VERSION"

# Create and push the tag
git tag "$TAG_PREFIX$VERSION"
git push origin "$TAG_PREFIX$VERSION"

echo "✅ Release tag $TAG_PREFIX$VERSION created and pushed!"
echo "🚀 GitHub Actions will now build and create the release."
echo "📦 Check progress at: https://github.com/kaleidoswap/desktop-app/actions"

if [ "$TEST_FLAG" != "--test" ]; then
    echo "🔄 The updater will automatically detect this release."
    echo "📱 Apps running version < $VERSION will show update notification."
fi 