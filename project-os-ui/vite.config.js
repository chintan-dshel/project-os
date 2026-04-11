import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/projects': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/registry': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/knowledge': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
