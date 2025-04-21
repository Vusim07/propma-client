import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
	server: {
		host: '0.0.0.0',
		port: 5173,
		strictPort: true,
		hmr: {
			clientPort: 443,
		},
		cors: true,
		allowedHosts: ['renewed-cockatoo-liked.ngrok-free.app', 'localhost'],
	},
	plugins: [react()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});
