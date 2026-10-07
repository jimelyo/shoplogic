import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base: the static build must work from file:// inside Electron
  // (absolute /assets/... URLs break there). Harmless for the web deploy.
  base: './',
  build: { chunkSizeWarningLimit: 3000 },
})