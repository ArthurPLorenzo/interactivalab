import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        paintingSound: resolve(__dirname, 'experiments/painting-sound/index.html'),
        zenGarden: resolve(__dirname, 'experiments/zen-garden/index.html'),
        pendulumStrings: resolve(__dirname, 'experiments/pendulum-strings/index.html'),
      },
    },
  },
})
