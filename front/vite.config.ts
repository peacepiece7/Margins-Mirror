import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

const backendTarget = process.env.MARGINS_BACKEND_URL || 'http://localhost:8080';
const frontendPort = Number(process.env.MARGINS_FRONTEND_PORT || '5173');

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
  server: {
    port: frontendPort,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
