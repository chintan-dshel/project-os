import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth':      { target: 'http://localhost:3000', changeOrigin: true },
      '/projects':  { target: 'http://localhost:3000', changeOrigin: true },
      '/registry':  { target: 'http://localhost:3000', changeOrigin: true },
      '/knowledge': { target: 'http://localhost:3000', changeOrigin: true },
      '/telemetry': { target: 'http://localhost:3000', changeOrigin: true },
      '/health':    { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
