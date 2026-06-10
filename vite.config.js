import { defineConfig } from 'vite'

export default defineConfig({
  // Served from the domain root: the Express backend hosts the built frontend
  // and the API on a single origin (see server/index.js).
  base: '/',
  server: {
    proxy: {
      // In dev the API runs separately on :4000; proxy /api there.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
