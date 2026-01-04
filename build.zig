const std = @import("std");

// Build Zig compiler to WASM for browser-based compilation
// Usage: zig build --prefix public/zig
pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{ .cpu_arch = .wasm32, .os_tag = .wasi });
    const optimize: std.builtin.OptimizeMode = b.standardOptimizeOption(.{ .preferred_optimize_mode = .ReleaseSmall });

    const enable_wasm_opt = b.option(bool, "wasm-opt", "Run wasm-opt") orelse false;

    const zig_step = b.step("zig", "compile and install Zig compiler to WASM");
    const tarball_step = b.step("zig_tarball", "compile and install zig.tar.gz stdlib");

    b.getInstallStep().dependOn(zig_step);
    b.getInstallStep().dependOn(tarball_step);

    const zig_dependency = b.dependency("zig", .{
        .target = target,
        .optimize = optimize,
        .@"version-string" = @as([]const u8, "0.15.1"),
        .@"no-lib" = true,
        .dev = "wasm",
    });
    // Install zig.wasm directly to public/zig (not in bin subdirectory)
    zig_step.dependOn(installArtifact(b, zig_dependency.artifact("zig"), enable_wasm_opt));

    const run_tar = b.addSystemCommand(&.{ "tar", "-czf" });
    const zig_tar_gz = run_tar.addOutputFileArg("zig.tar.gz");
    tarball_step.dependOn(&b.addInstallFile(zig_tar_gz, "zig.tar.gz").step);
    run_tar.addArg("-C");
    run_tar.addDirectoryArg(zig_dependency.path("."));
    run_tar.addArg("lib/std");
}

fn installArtifact(b: *std.Build, artifact: *std.Build.Step.Compile, enable_wasm_opt: bool) *std.Build.Step {
    const file_name = b.fmt("{s}.wasm", .{artifact.name});
    if (enable_wasm_opt) {
        const wasm_opt = b.addSystemCommand(&.{
            "wasm-opt",
            "-Oz",
            "--enable-bulk-memory",
            "--enable-mutable-globals",
            "--enable-nontrapping-float-to-int",
            "--enable-sign-ext",
        });
        wasm_opt.addArtifactArg(artifact);
        wasm_opt.addArg("-o");
        const exe = wasm_opt.addOutputFileArg(file_name);
        // Install directly to prefix root (not bin/)
        return &b.addInstallFile(exe, file_name).step;
    } else {
        // Install directly to prefix root (not bin/)
        return &b.addInstallArtifact(artifact, .{ .dest_dir = .{ .override = .prefix } }).step;
    }
}
