import { resolve } from 'path'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Bancada de eletrônica como um único HTML autocontido (CSS e JS embutidos; só as fontes do Google ficam externas).
export default defineConfig({
  root: resolve(__dirname, 'experiments/bancada-eletronica'),
  plugins: [
    viteSingleFile(),
    // fora do lab não há para onde voltar: tira a barra "InteractivaLab"
    { name: 'sem-barra-do-lab', transformIndexHtml: html => html.replace(/<header class="lab-bar">[\s\S]*?<\/header>\n?/, '').replace(' — InteractivaLab</title>', '</title>') },
  ],
  build: {
    outDir: resolve(__dirname, 'dist-bancada'),
    emptyOutDir: true,
  },
})
