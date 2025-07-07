import { defineConfig } from "vite";

// Custom plugin to control bundling behavior
const selectiveBundlePlugin = () => {
  return {
    name: 'selective-bundle',
    generateBundle(options, bundle) {
      // Track which modules should be in vendor bundle
      const vendorModules = new Set();
      const sourceModules = new Set();
      
      // Categorize modules
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          for (const moduleId of Object.keys(chunk.modules || {})) {
            if (moduleId.includes('node_modules')) {
              vendorModules.add(moduleId);
            } else if (moduleId.includes('/src/')) {
              sourceModules.add(moduleId);
            }
          }
        }
      }
      
      console.log(`Found ${vendorModules.size} vendor modules and ${sourceModules.size} source modules`);
    }
  };
};

// Custom plugin to control sourcemap generation
const selectiveSourcemapPlugin = () => {
  return {
    name: 'selective-sourcemap',
    generateBundle(options, bundle) {
      // Remove sourcemaps for non-vendor chunks
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (fileName.endsWith('.js.map')) {
          // Check if this is a sourcemap for a source file (not vendor)
          const jsFileName = fileName.replace('.map', '');
          if (jsFileName.includes('/src/') || !jsFileName.includes('vendor')) {
            // Delete sourcemap for source files
            delete bundle[fileName];
            
            // Remove sourcemap reference from the JS file
            const jsFile = bundle[jsFileName];
            if (jsFile && jsFile.type === 'chunk') {
              jsFile.code = jsFile.code.replace(/\n\/\/# sourceMappingURL=.*\.map\s*$/, '');
            }
          }
        }
      }
    }
  };
};

export default defineConfig({
  root: ".",
  build: {
    target: 'esnext',
    outDir: "./dist",
    rollupOptions: {
      input: {
        main: "./index.html",
      },
      plugins: [selectiveBundlePlugin(), selectiveSourcemapPlugin()],
      output: {
        format: 'es',
        // Preserve original export names
        exports: 'named',
        preserveModules: false,
        minifyInternalExports: false,
        // Split code into chunks more aggressively
        manualChunks: (id, { getModuleInfo }) => {
          // Bundle all node_modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          
          // Create separate chunks for each source file
          if (id.includes('/src/')) {
            // Extract the relative path from src
            const match = id.match(/\/src\/(.*?)\.js/);
            if (match) {
              // Return the file path as chunk name
              return `src/${match[1]}`;
            }
          }
          
          return undefined;
        },
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'vendor') {
            return 'assets/vendor.js';
          }
          if (chunkInfo.name.startsWith('src/')) {
            return `assets/${chunkInfo.name}.js`;
          }
          return 'assets/[name].js';
        },
        entryFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    // Disable minification
    minify: false,
    // Enable sourcemaps
    sourcemap: true,
    // Increase chunk size limit
    chunkSizeWarningLimit: 2000,
    // Disable module preload polyfill
    modulePreload: false
  },
  server: {
    open: true,
    port: 3000,
  },
  test: {
    globals: true,
    environment: "jsdom",
    root: "./",
    include: ["tests/**/*.test.js"],
  },
});