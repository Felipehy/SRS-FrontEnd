import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    rollupOptions: {
      output: {
        // Keep the (rarely-changing) React core in its own long-cached chunk.
        // Per-route chunks are created automatically by the lazy() imports in routes.tsx.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
            return 'react-vendor'
          }
        },
      },
    },
  },

  server: {
    host: true,
    port: 5173,
    // Espelha o proxy do nginx em dev: o browser chama /api e o Vite repassa
    // para o backend local (mesma origem, sem CORS) — igual a produção.
    proxy: {
      '/api': { target: 'http://localhost:8081', changeOrigin: true },
    },
  },

  preview: {
    host: true,
    port: 8080,
    strictPort: true,
  },
})
