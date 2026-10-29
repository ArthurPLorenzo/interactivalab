import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  // caminhos relativos: o site funciona na raiz e em subpasta (GitHub Pages em /interactivalab/)
  base: './',
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        waveGarden: resolve(__dirname, 'experiments/wave-garden/index.html'),
        pendulumStrings: resolve(__dirname, 'experiments/pendulum-strings/index.html'),
        bancadaEletronica: resolve(__dirname, 'experiments/bancada-eletronica/index.html'),
      },
    },
  },
})
