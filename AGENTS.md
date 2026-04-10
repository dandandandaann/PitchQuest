# PitchQuest - Agent Instructions

## Repository Structure

- **Code is in `./web/`** - not at repo root. All commands must run from within `web/`.
- Repo root contains only CI workflow (`.github/workflows/deploy.yml`) and this file.

```
PitchQuest/
├── web/                    # All application code
│   ├── src/
│   │   ├── audio/          # Audio processing (hooks, utils)
│   │   ├── components/     # React components
│   │   ├── pages/          # Route pages (HomePage, TunerPage)
│   │   └── App.tsx         # Router setup (HashRouter)
│   ├── public/             # Static assets, pitch-processor.js AudioWorklet
│   ├── dist/               # Build output (auto-generated)
│   └── package.json
└── .github/workflows/deploy.yml
```

## Key Commands (run from `./web/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then build (`vite build`) |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

## Build Pipeline

1. `tsc -b` runs first (project references: `tsconfig.app.json` + `tsconfig.node.json`)
2. `vite build` outputs to `web/dist/`
3. CI deploys `web/dist/` to GitHub Pages

## Important quirks

- **HashRouter** - App uses `HashRouter` (not BrowserRouter) because it deploys to a subdirectory (`/PitchQuest/`). All routes are prefixed with `#`.
- **Vite base path** - Configured as `/PitchQuest/` in `vite.config.ts` for GitHub Pages compatibility.
- **AudioWorklet** - `pitch-processor.js` lives in `public/` and is loaded via `import.meta.env.BASE_URL`. Do not move it to `src/`.
- **No test suite** - Project has no tests configured.

## Tech Stack

- React 19 + TypeScript 5.9 (strict mode)
- Vite 8 + `@vitejs/plugin-react`
- MUI 7 (components) + Emotion (styling)
- `pitchy` library for pitch detection (YIN algorithm, 2048 buffer)
- React Router DOM 7
- ESLint flat config + `typescript-eslint`

## Architecture Notes

- **Audio flow**: Mic → `AudioWorkletNode` → `pitchy.PitchDetector` → frequency → `frequencyToNote()` → UI
- **Smoothing**: MedianFilter (5) on frequency, MovingAverage (3) on cents
- **Clarity threshold**: 0.9 (pitchy clarity value)
- **Frequency range**: 80–1500 Hz

## Roadmap / Planned Work

See `web/docs/roadmap.md` for the planned note segmentation, timing engine, sheet music ingestion, and scoring system. The current app is a basic tuner only.
