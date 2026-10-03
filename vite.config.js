import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const upstream = (env.QWEN_BASE_URL || 'https://ws-vtekyiqw1t5v66sm.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
  const upstreamUrl = new URL(upstream);
  const upstreamPath = upstreamUrl.pathname.replace(/\/+$/, '');
  const qwenProxy = {
    '/api/qwen': {
      target: upstreamUrl.origin,
      changeOrigin: true,
      secure: true,
      ...(env.QWEN_API_KEY ? { headers: { Authorization: `Bearer ${env.QWEN_API_KEY}` } } : {}),
      rewrite: () => `${upstreamPath}/chat/completions`
    }
  };

  return {
    plugins: [react()],
    server: { port: 5173, proxy: qwenProxy },
    preview: { port: 4173, proxy: qwenProxy },
    build: { outDir: 'dist', sourcemap: false }
  };
});
