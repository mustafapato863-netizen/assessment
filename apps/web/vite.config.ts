import { defineConfig } from 'vitest/config';
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
  // The API client throws at import time when this is missing. Unit tests that
  // import the app (pilot flags) never call the network; point them at a dummy host.
  test: {
    env: {
      VITE_API_URL: 'http://127.0.0.1:8080/api/v1/assessflow',
    },
  },
});
