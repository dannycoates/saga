#!/bin/bash
set -euo pipefail
cd /build/rust

# Detect WASI SDK path
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    WASI_SDK_ARCHIVE="wasi-sdk-24.0-arm64-linux"
    HOST_TRIPLE="aarch64-unknown-linux-gnu"
else
    WASI_SDK_ARCHIVE="wasi-sdk-24.0-x86_64-linux"
    HOST_TRIPLE="x86_64-unknown-linux-gnu"
fi
export PATH="/build/rust/${WASI_SDK_ARCHIVE}/bin:${PATH}"

echo "=== Applying Miri source patches ==="
# NOTE: Bootstrap patches (compile.rs, dist.rs, tool.rs, copy_link, rustc_driver)
# are in pre-build.sh to avoid triggering a bootstrap rebuild.

# ============================================================
# Patch: miri os_str.rs — WASI OsStr support
# ============================================================
echo "Patch: miri os_str.rs"
OS_STR_RS="src/tools/miri/src/shims/os_str.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/tools/miri/src/shims/os_str.rs", "utf8");
// Add WASI import
c = c.replace(
    "#[cfg(unix)]\nuse std::os::unix::ffi::{OsStrExt, OsStringExt};",
    "#[cfg(unix)]\nuse std::os::unix::ffi::{OsStrExt, OsStringExt};\n#[cfg(target_os = \"wasi\")]\nuse std::os::wasi::ffi::{OsStrExt, OsStringExt};"
);
// Extend indented #[cfg(unix)] blocks to include wasi
c = c.replaceAll("#[cfg(unix)]\n        ", "#[cfg(any(unix, target_os = \"wasi\"))]\n        ");
c = c.replaceAll("#[cfg(unix)]\n    ", "#[cfg(any(unix, target_os = \"wasi\"))]\n    ");
fs.writeFileSync("src/tools/miri/src/shims/os_str.rs", c);
'
grep -q 'target_os = "wasi"' "$OS_STR_RS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# ============================================================
# Patch: miri lib.rs — add wasi_ext feature
# ============================================================
echo "Patch: miri lib.rs (wasi_ext)"
MIRI_LIB="src/tools/miri/src/lib.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/tools/miri/src/lib.rs", "utf8");
c = c.replace("#![feature(unqualified_local_imports)]", "#![feature(unqualified_local_imports)]\n#![feature(wasi_ext)]");
fs.writeFileSync("src/tools/miri/src/lib.rs", c);
'
grep -q 'feature(wasi_ext)' "$MIRI_LIB" && echo "  OK" || { echo "  FAIL"; exit 1; }

# ============================================================
# Patch: miri fs.rs — WASI create_link
# ============================================================
echo "Patch: miri fs.rs (create_link)"
MIRI_FS="src/tools/miri/src/shims/unix/fs.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/tools/miri/src/shims/unix/fs.rs", "utf8");
const anchor = "#[cfg(unix)]\n        fn create_link(src: &Path, dst: &Path) -> std::io::Result<()> {\n            std::os::unix::fs::symlink(src, dst)\n        }\n\n        #[cfg(windows)]";
if (!c.includes(anchor)) { console.error("create_link anchor NOT found"); process.exit(1); }
c = c.replace(anchor,
    "#[cfg(unix)]\n        fn create_link(src: &Path, dst: &Path) -> std::io::Result<()> {\n            std::os::unix::fs::symlink(src, dst)\n        }\n\n        #[cfg(target_os = \"wasi\")]\n        fn create_link(src: &Path, dst: &Path) -> std::io::Result<()> {\n            std::os::wasi::fs::symlink_path(src, dst)\n        }\n\n        #[cfg(windows)]"
);
fs.writeFileSync("src/tools/miri/src/shims/unix/fs.rs", c);
'
grep -q 'symlink_path' "$MIRI_FS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# ============================================================
# Patch: windows/foreign_items.rs — win_get_full_path_name for WASI
# ============================================================
echo "Patch: windows/foreign_items.rs (WASI)"
WIN_ITEMS="src/tools/miri/src/shims/windows/foreign_items.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/tools/miri/src/shims/windows/foreign_items.rs", "utf8");
c = c.replace(
    "#[cfg(unix)]\n#[expect(clippy::get_first, clippy::arithmetic_side_effects)]",
    "#[cfg(any(unix, target_os = \"wasi\"))]\n#[expect(clippy::get_first, clippy::arithmetic_side_effects)]"
);
fs.writeFileSync("src/tools/miri/src/shims/windows/foreign_items.rs", c);
'
grep -q 'any(unix, target_os = "wasi")' "$WIN_ITEMS" && echo "  OK" || echo "  WARN: pattern not found"

echo ""
echo "=== All Miri patches applied ==="
echo ""

# ============================================================
# Build Miri via bootstrap (same approach as working wasm17 build)
# ============================================================
# The bootstrap handles building all dependencies (rustc_* crates as rlibs
# for wasm32) and then builds miri targeting the wasm32-wasip1 host.
# With the rustc_driver "lib" crate type patch in pre-build.sh, the compiler
# crates compile as rlibs for wasm32 instead of failing on the dylib.

echo "=== Building Miri ==="
./x.py build miri 2>&1 | tee /build/build.log

echo ""
echo "=== Build complete — locating artifacts ==="
echo ""

# Find miri binary in build output
MIRI_WASM=$(find build/ -name 'miri.wasm' -path '*/release/*' 2>/dev/null | head -1)
if [ -z "$MIRI_WASM" ]; then
    MIRI_WASM=$(find build/ -name 'miri' -path '*/wasm32-wasip1/release/*' ! -name '*.d' ! -name '*.rlib' 2>/dev/null | head -1)
fi
echo "Miri binary: $MIRI_WASM"
ls -lh "$MIRI_WASM" 2>/dev/null || echo "  NOT FOUND"

# Find rlibs (stage1 stdlib with -Zalways-encode-mir for miri interpretation)
echo ""
echo "=== rlib files (for miri sysroot) ==="
RLIB_DIR="build/${HOST_TRIPLE}/stage1/lib/rustlib/${HOST_TRIPLE}/lib"
ls -lh "$RLIB_DIR"/*.rlib 2>/dev/null | head -30 || {
    echo "  Not in stage1, searching..."
    find build/ -path "*/rustlib/${HOST_TRIPLE}/lib/libstd-*.rlib" 2>/dev/null | head -5
}
