#!/bin/bash
set -e

echo "Building Rust Elevator WASM Module..."

# Build using standard cargo to create a core WASM module (not component)
echo "1. Building WebAssembly core module..."
cargo build --target wasm32-unknown-unknown --release

# Check if the build was successful
if [ ! -f "target/wasm32-unknown-unknown/release/rust_elevator_wasm.wasm" ]; then
    echo "Error: Build failed - WASM file not found"
    exit 1
fi

# Copy the module to a standard name
cp target/wasm32-unknown-unknown/release/rust_elevator_wasm.wasm elevator-controller.wasm
echo "✅ Core WASM module built successfully"

echo "✅ Build complete!"
echo "📁 Upload 'elevator-controller.wasm' to Elevator Saga"

# Show file info
echo ""
echo "File info:"
ls -lh elevator-controller.wasm