import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /api requests to backend during dev so no CORS issues
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

});
