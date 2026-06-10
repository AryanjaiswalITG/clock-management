import { defineConfig } from 'vite'

export default defineConfig({
  // Vercel serves the app at the domain root, so assets live at "/...".
  base: '/',
  server: {
    proxy: {
      // Dev only: proxy the API to the local Express server on :4000.
      // (The deployed build uses the in-browser mock — see src/mockApi.js.)
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
