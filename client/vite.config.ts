import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { compression } from 'vite-plugin-compression2'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Pre-compress assets at build time for faster serving
    compression({
      algorithms: ['gzip', 'brotliCompress'],
      exclude: [/\.(br)$/, /\.(gz)$/],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        entryFileNames: 'coderunner-[hash].js',
        chunkFileNames: 'coderunner-[hash].js',
        assetFileNames: 'coderunner-[hash][extname]',
        manualChunks(id: string) {
          // Core React — changes rarely, cached long-term
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // Monaco Editor — largest dep (~5MB), separate cache
          if (id.includes('node_modules/monaco-editor/') || id.includes('node_modules/@monaco-editor/')) {
            return 'vendor-monaco';
          }
          // Radix UI primitives — shared across components
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          // Recharts — only used by AdminPage (lazy-loaded)
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-')) {
            return 'vendor-recharts';
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
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
      '/admin/logs': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin/snapshots': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin/history': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin/pipeline-metrics': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin/load-test-reports': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin/run-load-test': {
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
