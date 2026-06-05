import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['.vercel.run'],
  },
  preview: {
    host: true,
    allowedHosts: ['.vercel.run'],
  },
})
