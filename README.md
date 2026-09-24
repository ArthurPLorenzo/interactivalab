# InteractivaLab

Experimentos de física que rodam no navegador, para curiosos e estudantes do ensino médio. Cada experimento começa com uma pergunta, deixa testar à vontade e mostra os números para conferir com as fórmulas. O som aparece quando ajuda a entender um conceito, como a nota de uma corda ou o tique de um pêndulo.

## Experimentos

| Área | Experimento | O que se aprende |
|---|---|---|
| Oscilações e ondas | [Pêndulo & Cordas](experiments/pendulum-strings/) | Período do pêndulo (T = 2π√(L/g)) e frequência de uma corda (lei de Mersenne), com metrônomo, afinador e gravidade de outros planetas |
| Eletricidade | [Bancada de eletrônica](experiments/bancada-eletronica/) | Lei de Ohm, LED, capacitor e transistor, com simulador de circuitos e multímetro |
| Fora do roteiro | [Jardim Zen](experiments/zen-garden/) | Nada: é só para mexer |

Os próximos experimentos planejados aparecem como "Em breve" na página inicial.

## Stack

- **Vite**: build e servidor de desenvolvimento (várias páginas)
- **Tone.js**: som
- **Canvas 2D** e SVG: simulações e desenhos
- **Vitest**: testes da física
- JavaScript puro, sem framework

## Rodar localmente

```bash
bun install
bun run dev
```

Abre `http://localhost:5173`.

## Build e testes

```bash
bun run build          # gera dist/
bun run preview        # serve o build
bun run test           # testes da física
bun run build:bancada  # a bancada como um único HTML autocontido, em dist-bancada/
```

## Estrutura

```
interactivalab/
├── index.html                 # Página inicial
├── src/
│   ├── lab.css                # Base visual comum (cores, fontes, controles)
│   ├── style.css              # Estilo da página inicial
│   └── main.js                # Registrador da mola e miniaturas animadas
└── experiments/
    ├── pendulum-strings/      # physics.js (física pura, testada) + main.js (interface)
    ├── bancada-eletronica/    # src/sim (simulador, testado) + src/sandbox + src/tabs
    └── zen-garden/
```

## Adicionar um experimento

1. Criar a pasta `experiments/<nome>/` com `index.html`, `style.css` (importando `../../src/lab.css`) e `main.js`
2. Deixar a física num módulo sem DOM e testá-la em `experiments/<nome>/tests/`
3. Registrar a página em `vite.config.js` (campo `input`)
4. Adicionar o experimento na área certa do `index.html` e, se quiser, uma miniatura em `src/main.js` (`data-preview`)
