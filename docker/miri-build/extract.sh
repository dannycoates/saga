#!/bin/bash
set -euo pipefail

# Extract miri.wasm and rlib files from the Docker build container
# Usage: ./extract.sh [destination_dir]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SAGA_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEST_DIR="${1:-$SAGA_ROOT/public/rust}"

echo "Creating container from saga-miri-build image..."
CONTAINER_ID=$(docker create saga-miri-build)

echo "Extracting miri.wasm..."
docker cp "$CONTAINER_ID:/build/rust/dist/bin/miri.wasm" "$DEST_DIR/miri.wasm"

echo "Extracting rlib files..."
rm -rf "$DEST_DIR/lib/"*.rlib 2>/dev/null || true
docker cp "$CONTAINER_ID:/build/rust/dist/lib/rustlib/x86_64-unknown-linux-gnu/lib/." "$DEST_DIR/lib/"

echo "Cleaning up container..."
docker rm "$CONTAINER_ID" > /dev/null

echo ""
echo "=== Extracted artifacts ==="
echo "miri.wasm: $(ls -lh "$DEST_DIR/miri.wasm" | awk '{print $5}')"
echo ""
echo "rlib files:"
ls "$DEST_DIR/lib/"*.rlib | xargs -I{} basename {} | sort
echo ""
echo "Total rlib size: $(du -sh "$DEST_DIR/lib/" | awk '{print $1}')"
echo ""

# Optimize with wasm-opt if available
if command -v wasm-opt &> /dev/null; then
    echo "Optimizing miri.wasm with wasm-opt..."
    BEFORE=$(ls -lh "$DEST_DIR/miri.wasm" | awk '{print $5}')
    wasm-opt -Oz --strip-debug -o "$DEST_DIR/miri.opt.wasm" "$DEST_DIR/miri.wasm"
    mv "$DEST_DIR/miri.opt.wasm" "$DEST_DIR/miri.wasm"
    AFTER=$(ls -lh "$DEST_DIR/miri.wasm" | awk '{print $5}')
    echo "Size: $BEFORE -> $AFTER"
else
    echo "wasm-opt not found. Install with: brew install binaryen"
    echo "Then run: wasm-opt -Oz --strip-debug -o miri.opt.wasm miri.wasm"
fi

echo ""
echo "=== Next steps ==="
echo "1. Update RLIB_FILES in src/runtimes/rust/RustRuntime.js with the new filenames above"
echo "2. Run 'npm run test:run' to check for regressions"
echo "3. Start dev server and test Rust runtime in browser"
