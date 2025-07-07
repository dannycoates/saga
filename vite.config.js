import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: {
        main: '/index.html',
        documentation: '/documentation.html'
      }
    }
  },
  server: {
    open: true,
    port: 3000
  },
  test: {
    globals: true,
    environment: 'jsdom',
    root: './',
    include: ['tests/**/*.test.js']
  }
})