import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // La API solo permite CORS desde http://localhost:5173 exacto. Con strictPort, si el
    // puerto está ocupado Vite falla en vez de saltar a 5174 (donde CORS bloquearía todo).
    port: 5173,
    strictPort: true,
  },
})
