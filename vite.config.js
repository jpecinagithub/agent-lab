import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const qwenProxy = {
  '/api/qwen': {
    target: 'https://ws-vtekyiqw1t5v66sm.ap-southeast-1.maas.aliyuncs.com',
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/api\/qwen/, '/compatible-mode/v1')
  }
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: qwenProxy },
  preview: { port: 4173, proxy: qwenProxy },
  build: { outDir: 'dist', sourcemap: false }
});
