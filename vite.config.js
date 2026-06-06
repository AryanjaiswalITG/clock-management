import { defineConfig } from 'vite'

export default defineConfig({
  base: '/clock-management/',
  server: {
    proxy: {
      // The client calls "/clock-management/api/..." (base + /api). The backend
      // mounts its routes at "/api", so strip the base prefix when proxying.
      '/clock-management/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/clock-management/, ''),
      },
    },
  },
})