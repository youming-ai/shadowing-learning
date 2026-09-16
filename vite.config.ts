import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
      // 客户端与 Worker 共用的运行时中立代码（Worker 侧只能用相对路径，wrangler 不认别名）
      '~shared': resolve(__dirname, './shared'),
    },
  },
  plugins: [react(), tailwindcss()],
})
