#!/bin/bash
set -euo pipefail
cd /build/rust

echo "=== Pre-build: config + WASI SDK + bootstrap patches + stdlib ==="

# Detect architecture and build triple
ARCH=$(uname -m)
echo "Build host architecture: $ARCH"

if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    WASI_SDK_ARCHIVE="wasi-sdk-24.0-arm64-linux"
    BUILD_TRIPLE="aarch64-unknown-linux-gnu"
else
    WASI_SDK_ARCHIVE="wasi-sdk-24.0-x86_64-linux"
    BUILD_TRIPLE="x86_64-unknown-linux-gnu"
fi

# Download WASI SDK
curl -LO "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-24/${WASI_SDK_ARCHIVE}.tar.gz"
tar xzf "${WASI_SDK_ARCHIVE}.tar.gz"
rm "${WASI_SDK_ARCHIVE}.tar.gz"

# Write config.toml — single-pass build with prebuilt wasm32 stdlib.
cat > config.toml << TOML_EOF
profile = "compiler"
change-id = 9999999

[llvm]
download-ci-llvm = true

[rust]
codegen-backends = ["llvm"]
deny-warnings = false
llvm-bitcode-linker = false
debug = false
debuginfo-level = 0

[build]
submodules = false
docs = false
extended = true
tools = ["miri"]
host = ["wasm32-wasip1"]
target = ["${BUILD_TRIPLE}", "wasm32-wasip1"]

[install]
prefix = "dist"
sysconfdir = "etc"

[target.'wasm32-wasip1']
wasi-root = "${WASI_SDK_ARCHIVE}/share/wasi-sysroot"
linker = "${WASI_SDK_ARCHIVE}/bin/clang"
codegen-backends = ["cranelift"]

[target.'wasm32-wasip1-threads']
wasi-root = "${WASI_SDK_ARCHIVE}/share/wasi-sysroot"
linker = "${WASI_SDK_ARCHIVE}/bin/clang"
codegen-backends = ["cranelift"]

TOML_EOF

echo "config.toml written"
cat config.toml

# Add WASI SDK bin to PATH
export PATH="/build/rust/${WASI_SDK_ARCHIVE}/bin:${PATH}"

# Download prebuilt wasm32-wasip1 stdlib matching stage0 (1.92.0).
echo "=== Downloading prebuilt wasm32 stdlib (1.92.0) ==="
WASM_STD_URL="https://static.rust-lang.org/dist/2025-12-11/rust-std-1.92.0-wasm32-wasip1.tar.xz"
curl -sL "$WASM_STD_URL" | tar xJ -C /build/
WASM_STD_SRC=$(find /build/rust-std-1.92.0-wasm32-wasip1 -path '*/wasm32-wasip1/lib' -type d 2>/dev/null | head -1)
echo "  wasm32 stdlib at: $WASM_STD_SRC"
echo "$WASM_STD_SRC" > /build/wasm32-std-path.txt

# Pre-init critical submodules. LLVM is downloaded via CI artifacts (download-ci-llvm = true).
echo "=== Initializing submodules ==="
git submodule update --init --depth=1 src/tools/miri library/backtrace library/stdarch
# Cranelift is in-tree, no submodule needed

# ============================================================
# Bootstrap patches — applied here so stage1 compiler includes them.
# Modifying bootstrap source in build.sh would force a bootstrap
# rebuild, losing the stage1 compiler and hitting the
# "cannot build stdlib for wasm32-wasip1 with stage0" check.
# ============================================================

echo "=== Applying bootstrap patches ==="

# Patch: compile.rs — add -Zalways-encode-mir for stdlib
echo "Patch: compile.rs (-Zalways-encode-mir)"
COMPILE_RS="src/bootstrap/src/core/build_steps/compile.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/core/build_steps/compile.rs", "utf8");

// Add -Zalways-encode-mir to the STDLIB build (not the compiler build).
// This ensures MIR is encoded in rlibs for Miri interpretation.
// The anchor is in Std::run, the else branch that builds the regular sysroot.
const stdCargoAnchor = "std_cargo(builder, target, &mut cargo, &self.crates);";
if (!c.includes(stdCargoAnchor)) { console.error("std_cargo anchor not found"); process.exit(1); }
c = c.replace(
    stdCargoAnchor,
    stdCargoAnchor + "\n            // PATCHED: encode MIR in rlibs for Miri\n            cargo.rustflag(\"-Zalways-encode-mir\");"
);

fs.writeFileSync("src/bootstrap/src/core/build_steps/compile.rs", c);
'
grep -q 'encode MIR in rlibs for Miri' "$COMPILE_RS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# Patch: dist.rs — disable CargoMiri
echo "Patch: dist.rs (disable CargoMiri)"
DIST_RS="src/bootstrap/src/core/build_steps/dist.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/core/build_steps/dist.rs", "utf8");
c = c.replace(
    /let cargomiri = builder\.ensure\(tool::CargoMiri[^;]+;\s*/,
    "// let cargomiri = ...;\n        "
);
c = c.replace(
    /tarball\.add_file\(&cargomiri[^;]+;\s*/,
    "// tarball.add_file(&cargomiri ...);\n        "
);
fs.writeFileSync("src/bootstrap/src/core/build_steps/dist.rs", c);
'
grep -q '// let cargomiri' "$DIST_RS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# Patch: tool.rs — fix exe extension for cross-compile
echo "Patch: tool.rs (exe extension for cross-compile)"
TOOL_RS="src/bootstrap/src/core/build_steps/tool.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/core/build_steps/tool.rs", "utf8");
let patched = false;

const a1 = "let bin_destination = bindir.join(exe(add_bin, $sel.compiler.host));";
const a2 = "let tool = bindir.join(exe($tool_name, $sel.compiler.host));";
if (c.includes(a1) && c.includes(a2)) {
    c = c.replace(a1, "let bin_destination = bindir.join(exe(add_bin, $sel.target));");
    c = c.replace(a2, "let tool = bindir.join(exe($tool_name, $sel.target));");
    patched = true;
}

if (!patched) {
    const b1 = "let bin_destination = bindir.join(exe(add_bin, target_compiler.host));";
    if (c.includes(b1)) {
        c = c.replace(b1, "let bin_destination = bindir.join(exe(add_bin, target));");
        patched = true;
    }
}

if (!patched) {
    console.error("  WARN: tool.rs exe pattern not found, will fix if build fails");
} else {
    console.error("  tool.rs patched OK");
}
fs.writeFileSync("src/bootstrap/src/core/build_steps/tool.rs", c);
'
echo "  Done"

# Patch: bootstrap/lib.rs — skip missing .wasm files in copy_link
echo "Patch: bootstrap copy_link"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/lib.rs", "utf8");
const anchor1 = "let mut metadata = t!(src.symlink_metadata()";
const anchor2 = "let metadata = t!(src.symlink_metadata()";
let anchor;
if (c.includes(anchor1)) { anchor = anchor1; }
else if (c.includes(anchor2)) { anchor = anchor2; }
else { console.error("copy_link anchor NOT found"); process.exit(1); }
c = c.replace(
    /let mut metadata = t!\(src\.symlink_metadata\(\)[^;]+;/,
    "let mut metadata = match src.symlink_metadata() {\n        Ok(m) => m,\n        Err(_) if src.extension().is_some_and(|e| e == \"wasm\") => return,\n        Err(e) => panic!(\"src.symlink_metadata() failed with {} (src = {})\", e, src.display()),\n    };"
);
c = c.replace(
    /let metadata = t!\(src\.symlink_metadata\(\)[^;]+;/,
    "let metadata = match src.symlink_metadata() {\n        Ok(m) => m,\n        Err(_) if src.extension().is_some_and(|e| e == \"wasm\") => return,\n        Err(e) => panic!(\"src.symlink_metadata() failed with {} (src = {})\", e, src.display()),\n    };"
);
fs.writeFileSync("src/bootstrap/src/lib.rs", c);
'
grep -q 'extension().is_some_and' src/bootstrap/src/lib.rs && echo "  OK" || { echo "  FAIL"; exit 1; }

# Patch: builder/mod.rs — copy prebuilt wasm32 stdlib to sysroot
BUILDER_MOD="src/bootstrap/src/core/builder/mod.rs"
echo "Patch: builder/mod.rs (prebuilt wasm32 stdlib)"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/core/builder/mod.rs", "utf8");
const blockStart = "if self.local_rebuild {";
const idx = c.indexOf(blockStart);
if (idx === -1) { console.error("builder/mod.rs local_rebuild anchor NOT found"); process.exit(1); }
let depth = 0;
let end = idx;
for (let i = idx; i < c.length; i++) {
    if (c[i] === "{") depth++;
    if (c[i] === "}") {
        depth--;
        if (depth === 0) {
            const rest = c.substring(i + 1).trimStart();
            if (rest.startsWith("else")) { continue; }
            end = i + 1;
            break;
        }
    }
}
c = c.substring(0, idx) + "// PATCHED: copy prebuilt wasm32 stdlib into stage0 sysroot.\n                let src_path = std::fs::read_to_string(\"/build/wasm32-std-path.txt\")\n                    .expect(\"wasm32-std-path.txt not found\")\n                    .trim().to_string();\n                let dst_dir = self.sysroot_target_libdir(compiler, target);\n                let _ = std::fs::create_dir_all(&dst_dir);\n                self.cp_link_r(&std::path::PathBuf::from(&src_path), &dst_dir);\n                None" + c.substring(end);
fs.writeFileSync("src/bootstrap/src/core/builder/mod.rs", c);
'
grep -q 'copy prebuilt wasm32 stdlib' "$BUILDER_MOD" && echo "  OK" || { echo "  FAIL"; exit 1; }

# Patch: builder/mod.rs — skip sysroot removal for wasm32 targets.
# The bootstrap removes sysroot/lib/rustlib/<target>/lib/ for each target
# "to avoid caching bugs", but this wipes the wasm32 stdlib we need.
echo "Patch: builder/mod.rs (skip wasm32 sysroot removal)"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/core/builder/mod.rs", "utf8");
const anchor = "Removing sysroot";
if (!c.includes(anchor)) { console.error("Libdir sysroot removal anchor not found"); process.exit(1); }
// Add a skip for wasm32 targets before the removal
c = c.replace(
    "let sysroot_target_libdir = sysroot.join(self.target).join(\"lib\");",
    "let sysroot_target_libdir = sysroot.join(self.target).join(\"lib\");\n                // PATCHED: skip removal for wasm32 targets to preserve stdlib\n                if self.target.triple.contains(\"wasm32\") {\n                    let _ = fs::create_dir_all(&sysroot_target_libdir);\n                    return sysroot;\n                }"
);
fs.writeFileSync("src/bootstrap/src/core/builder/mod.rs", c);
'
grep -q 'skip removal for wasm32' "$BUILDER_MOD" && echo "  OK" || { echo "  FAIL"; exit 1; }

# Patch: rustc_driver/Cargo.toml — add "lib" crate type alongside "dylib"
# In Nov 2024 Rust, rustc_driver had crate-type = ["lib", "dylib"].
# The latest only has ["dylib"]. For wasm32 (which can't produce dylibs),
# cargo needs the "lib" type to produce an rlib instead.
echo "Patch: rustc_driver/Cargo.toml (add lib crate type)"
DRIVER_TOML="compiler/rustc_driver/Cargo.toml"
sed -i 's/crate-type = \["dylib"\]/crate-type = ["lib", "dylib"]/' "$DRIVER_TOML"
grep -q '"lib", "dylib"' "$DRIVER_TOML" && echo "  OK" || { echo "  FAIL"; exit 1; }

# Patch: compile.rs — keep rlibs for WASM targets + skip strip + skip codegen backends
# 1.93 uses the older run_cargo(..., true) format for rlib_only_metadata.
# For WASM targets there's no librustc_driver.so dylib so we need all rlibs.
echo "Patch: compile.rs (WASM rlibs + strip skip + codegen backend skip)"
node -e '
const fs = require("fs");
let c = fs.readFileSync("src/bootstrap/src/core/build_steps/compile.rs", "utf8");

// 1. Preserve rlibs for WASI targets (rlib_only_metadata flag)
const rlibAnchor = /true,\s*\/\/\s*Only ship rustc_driver/;
const match = c.match(rlibAnchor);
if (!match) { console.error("rlib_only_metadata anchor NOT found"); process.exit(1); }
c = c.replace(match[0], "!target.triple.contains(\"wasi\"), // PATCHED: keep rlibs for WASI targets //");
console.error("  rlib preservation patch applied");

// 2. Skip librustc_driver.so strip for targets that do not produce it (WASM)
const stripAnchor = "let rustc_driver = target_root_dir.join(\"librustc_driver.so\");";
if (!c.includes(stripAnchor)) { console.error("strip anchor NOT found"); process.exit(1); }
c = c.replace(
    stripAnchor + "\n            strip_debug(builder, target, &rustc_driver);",
    stripAnchor + "\n            if rustc_driver.exists() { strip_debug(builder, target, &rustc_driver); }");
console.error("  strip skip patch applied");

// 3. Skip codegen backends for WASM hosts in the Assemble step
const checkSkip = "if builder.kind == Kind::Check && builder.top_stage == 1 {";
if (!c.includes(checkSkip)) { console.error("Assemble codegen backend anchor NOT found"); process.exit(1); }
c = c.replace(
    checkSkip + "\n                    continue;\n                }",
    checkSkip + "\n                    continue;\n                }\n\n                // PATCHED: skip codegen backends for WASM hosts — miri does not need them\n                if target_compiler.host.triple.contains(\"wasm32\") {\n                    continue;\n                }");
console.error("  Assemble codegen backend skip applied");

// 4. Set CFG_DEFAULT_CODEGEN_BACKEND to "dummy" for wasm32 targets.
// Miri does not need a codegen backend. Without this, it tries to load cranelift/llvm at startup.
const cgAnchor = "cargo.env(\"CFG_DEFAULT_CODEGEN_BACKEND\"";
if (!c.includes(cgAnchor)) { console.error("CFG_DEFAULT_CODEGEN_BACKEND anchor NOT found"); process.exit(1); }
c = c.replace(
    cgAnchor + ", builder.config.default_codegen_backend(target).name());",
    "// PATCHED: use dummy codegen backend for WASM (miri has no codegen)\n    if target.triple.contains(\"wasm32\") {\n        cargo.env(\"CFG_DEFAULT_CODEGEN_BACKEND\", \"dummy\");\n    } else {\n        " + cgAnchor + ", builder.config.default_codegen_backend(target).name());\n    }");
console.error("  dummy codegen backend for wasm32 applied");

fs.writeFileSync("src/bootstrap/src/core/build_steps/compile.rs", c);
'
grep -q 'keep rlibs for WASI' "$COMPILE_RS" && echo "  rlibs OK" || { echo "  rlibs FAIL"; exit 1; }
grep -q 'rustc_driver.exists()' "$COMPILE_RS" && echo "  strip OK" || { echo "  strip FAIL"; exit 1; }
grep -q 'skip codegen backends for WASM' "$COMPILE_RS" && echo "  codegen OK" || { echo "  codegen FAIL"; exit 1; }

# Patch: ALL process::id() calls in compiler — use dummy PID on WASM
echo "Patch: process::id() calls (wasm PID stub)"
# rustc_driver_impl
sed -i 's/let pid = std::process::id();/let pid = if cfg!(target_family = "wasm") { 1 } else { std::process::id() };/' compiler/rustc_driver_impl/src/lib.rs
# rustc_data_structures profiling
sed -i 's/let pid: u32 = process::id();/let pid: u32 = if cfg!(target_family = "wasm") { 1 } else { process::id() };/' compiler/rustc_data_structures/src/profiling.rs
# rustc_monomorphize
sed -i 's/std::process::id()/if cfg!(target_family = "wasm") { 1 } else { std::process::id() }/' compiler/rustc_monomorphize/src/util.rs
# miri machine.rs
sed -i 's/let pid = process::id();/let pid = if cfg!(target_family = "wasm") { 1 } else { process::id() };/' src/tools/miri/src/machine.rs
# miri shims/env.rs
sed -i 's/std::process::id() } else { 1000/if cfg!(target_family = "wasm") { 1 } else { std::process::id() } } else { 1000/' src/tools/miri/src/shims/env.rs
echo "  OK"

# Patch: rustc_data_structures/jobserver.rs — replace with thread-free version
# The default jobserver uses helper threads which WASI does not support.
# Replace with bjorn3's simplified version that uses direct acquire/release.
echo "Patch: jobserver.rs (no helper threads)"
cat > compiler/rustc_data_structures/src/jobserver.rs << 'JOBSERVER_EOF'
use std::sync::{Arc, LazyLock, OnceLock};

pub use jobserver_crate::{Acquired, Client};
use jobserver_crate::{FromEnv, FromEnvErrorKind};

// Simplified Proxy for single-threaded WASI — no helper threads.
pub struct Proxy;
impl Proxy {
    pub fn new() -> Arc<Self> { Arc::new(Proxy) }
    pub fn acquire_thread(&self) { acquire_thread(); }
    pub fn release_thread(&self) { release_thread(); }
}

static GLOBAL_CLIENT: LazyLock<Result<Client, String>> = LazyLock::new(|| {
    let FromEnv { client, var } = unsafe { Client::from_env_ext(true) };
    let error = match client {
        Ok(client) => return Ok(client),
        Err(e) => e,
    };
    if matches!(
        error.kind(),
        FromEnvErrorKind::NoEnvVar
            | FromEnvErrorKind::NoJobserver
            | FromEnvErrorKind::NegativeFd
            | FromEnvErrorKind::Unsupported
    ) {
        return Ok(default_client());
    }
    let (name, value) = var.unwrap();
    Err(format!(
        "failed to connect to jobserver from environment variable `{name}={:?}`: {error}",
        value
    ))
});

fn default_client() -> Client {
    let client = Client::new(32).expect("failed to create jobserver");
    client.acquire_raw().ok();
    client
}

static GLOBAL_CLIENT_CHECKED: OnceLock<Client> = OnceLock::new();

pub fn initialize_checked(report_warning: impl FnOnce(&'static str)) {
    let client_checked = match &*GLOBAL_CLIENT {
        Ok(client) => client.clone(),
        Err(e) => {
            report_warning(e);
            default_client()
        }
    };
    GLOBAL_CLIENT_CHECKED.set(client_checked).ok();
}

const ACCESS_ERROR: &str = "jobserver check should have been called earlier";

pub fn client() -> Client {
    GLOBAL_CLIENT_CHECKED.get().expect(ACCESS_ERROR).clone()
}

pub fn acquire_thread() {
    GLOBAL_CLIENT_CHECKED.get().expect(ACCESS_ERROR).acquire_raw().ok();
}

pub fn release_thread() {
    GLOBAL_CLIENT_CHECKED.get().expect(ACCESS_ERROR).release_raw().ok();
}
JOBSERVER_EOF
echo "  OK"

# Patch: rustc_interface/util.rs — skip thread spawning on WASI
# WASI doesn't support thread::spawn_scoped. Run directly on current thread.
echo "Patch: rustc_interface/util.rs (skip thread spawn)"
UTIL_RS="compiler/rustc_interface/src/util.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("compiler/rustc_interface/src/util.rs", "utf8");
const anchor = "let builder = thread::Builder::new().name(\"rustc\".to_string())";
if (!c.includes(anchor)) { console.error("thread builder anchor NOT found"); process.exit(1); }
c = c.replace(
    /let builder = thread::Builder::new\(\)\.name\("rustc"\.to_string\(\)\)\.stack_size\(thread_stack_size\);[\s\S]*?thread::scope\(\|s\| \{[\s\S]*?\}\)\s*\}/,
    "// PATCHED: skip thread spawn on WASI — run directly on current thread\n    rustc_span::create_session_globals_then(\n        edition,\n        extra_symbols,\n        Some(sm_inputs),\n        || f(CurrentGcx::new(), Proxy::new()),\n    )\n}"
);
fs.writeFileSync("compiler/rustc_interface/src/util.rs", c);
'
grep -q 'skip thread spawn on WASI' "$UTIL_RS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# Patch: rustc_session/filesearch.rs — fix sysroot detection on WASI
# default_sysroot() panics on WASI because current_dll_path is unsupported.
# Return a fallback path instead — --sysroot is always passed explicitly.
echo "Patch: filesearch.rs (WASI sysroot fallback)"
FILESEARCH="compiler/rustc_session/src/filesearch.rs"
sed -i 's|Err("current_dll_path is not supported on WASI".to_string())|Ok(std::path::PathBuf::from("/sysroot/lib/rustc_driver"))|' "$FILESEARCH"
grep -q 'sysroot/lib/rustc_driver' "$FILESEARCH" && echo "  OK" || { echo "  FAIL"; exit 1; }

# Patch: stdlib — skip sanitize_standard_fds
# This MUST be in pre-build (not build.sh) because modifying stdlib source
# in build.sh would make the sysroot dirty, causing the bootstrap to wipe
# and recreate it — removing the wasm32-wasip1 stdlib.
echo "Patch: stdlib sanitize_standard_fds"
UNIX_MOD="library/std/src/sys/pal/unix/mod.rs"
sed -i 's/sanitize_standard_fds();/\/\/ sanitize_standard_fds(); \/\/ disabled for Miri/' "$UNIX_MOD"
grep -q '// sanitize_standard_fds' "$UNIX_MOD" && echo "  OK" || { echo "  FAIL"; exit 1; }

# Patch: WASI os.rs — return dummy PID instead of panicking
# getpid() is called during compiler/miri init but WASI has no process IDs.
echo "Patch: WASI os.rs (getpid stub)"
WASI_OS="library/std/src/sys/pal/wasip1/os.rs"
sed -i 's/pub fn getpid() -> u32 {/pub fn getpid() -> u32 { return 1; \/\/ PATCHED/' "$WASI_OS"
grep -q 'return 1; // PATCHED' "$WASI_OS" && echo "  OK" || { echo "  FAIL"; exit 1; }

# Patch: rustc_metadata/creader.rs — stub dylib loading for wasm32
# libloading::Library is gated behind cfg(any(unix, windows)).
# Gate the three dylib functions and provide a wasm32 stub.
echo "Patch: rustc_metadata/creader.rs (libloading wasm32 stub)"
CREADER="compiler/rustc_metadata/src/creader.rs"
node -e '
const fs = require("fs");
let c = fs.readFileSync("compiler/rustc_metadata/src/creader.rs", "utf8");

// Gate attempt_load_dylib
c = c.replace(
    "fn attempt_load_dylib(",
    "#[cfg(any(unix, windows))]\nfn attempt_load_dylib("
);

// Gate load_dylib
c = c.replace(
    "fn load_dylib(",
    "#[cfg(any(unix, windows))]\nfn load_dylib("
);

// Gate the real load_symbol_from_dylib and add wasm32 stub
c = c.replace(
    "pub unsafe fn load_symbol_from_dylib<T: Copy>(",
    "// PATCHED: stub for platforms without dylib support\n#[cfg(not(any(unix, windows)))]\npub unsafe fn load_symbol_from_dylib<T: Copy>(\n    path: &Path,\n    _sym_name: &str,\n) -> Result<T, DylibError> {\n    Err(DylibError::DlOpen(path.display().to_string(), \"dynamic loading not supported\".into()))\n}\n\n#[cfg(any(unix, windows))]\npub unsafe fn load_symbol_from_dylib<T: Copy>("
);

fs.writeFileSync("compiler/rustc_metadata/src/creader.rs", c);
'
grep -q 'dynamic loading not supported' "$CREADER" && echo "  OK" || { echo "  FAIL"; exit 1; }

echo "=== All patches applied ==="

echo "=== Building compiler + stdlib ==="
./x.py build compiler library 2>&1

echo "=== Pre-build complete ==="
