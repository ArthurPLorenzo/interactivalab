# InteractivaLab

Laboratório de experimentos interativos de arte e música no browser.

## Experimentos

| Experimento | Descrição |
|---|---|
| 🎨 [Painting → Sound](experiments/painting-sound/) | Pinte no canvas e ouça a composição gerada |

## Stack

- **Vite** — build e dev server
- **Tone.js** — síntese e sequenciamento de áudio
- **Canvas 2D** — pintura e visualização
- Vanilla JS, sem frameworks

## Rodar localmente

```bash
bun install
bun run dev
```

Abre `http://localhost:5173`.

## Build

```bash
bun run build   # gera dist/
bun run preview # serve o build
```

## Estrutura

```
interactivalab/
├── index.html                    # Menu principal
├── src/
│   ├── style.css                 # Estilos globais
│   └── main.js                   # Animação dos cards
└── experiments/
    └── painting-sound/           # Primeiro experimento
        ├── index.html
        ├── style.css
        └── main.js
```

## Adicionar experimento

1. Criar pasta `experiments/<nome>/`
2. Adicionar `index.html`, `style.css`, `main.js`
3. Registrar entrada no `vite.config.js` (campo `input`)
4. Adicionar card no `index.html` do menu

## Como funciona: Painting → Sound

1. Usuário pinta livremente com brush aquarela
2. Ao clicar **Tocar**, canvas é varrido em strips de 8px (esq → dir)
3. Cada strip com tinta → média de Hue/Saturação/Brilho (HSB)
4. Mapeamentos:
   - **Hue** → nota pentatônica (C D E G A, oitavas 3–5)
   - **Brilho** → oitava (escuro = grave, claro = agudo)
   - **Saturação** → velocity (dessaturado = piano, saturado = forte)
5. Durações atribuídas aleatoriamente (mais semínimas e colcheias)
6. BPM fixo em 90, sintetizador PolySynth com reverb
7. Cursor vertical varre o canvas sincronizado com a reprodução
