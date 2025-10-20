#!/bin/bash

# Build rgb-lightning-node binaries for different architectures
# Run this locally to create the binaries, then commit them

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RGB_DIR="$PROJECT_DIR/rgb-lightning-node"
BIN_DIR="$PROJECT_DIR/bin"

echo "======================================"
echo "Building rgb-lightning-node binaries"
echo "======================================"
echo ""

# Clone or update rgb-lightning-node
if [ ! -d "$RGB_DIR" ]; then
    echo "Cloning rgb-lightning-node repository..."
    git clone https://github.com/kaleidoswap/rgb-lightning-node "$RGB_DIR" --recurse-submodules
else
    echo "Updating rgb-lightning-node repository..."
    cd "$RGB_DIR"
    git pull
    git submodule update --init --recursive
fi

cd "$RGB_DIR"

# Detect current OS
OS="$(uname -s)"
ARCH="$(uname -m)"

echo ""
echo "Current system: $OS $ARCH"
echo ""

# Create bin directory
mkdir -p "$BIN_DIR"

case "$OS" in
    Darwin)
        echo "Building for macOS..."
        echo ""
        
        # Check if we're on Apple Silicon
        if [ "$ARCH" = "arm64" ]; then
            echo "✓ Building native Apple Silicon (aarch64) binary..."
            rustup target add aarch64-apple-darwin
            cargo build --release --target aarch64-apple-darwin
            cp target/aarch64-apple-darwin/release/rgb-lightning-node "$BIN_DIR/rgb-lightning-node-aarch64"
            echo "✓ Created: bin/rgb-lightning-node-aarch64"
            file "$BIN_DIR/rgb-lightning-node-aarch64"
            echo ""
            
            echo "✓ Building Intel (x86_64) binary (cross-compile)..."
            rustup target add x86_64-apple-darwin
            cargo build --release --target x86_64-apple-darwin
            cp target/x86_64-apple-darwin/release/rgb-lightning-node "$BIN_DIR/rgb-lightning-node-x86_64"
            echo "✓ Created: bin/rgb-lightning-node-x86_64"
            file "$BIN_DIR/rgb-lightning-node-x86_64"
            echo ""
            
        else
            echo "✓ Building Intel (x86_64) binary..."
            rustup target add x86_64-apple-darwin
            cargo build --release --target x86_64-apple-darwin
            cp target/x86_64-apple-darwin/release/rgb-lightning-node "$BIN_DIR/rgb-lightning-node-x86_64"
            echo "✓ Created: bin/rgb-lightning-node-x86_64"
            file "$BIN_DIR/rgb-lightning-node-x86_64"
            echo ""
            
            echo "⚠ To build Apple Silicon binary, you need an ARM64 Mac or use cross-compilation"
            echo "  For now, Intel binary will be used for both architectures (ARM Macs will use Rosetta 2)"
        fi
        ;;
        
    Linux)
        echo "✓ Building for Linux (x86_64)..."
        cargo build --release
        cp target/release/rgb-lightning-node "$BIN_DIR/rgb-lightning-node-linux"
        echo "✓ Created: bin/rgb-lightning-node-linux"
        file "$BIN_DIR/rgb-lightning-node-linux"
        echo ""
        ;;
        
    *)
        echo "❌ Unsupported OS: $OS"
        exit 1
        ;;
esac

echo ""
echo "======================================"
echo "✓ Build complete!"
echo "======================================"
echo ""
echo "Binaries created in: $BIN_DIR"
ls -lh "$BIN_DIR"/rgb-lightning-node*
echo ""
echo "Next steps:"
echo "1. Test the binaries work correctly"
echo "2. Commit them to git:"
echo "   git add bin/rgb-lightning-node-*"
echo "   git commit -m 'Add pre-built rgb-lightning-node binaries'"
echo "3. Push to trigger CI/CD build"
echo ""

