import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))

// A extensao nao usa o dev server do Vite (o Chrome carrega os arquivos de dist/).
// Por isso tudo passa pelo `build`, com nomes de saida estaveis para o service worker.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path('./src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'chrome120',
    rollupOptions: {
      input: {
        popup: path('./popup.html'),
        options: path('./options.html'),
        background: path('./src/background/index.ts'),
      },
      output: {
        // O manifest referencia background.js por nome fixo.
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? '[name].js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
