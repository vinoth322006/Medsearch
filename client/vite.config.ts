import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', '.ngrok-free.dev', '.ngrok-free.app'],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', '.ngrok-free.dev', '.ngrok-free.app'],
  },
  build: { target: 'es2020', sourcemap: true },
});
