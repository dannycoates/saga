import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "./dist",
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
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
