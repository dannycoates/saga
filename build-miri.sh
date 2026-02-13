#!/bin/bash
set -euo pipefail

# Build miri.wasm from Rust 1.93.0 stable and deploy to public/rust/
#
# Requirements: docker, wasm-opt (from binaryen)
#
# Usage: ./build-miri.sh [--no-cache]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="$SCRIPT_DIR/docker/miri-build-latest"
IMAGE_NAME="saga-miri-latest"
CONTAINER_NAME="miri-extract-$$"
PUBLIC_RUST="$SCRIPT_DIR/public/rust"

DOCKER_FLAGS="--progress=plain"
if [[ "${1:-}" == "--no-cache" ]]; then
    DOCKER_FLAGS="$DOCKER_FLAGS --no-cache"
fi

echo "=== Building miri.wasm Docker image ==="
docker build $DOCKER_FLAGS -t "$IMAGE_NAME" -f "$DOCKER_DIR/Dockerfile" "$DOCKER_DIR/" 2>&1 | tee /tmp/miri-latest-build.log

echo ""
echo "=== Extracting artifacts ==="
docker create --name "$CONTAINER_NAME" "$IMAGE_NAME"

cleanup() {
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
}
trap cleanup EXIT

# Detect host triple used in the build
HOST_TRIPLE=$(docker run --rm "$IMAGE_NAME" sh -c 'ls /build/rust/build/ | grep -E "unknown-linux-gnu$" | head -1')
echo "Build host triple: $HOST_TRIPLE"

# Extract miri.wasm
MIRI_SRC="/build/rust/build/$HOST_TRIPLE/stage1-tools-bin/miri.wasm"
docker cp "$CONTAINER_NAME:$MIRI_SRC" /tmp/miri-raw.wasm
echo "Raw miri.wasm: $(ls -lh /tmp/miri-raw.wasm | awk '{print $5}')"

# Extract rlibs (stage1 stdlib with -Zalways-encode-mir)
RLIB_SRC="/build/rust/build/$HOST_TRIPLE/stage1/lib/rustlib/$HOST_TRIPLE/lib/"
rm -rf /tmp/miri-rlibs-new
docker cp "$CONTAINER_NAME:$RLIB_SRC" /tmp/miri-rlibs-new/
RLIB_COUNT=$(ls /tmp/miri-rlibs-new/*.rlib 2>/dev/null | wc -l | tr -d ' ')
echo "Extracted $RLIB_COUNT rlibs"

echo ""
echo "=== Optimizing with wasm-opt ==="
if command -v wasm-opt &>/dev/null; then
    wasm-opt -Oz /tmp/miri-raw.wasm -o /tmp/miri-opt.wasm
    echo "Optimized: $(ls -lh /tmp/miri-raw.wasm | awk '{print $5}') → $(ls -lh /tmp/miri-opt.wasm | awk '{print $5}')"
    MIRI_WASM=/tmp/miri-opt.wasm
else
    echo "WARNING: wasm-opt not found, using unoptimized binary"
    echo "Install binaryen for smaller output: brew install binaryen"
    MIRI_WASM=/tmp/miri-raw.wasm
fi

echo ""
echo "=== Deploying to $PUBLIC_RUST ==="

# Deploy miri.wasm
cp "$MIRI_WASM" "$PUBLIC_RUST/miri.wasm"
echo "miri.wasm: $(ls -lh "$PUBLIC_RUST/miri.wasm" | awk '{print $5}')"

# Deploy rlibs — remove old, copy new
rm -f "$PUBLIC_RUST/lib/"*.rlib "$PUBLIC_RUST/lib/"*.so
cp /tmp/miri-rlibs-new/*.rlib "$PUBLIC_RUST/lib/"
echo "rlibs: $RLIB_COUNT files deployed"

# Generate RLIB_FILES array for RustRuntime.js
echo ""
echo "=== Updating RustRuntime.js ==="
RUNTIME_JS="$SCRIPT_DIR/src/runtimes/rust/RustRuntime.js"

RLIB_LIST=$(ls /tmp/miri-rlibs-new/*.rlib | xargs -I{} basename {} | sort | sed 's/^/  "/;s/$/",/')
# Build the replacement block
NEW_BLOCK="const RLIB_FILES = [\n$RLIB_LIST\n];"

node -e "
const fs = require('fs');
let c = fs.readFileSync('$RUNTIME_JS', 'utf8');
c = c.replace(/const RLIB_FILES = \[[\s\S]*?\];/, \`const RLIB_FILES = [
$(ls /tmp/miri-rlibs-new/*.rlib | xargs -I{} basename {} | sort | sed 's/^/  "/;s/$/",/')
];\`);
fs.writeFileSync('$RUNTIME_JS', c);
"
echo "RLIB_FILES updated with $RLIB_COUNT entries"

# Update target triple and sysroot directory in rust-worker.js
WORKER_JS="$SCRIPT_DIR/src/runtimes/rust/rust-worker.js"
if grep -q 'x86_64-unknown-linux-gnu' "$WORKER_JS"; then
    sed -i.bak "s/x86_64-unknown-linux-gnu/$HOST_TRIPLE/g" "$WORKER_JS"
    rm -f "$WORKER_JS.bak"
    echo "rust-worker.js: updated target triple to $HOST_TRIPLE"
fi

echo ""
echo "=== Done ==="
echo "miri.wasm: $(ls -lh "$PUBLIC_RUST/miri.wasm" | awk '{print $5}')"
echo "rlibs:     $RLIB_COUNT files in $PUBLIC_RUST/lib/"
echo ""
echo "Start the dev server and test with Rust in the game."
