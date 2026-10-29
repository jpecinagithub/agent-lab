import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No dev proxy: since the Oct 2026 provider switch the browser talks directly
// to Jon's OpenCode gateway (absolute URL, CORS handled by the gateway).
// The old /api/qwen proxy was removed with the Qwen serverless function.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: { outDir: 'dist', sourcemap: false }
});
