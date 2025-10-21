import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 開發服務器配置
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://ai-website-hip8178z2-chena-fans-projects.vercel.app',
        changeOrigin: true,
      }
    }
  }
})
