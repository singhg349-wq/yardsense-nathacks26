import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Fixed port: the backend's CORS settings allow http://localhost:5173.
  server: { port: 5173, strictPort: true },
})
