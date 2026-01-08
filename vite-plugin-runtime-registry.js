// Vite plugin that auto-generates the runtime registry by scanning
// src/runtimes/*/index.js directories and extracting metadata.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parses a JavaScript object literal string into an object.
// Only handles simple string properties (no nested objects, arrays, etc.)
function parseObjectLiteral(objectStr) {
  const result = {};
  // Match property: value pairs where value is a string
  const propertyRegex = /(\w+)\s*:\s*["']([^"']+)["']/g;
  let match;
  while ((match = propertyRegex.exec(objectStr)) !== null) {
    result[match[1]] = match[2];
  }
  return Object.keys(result).length > 0 ? result : null;
}

// Extracts the `metadata` export from a runtime index.js file.
function extractMetadata(content) {
  // Match: export const metadata = { ... };
  const match = content.match(
    /export\s+const\s+metadata\s*=\s*(\{[\s\S]*?\});/,
  );
  if (!match) return null;
  return parseObjectLiteral(match[1]);
}

// Scans the runtimes directory and returns metadata for all valid runtimes.
function discoverRuntimes(runtimesDir) {
  const entries = fs.readdirSync(runtimesDir, { withFileTypes: true });
  const runtimes = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const indexPath = path.join(runtimesDir, entry.name, "index.js");
    if (!fs.existsSync(indexPath)) continue;

    const content = fs.readFileSync(indexPath, "utf-8");
    const metadata = extractMetadata(content);

    if (
      metadata &&
      metadata.id &&
      metadata.displayName &&
      metadata.fileExtension
    ) {
      runtimes.push({
        dir: entry.name,
        id: metadata.id,
        displayName: metadata.displayName,
        fileExtension: metadata.fileExtension,
      });
    }
  }

  // Sort with JavaScript first (default), then alphabetically by displayName
  runtimes.sort((a, b) => {
    if (a.id === "javascript") return -1;
    if (b.id === "javascript") return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return runtimes;
}

// Generates the virtual module code for the runtime registry.
function generateRegistryCode(runtimes) {
  const registryArray = JSON.stringify(
    runtimes.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      fileExtension: r.fileExtension,
    })),
    null,
    2,
  );

  // Generate static import() calls - these must be literal strings for Vite
  // to recognize them as dynamic imports for code-splitting.
  // Use absolute paths from project root since virtual modules have no filesystem location.
  const importEntries = runtimes
    .map((r) => `  ${r.id}: () => import("/src/runtimes/${r.dir}/index.js")`)
    .join(",\n");

  return `// Auto-generated runtime registry - DO NOT EDIT

export const runtimeRegistry = ${registryArray};

export const runtimeImports = {
${importEntries}
};

export function getSupportedLanguages() {
  return runtimeRegistry.map((r) => r.id);
}

export function getRuntimeInfo(id) {
  return runtimeRegistry.find((r) => r.id === id);
}

export function isLanguageSupported(id) {
  return runtimeRegistry.some((r) => r.id === id);
}
`;
}

// Creates the Vite plugin for runtime registry generation.
export function runtimeRegistryPlugin() {
  const virtualModuleId = "virtual:runtime-registry";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "vite-plugin-runtime-registry",

    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },

    load(id) {
      if (id !== resolvedVirtualModuleId) return null;

      const runtimesDir = path.resolve(__dirname, "src/runtimes");
      const runtimes = discoverRuntimes(runtimesDir);
      return generateRegistryCode(runtimes);
    },
  };
}

// Gets the list of discovered runtime directory names.
// Useful for configuring manualChunks in vite.config.js.
export function getDiscoveredRuntimeDirs() {
  const runtimesDir = path.resolve(__dirname, "src/runtimes");
  return discoverRuntimes(runtimesDir).map((r) => r.dir);
}
