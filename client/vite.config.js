/* eslint-disable no-undef */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Read version from root package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'))

const normalizeSubdirectoryPath = (value) => {
	if (!value) {
		return null
	}

	const trimmedValue = value.trim()
	if (!trimmedValue || trimmedValue === '/') {
		return null
	}

	const withLeadingSlash = trimmedValue.startsWith('/') ? trimmedValue : `/${trimmedValue}`
	return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

const configuredSubdirectoryPath = normalizeSubdirectoryPath(
	process.env.CONFIG_SUBDIRECTORY_PATH || process.env.BASE_URL,
)

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	
	define: {
		__APP_VERSION__: JSON.stringify(packageJson.version),
	},
	
	// Use relative paths by default so the bundle still works behind a path-stripping proxy.
	// When deploying under a fixed subdirectory, CONFIG_SUBDIRECTORY_PATH sets the Vite base.
	base: configuredSubdirectoryPath || './',
	
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