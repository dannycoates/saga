#!/bin/bash
set -euo pipefail

# Pre-build: config.toml, WASI SDK, and LLVM build
# This runs as a separate Docker layer so LLVM build is cached
# across iterations on the Miri patches.

cd /build/rust

echo "=== Pre-build: config + WASI SDK + LLVM ==="

# Patch config.toml for Miri build
sed -i 's/^extended = false$/extended = true/' config.toml
sed -i 's/^tools = \[\]$/tools = ["miri"]/' config.toml
sed -i 's/^download-ci-llvm = true$/download-ci-llvm = false/' config.toml

# Detect architecture and download appropriate WASI SDK
ARCH=$(uname -m)
echo "Build host architecture: $ARCH"

if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    WASI_SDK_ARCHIVE="wasi-sdk-24.0-arm64-linux"
else
    WASI_SDK_ARCHIVE="wasi-sdk-24.0-x86_64-linux"
fi

if [ ! -d "$WASI_SDK_ARCHIVE" ]; then
    echo "Downloading WASI SDK 24 ($WASI_SDK_ARCHIVE)..."
    curl -LO "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-24/${WASI_SDK_ARCHIVE}.tar.gz"
    tar xzf "${WASI_SDK_ARCHIVE}.tar.gz"
    rm "${WASI_SDK_ARCHIVE}.tar.gz"
fi

# Patch config.toml WASI SDK paths
sed -i "s|wasi-sdk-24.0-x86_64-linux|${WASI_SDK_ARCHIVE}|g" config.toml

# On arm64, use cross-compiler for x86_64 target
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    sed -i 's|cc = "gcc"|cc = "x86_64-linux-gnu-gcc"\ncxx = "x86_64-linux-gnu-g++"|' config.toml
fi

# Add WASI SDK bin to PATH for llvm-ar etc.
export PATH="/build/rust/${WASI_SDK_ARCHIVE}/bin:${PATH}"

echo "=== Building LLVM (this takes ~30 min) ==="
# Build just LLVM + bootstrap - this is the expensive cached layer
./x.py build library 2>&1 | tail -5

echo "=== Pre-build complete ==="
