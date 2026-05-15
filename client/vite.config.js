import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/recruiter-api': {
        target: 'http://localhost:5000',
        rewrite: (path) => path.replace(/^\/recruiter-api/, ''),
      },
    }
  }
})
