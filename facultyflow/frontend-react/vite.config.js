import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../frontend',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          three: ['three'],
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/courses': 'http://localhost:8000',
      '/attendance': 'http://localhost:8000',
      '/marks': 'http://localhost:8000',
      '/advisories': 'http://localhost:8000',
      '/reports': 'http://localhost:8000',
      '/student': 'http://localhost:8000',
      '/settings': 'http://localhost:8000',
      '/dashboard': 'http://localhost:8000',
      '/users': 'http://localhost:8000',
      '/templates': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    }
  }
})
