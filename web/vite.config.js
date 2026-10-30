import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_PROXY || 'http://localhost:4000',
      '/ws': { target: process.env.VITE_AGENT_PROXY || 'ws://localhost:8000', ws: true },
    },
  },
});
