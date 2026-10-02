import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Only ship word frequencies, not Jieba's unused keyword/HMM dictionaries.
    alias: {
      'jieba-zh-cn': fileURLToPath(new URL('./node_modules/jieba-zh-cn/lib/jieba.dict.js', import.meta.url))
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
