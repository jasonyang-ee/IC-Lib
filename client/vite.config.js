/* eslint-disable no-undef */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	
	// Use relative paths for assets - works with both subdomain and directory-style reverse proxy
	// If BASE_URL env is set (e.g., BASE_URL=/mypath), use it for both assets and routing
	// Otherwise default to './' for relative paths
	base: process.env.BASE_URL && process.env.BASE_URL !== '/' ? process.env.BASE_URL : './',
	
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