import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'coderunner-[hash].js',
        chunkFileNames: 'coderunner-[hash].js',
        assetFileNames: 'coderunner-[hash][extname]',
      },
    },
  },
  server: {
    host: '0.0.0.0', // Expose to all network interfaces
    port: 5173,
    proxy: {
      '/admin/stats': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin/metrics': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin/report': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin/reset': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/execute': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
