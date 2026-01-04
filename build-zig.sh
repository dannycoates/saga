#!/bin/bash
set -e

ZIG_VERSION="0.15.2"
ZIG_DIR="zig-source"
ZIG_URL="https://codeberg.org/ziglang/zig/archive/${ZIG_VERSION}.tar.gz"

# Download and extract if not present
if [ ! -d "$ZIG_DIR" ]; then
    echo "Downloading Zig ${ZIG_VERSION} source..."
    curl -L "$ZIG_URL" | tar xz
    mv "zig" "$ZIG_DIR"

    echo "Applying patches..."
    cd "$ZIG_DIR"
    git apply ../zig-dev.patch
    cd ..

    echo "Zig source ready."
fi

# Build
echo "Building zig.wasm..."
zig build -Dwasm-opt --release=small --prefix public/zig

echo "Done! Output in public/zig/"
