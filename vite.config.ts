import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    // Relative base: the static build must work from file:// inside Electron
    // (absolute /assets/... URLs break there). Harmless for the web deploy.
    base: './',
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.npm_package_version ?? ''),
    },
    build: { chunkSizeWarningLimit: 3000 },
  };
})