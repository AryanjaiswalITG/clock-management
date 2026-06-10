import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves this repo under /clock-management/.
  base: '/clock-management/',
  server: {
    proxy: {
      // Dev only: when running the real Express server on :4000, proxy the API.
      // (The GitHub Pages build uses an in-browser mock instead — see src/mockApi.js.)
      '/clock-management/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/clock-management/, ''),
      },
    },
  },
})
