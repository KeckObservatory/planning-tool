import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'

const main = resolve(__dirname, './index.html')
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 1000,
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      input: {
        main: main,
      },
    },
  },
})
