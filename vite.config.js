import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the Node backend so the frontend can use /api/* paths.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
