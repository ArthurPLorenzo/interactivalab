import { resolve } from 'path'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Bancada de eletrônica como um único HTML autocontido (CSS e JS embutidos; só as fontes do Google ficam externas).
export default defineConfig({
  root: resolve(__dirname, 'experiments/bancada-eletronica'),
  plugins: [viteSingleFile()],
  build: {
    outDir: resolve(__dirname, 'dist-bancada'),
    emptyOutDir: true,
  },
})
