import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Use relative paths for assets - works with both subdomain and directory-style reverse proxy
  base: './',
  
  build: {
    // Ensure assets use relative paths
    assetsDir: 'assets',
    
    // Generate sourcemaps for easier debugging
    sourcemap: false,
    
    // Optimize chunk size
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'ui-vendor': ['lucide-react']
        }
      }
    }
  },
  
  server: {
    port: 5173,
    strictPort: false,
    // Proxy API requests during development
    proxy: {
      '/api': {
        target: 'http://localhost:3500',
        changeOrigin: true
      }
    }
  }
})