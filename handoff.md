# Handoff — InteractivaLab

**Data:** 2026-05-25  
**Sessão:** criação do projeto + dois experimentos + polish

---

## Estado atual

Projeto funcional, build limpo (`npm run build` → zero erros, 3 entry points).  
Dev server: `npm run dev` → `http://localhost:5173`.

### Estrutura

```
interactivalab/
├── index.html                         # Menu principal (grid de cards)
├── vite.config.js                     # MPA: main + paintingSound + zenGarden
├── package.json                       # Vite 5 + Tone.js 14
├── README.md
├── src/
│   ├── style.css                      # Tema escuro global, grid responsivo
│   └── main.js                        # Animação de cards (brushstrokes + zen sweep)
└── experiments/
    ├── painting-sound/
    │   ├── index.html
    │   ├── style.css
    │   └── main.js                    # Canvas pintura → síntese musical
    └── zen-garden/
        ├── index.html
        ├── style.css
        └── main.js                    # Jardim zen interativo
```

---

## Experimentos implementados

### 1. Painting → Sound (`/experiments/painting-sound/`)

- Canvas branco, brush aquarela (círculo + droplets satélites, `globalAlpha 0.82`, `shadowBlur`)
- Paleta de 8 cores + color picker + slider de tamanho
- **Extração:** strips de 8px, média HSB → escala pentatônica (C D E G A), oitavas 3–5
- **Mapeamento:** hue→nota, brilho→oitava, saturação→velocity
- **Durações** aleatórias ponderadas: 15% mínima / 35% semínima / 35% colcheia / 15% semicolcheia
- **Síntese:** `PolySynth(triangle8)` + `Reverb` (Tone.js), BPM 90
- **Cursor sweep** durante reprodução: barra branca varre canvas sincronizada com `Tone.Transport`
- Botão ■ Parar a qualquer momento

### 2. Jardim Zen (`/experiments/zen-garden/`)

- **2 canvas offscreen:** `sandCanvas` (textura por ruído de pixel) + `grooveCanvas` (sulcos persistentes)
- **Render loop:** `sand → grooves → pedras → cursor rake`
- **Desvio das pedras:** `deflect()` interpola tines em steps de 2px e empurra para fora do raio → arcos orgânicos automáticos
- **Pedras:** 4–6, forma gerada proceduralmente (7–11 pontos com jitter de ângulo/distância, `quadraticCurveTo`)
- **Inércia do rake:** `lerpAngle(prev, target, 0.14)` — rotação com peso, sem snap frenético; ângulo suavizado passado também para `drawGrooveSegment`
- **Som:** ruído pink → bandpass 500 Hz → `Gain` rampa suave ao rastelar / parar (Tone.js)
- **Modo silêncio:** ESC ou botão, esconde topbar + toolbar
- **Resetar:** novo grain de areia, novas pedras, grooveCanvas limpo
- **Resize:** grooves preservados via `drawImage` scaled

---

## Decisões técnicas

| Decisão | Motivo |
|---|---|
| `target: 'esnext'` no Vite build | Top-level `await` no módulo Tone.js |
| `lerpAngle` com fator `0.14` | Inércia "pesada" sem travar; ajustável (↓ mais lento, ↑ mais ágil) |
| Grooves em canvas offscreen | Persistência sem re-render quadrático |
| Animações de card separadas por `data-preview` | Painting → brushstrokes coloridos; Zen → varredura de rake suave |
| `PolySynth(triangle8)` + Reverb | Piano-like sem precisar carregar samples externos |

---

## O que falta / ideias para próxima sessão

- [ ] Terceiro experimento (slot ainda mostra "Em breve")
- [ ] Sulcos do zen: quando pedra é **arrastada sobre sulco existente**, sulco deveria se refazer em arco — atualmente só deflecte durante rakeamento ativo
- [ ] Painting → Sound: botão de download do canvas como PNG
- [ ] Painting → Sound: modo "loop" — toca a composição em ciclo
- [ ] Menu: transição de página suave (View Transitions API)
- [ ] PWA básico (manifest + service worker) para funcionar offline

---

## Skills recomendadas para próxima sessão

- `caveman:cavecrew-builder` — edições cirúrgicas em arquivos existentes (ex: adicionar feature a zen-garden/main.js)
- `caveman:cavecrew-investigator` — localizar onde algo está definido antes de editar
- `run` — para verificar o app rodando no browser após mudanças

---

## Comandos úteis

```bash
npm run dev      # dev server → localhost:5173
npm run build    # build prod → dist/
npm run preview  # serve dist/
```
