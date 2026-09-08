import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  envDir: '../..',
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT || 5174),
    strictPort: process.env.DEV_AUTO_PORT === 'false',
    proxy: {
      '/api': process.env.DEV_API_TARGET || 'http://localhost:3001',
      '/health': process.env.DEV_API_TARGET || 'http://localhost:3001',
    },
  },
});
