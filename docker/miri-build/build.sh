#!/bin/bash
set -euo pipefail

# Miri-specific patches and build.
# Config, WASI SDK, and LLVM are already built by pre-build.sh (cached Docker layer).

cd /build/rust

# Detect WASI SDK path for PATH
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    WASI_SDK_ARCHIVE="wasi-sdk-24.0-arm64-linux"
else
    WASI_SDK_ARCHIVE="wasi-sdk-24.0-x86_64-linux"
fi
export PATH="/build/rust/${WASI_SDK_ARCHIVE}/bin:${PATH}"

echo "=== Applying Miri WASI patches ==="

# ============================================================
# Patch 02: bootstrap/compile.rs — add -Zalways-encode-mir + preserve rlibs
# ============================================================
echo "Patch 02: bootstrap/compile.rs"
COMPILE_RS="src/bootstrap/src/core/build_steps/compile.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/core/build_steps/compile.rs", "utf8");
const anchor = "    // By default, rustc uses `-Cembed-bitcode=yes`";
if (!c.includes(anchor)) { console.error("02a anchor NOT found"); process.exit(1); }
c = c.replace(anchor,
    "    // Ensure MIR is encoded in rlibs for Miri interpretation\n" +
    "    if stage >= 1 {\n" +
    "        cargo.rustflag(\"-Zalways-encode-mir\");\n" +
    "    }\n\n" + anchor);
const anchor2 = "true, // Only ship rustc_driver.so and .rmeta files, not all intermediate .rlib files.";
if (!c.includes(anchor2)) { console.error("02b anchor NOT found"); process.exit(1); }
c = c.replace(anchor2, "!target.contains(\"wasi\"), // Ship .rlib files for WASI targets");
fs.writeFileSync("src/bootstrap/src/core/build_steps/compile.rs", c);
'
grep -q 'Zalways-encode-mir' "$COMPILE_RS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# ============================================================
# Patch 03: bootstrap/dist.rs — disable CargoMiri build
# ============================================================
echo "Patch 03: bootstrap/dist.rs"
DIST_RS="src/bootstrap/src/core/build_steps/dist.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/core/build_steps/dist.rs", "utf8");
const a1 = "let cargomiri =\n            builder.ensure(tool::CargoMiri { compiler, target, extra_features: Vec::new() });";
if (!c.includes(a1)) { console.error("03 CargoMiri anchor NOT found"); process.exit(1); }
c = c.replace(a1, "// let cargomiri =\n            //     builder.ensure(tool::CargoMiri { compiler, target, extra_features: Vec::new() });");
c = c.replace("tarball.add_file(cargomiri, \"bin\", 0o755);", "// tarball.add_file(cargomiri, \"bin\", 0o755);");
fs.writeFileSync("src/bootstrap/src/core/build_steps/dist.rs", c);
'
grep -q '// let cargomiri' "$DIST_RS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# ============================================================
# Patch 04: bootstrap/tool.rs — fix exe extension for cross-compile
# ============================================================
echo "Patch 04: bootstrap/tool.rs"
TOOL_RS="src/bootstrap/src/core/build_steps/tool.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/core/build_steps/tool.rs", "utf8");
const a1 = "let bin_destination = bindir.join(exe(add_bin, $sel.compiler.host));";
const a2 = "let tool = bindir.join(exe($tool_name, $sel.compiler.host));";
if (!c.includes(a1)) { console.error("04 bin_destination anchor NOT found"); process.exit(1); }
if (!c.includes(a2)) { console.error("04 tool anchor NOT found"); process.exit(1); }
c = c.replace(a1, "let bin_destination = bindir.join(exe(add_bin, $sel.target));");
c = c.replace(a2, "let tool = bindir.join(exe($tool_name, $sel.target));");
fs.writeFileSync("src/bootstrap/src/core/build_steps/tool.rs", c);
'
grep -q 'exe(add_bin, \$sel.target)' "$TOOL_RS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# ============================================================
# Patch 05: miri/Cargo.toml — make ctrlc conditional on non-WASI
# ============================================================
echo "Patch 05: miri/Cargo.toml"
MIRI_CARGO="src/tools/miri/Cargo.toml"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/tools/miri/Cargo.toml", "utf8");
if (!c.includes("ctrlc = \"3.2.5\"\n")) { console.error("05 ctrlc anchor NOT found"); process.exit(1); }
c = c.replace("ctrlc = \"3.2.5\"\n", "");
c = c.replace("[dev-dependencies]", "[target.\"cfg(any(unix, windows))\".dependencies]\nctrlc = \"3.2.5\"\n\n[dev-dependencies]");
fs.writeFileSync("src/tools/miri/Cargo.toml", c);
'
grep -q 'cfg(any(unix, windows))' "$MIRI_CARGO" && echo "  OK" || { echo "  FAIL"; exit 1; }

# ============================================================
# Patch 06: miri/shims/os_str.rs — add WASI OsStr support
# ============================================================
echo "Patch 06: miri/shims/os_str.rs"
OS_STR_RS="src/tools/miri/src/shims/os_str.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/tools/miri/src/shims/os_str.rs", "utf8");
// Add WASI import
c = c.replace(
    "#[cfg(unix)]\nuse std::os::unix::ffi::{OsStrExt, OsStringExt};",
    "#[cfg(unix)]\nuse std::os::unix::ffi::{OsStrExt, OsStringExt};\n#[cfg(target_os = \"wasi\")]\nuse std::os::wasi::ffi::{OsStrExt, OsStringExt};"
);
// Extend ALL remaining #[cfg(unix)] to include wasi (function-level and impl-level)
c = c.replaceAll("#[cfg(unix)]\n        ", "#[cfg(any(unix, target_os = \"wasi\"))]\n        ");
c = c.replaceAll("#[cfg(unix)]\n    ", "#[cfg(any(unix, target_os = \"wasi\"))]\n    ");
fs.writeFileSync("src/tools/miri/src/shims/os_str.rs", c);
'
grep -q 'target_os = "wasi"' "$OS_STR_RS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# ============================================================
# Patch 07: miri/lib.rs + miri/shims/unix/fs.rs — WASI fs support
# ============================================================
echo "Patch 07: miri WASI fs support"
MIRI_LIB="src/tools/miri/src/lib.rs"
MIRI_FS="src/tools/miri/src/shims/unix/fs.rs"

# 07a: Add #![feature(wasi_ext)] to lib.rs
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/tools/miri/src/lib.rs", "utf8");
c = c.replace("#![feature(unqualified_local_imports)]", "#![feature(unqualified_local_imports)]\n#![feature(wasi_ext)]");
fs.writeFileSync("src/tools/miri/src/lib.rs", c);
'
grep -q 'feature(wasi_ext)' "$MIRI_LIB" && echo "  07a OK" || { echo "  07a FAIL"; exit 1; }

# 07b: Add WASI create_link to fs.rs
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/tools/miri/src/shims/unix/fs.rs", "utf8");
const anchor = "#[cfg(unix)]\n        fn create_link(src: &Path, dst: &Path) -> std::io::Result<()> {\n            std::os::unix::fs::symlink(src, dst)\n        }\n\n        #[cfg(windows)]";
if (!c.includes(anchor)) { console.error("07b create_link anchor NOT found"); process.exit(1); }
c = c.replace(anchor,
    "#[cfg(unix)]\n        fn create_link(src: &Path, dst: &Path) -> std::io::Result<()> {\n            std::os::unix::fs::symlink(src, dst)\n        }\n\n        #[cfg(target_os = \"wasi\")]\n        fn create_link(src: &Path, dst: &Path) -> std::io::Result<()> {\n            std::os::wasi::fs::symlink_path(src, dst)\n        }\n\n        #[cfg(windows)]"
);
fs.writeFileSync("src/tools/miri/src/shims/unix/fs.rs", c);
'
grep -q 'symlink_path' "$MIRI_FS" && echo "  07b OK" || { echo "  07b FAIL"; exit 1; }

# ============================================================
# Patch 08: Fix flock compile_error on WASI (fs.rs)
# ============================================================
echo "Patch 08: flock fix"
sed -i 's/compile_error!("flock is supported only on UNIX and Windows hosts");/return interp_ok(Err(io::Error::new(io::ErrorKind::Unsupported, "flock not supported")));/' "$MIRI_FS"
! grep -q 'compile_error!.*flock' "$MIRI_FS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# ============================================================
# Patch 09: Add WASI win_absolute (windows/foreign_items.rs)
# ============================================================
echo "Patch 09: win_absolute for WASI"
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
echo "=== All patches applied ==="
echo ""

# ============================================================
# Patch 11: stdlib — skip sanitize_standard_fds (uses poll() FFI that Miri can't execute)
# ============================================================
echo "Patch 11: stdlib sanitize_standard_fds"
UNIX_MOD="library/std/src/sys/pal/unix/mod.rs"
sed -i 's/sanitize_standard_fds();/\/\/ sanitize_standard_fds(); \/\/ disabled for Miri — poll() FFI unsupported/' "$UNIX_MOD"
grep -q '// sanitize_standard_fds' "$UNIX_MOD" && echo "  OK" || { echo "  FAIL"; exit 1; }

# ============================================================
# Build Miri
# ============================================================
# Patch bootstrap to skip missing self-contained tools (like llvm-objcopy.wasm)
# The sysroot creation panics when copying a file that doesn't exist.
# Make copy_link skip missing files instead of panicking.
echo "Patching bootstrap copy_link for missing files..."
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/lib.rs", "utf8");
// Find the copy_link function that calls src.symlink_metadata()
// and add a guard to skip when src does not exist
c = c.replace(
    "let metadata = t!(src.symlink_metadata(), format!(\"src = {}\", src.display()));",
    "let metadata = match src.symlink_metadata() {\n        Ok(m) => m,\n        Err(_) if src.extension().is_some_and(|e| e == \"wasm\") => return,\n        Err(e) => panic!(\"src.symlink_metadata() failed with {} (\\\"src = {}\\\")\", e, src.display()),\n    };"
);
fs.writeFileSync("src/bootstrap/src/lib.rs", c);
'
grep -q 'extension().is_some_and' src/bootstrap/src/lib.rs && echo "  Bootstrap patched OK" || { echo "  FAIL: bootstrap patch"; exit 1; }

echo "=== Building Miri ==="
./x.py build miri 2>&1 | tee /build/build.log

echo "=== Installing ==="
./x.py install 2>&1 | tee -a /build/build.log

echo ""
echo "=== Build complete ==="
echo ""

# Show results
echo "=== dist/bin/ ==="
ls -lh dist/bin/ 2>/dev/null || echo "No bin directory"
echo ""
echo "=== Miri WASM binary ==="
ls -lh dist/bin/miri.wasm 2>/dev/null || echo "miri.wasm not found!"
echo ""
echo "=== rlib files ==="
ls -lh dist/lib/rustlib/x86_64-unknown-linux-gnu/lib/*.rlib 2>/dev/null | head -30 || echo "No rlib files found"
