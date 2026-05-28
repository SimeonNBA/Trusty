import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds the swap SPA into ../swap so GitHub Pages serves it at
// https://trustyai.tech/swap/. base must match that path so the
// emitted asset URLs resolve correctly under /swap/.
export default defineConfig({
  base: '/swap/',
  plugins: [react()],
  build: {
    outDir: '../swap',
    emptyOutDir: true,
  },
})
