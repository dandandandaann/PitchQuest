# PitchQuest - Agent Instructions

> **Read `web/docs/STATUS.md` first** if you're picking up this project. It has the full handoff context: what's done (Stages 1–6), the current end-to-end data flow, what's next (Stage 7 — Mode B + session results), and 10 operational gotchas worth knowing before you start.

## Repository Structure

- **Code is in `./web/`** - not at repo root. All commands must run from within `web/`.
- Repo root contains CI workflow (`.github/workflows/deploy.yml`), this file, and `.gitattributes`.

```
PitchQuest/
├── web/                              # All application code
│   ├── src/
│   │   ├── audio/                    # Pitch domain (audio in → performance data out)
│   │   │   ├── hooks/                # useAudioContext, usePitchDetection
│   │   │   │   ├── useAudioContext.ts
│   │   │   │   ├── usePitchDetection.ts
│   │   │   │   ├── useScoreSession.ts    # Stage 6: per-session state machine
│   │   │   │   └── useDevPanelHarnesses.ts # Stage 6: mounts 6 harness results
│   │   │   ├── utils/                # pitch-math, smoothing, format
│   │   │   ├── IncrementalMatcher.ts     # Stage 6: stateful wait-mode matcher
│   │   │   ├── laneConfig.ts             # Stage 6: lane constants
│   │   │   ├── NoteSegmenter.ts          # Stage 1: PitchData[] → DetectedNote[]
│   │   │   ├── TimingEngine.ts           # Stage 2: ms ↔ beats; BeatNote
│   │   │   ├── Matcher.ts                # Stage 4: ExpectedNote[] + BeatNote[] → MatchedNote[]
│   │   │   ├── Scorer.ts                 # Stage 5: MatchedNote[] → ScoreResult
│   │   │   ├── types.ts                  # DetectedNote
│   │   │   └── *.test-harness.ts         # Pure-function test harnesses (41 cases)
│   │   ├── score/                    # Score domain (sheet music in)
│   │   │   ├── types.ts              # ExpectedNote
│   │   │   ├── MusicXmlParser.ts     # Stage 3: XML → ExpectedNote[]
│   │   │   └── MusicXmlParser.test-harness.ts
│   │   ├── components/              # CentsMeter, PitchDisplay, SidebarLayout, NoteHistory
│   │   │   ├── ScorePicker.tsx      # Stage 6: library picker + file upload
│   │   │   └── NoteLane.tsx         # Stage 6: rAF-driven scrolling lane
│   ├── pages/                    # HomePage, TunerPage, PracticePage
│   ├── public/
│   │   ├── pitch-processor.js       # AudioWorklet
│   │   └── scores/                  # Stage 6: MusicXML library (4 bundled, 18 placeholders)
│   └── App.tsx                   # HashRouter: /, /tuner, /practice
├── .github/workflows/deploy.yml
└── .gitattributes                    # `* text=auto eol=lf`
```

## Key Commands (run from `./web/`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then build (`vite build`) |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

### Running the test harnesses at runtime

There's no automated test suite, but each pure module has a `*.test-harness.ts` next to it. Open `PracticePage` in the browser and click "Show dev panel" to see all 41 cases run live, OR run any single one from the command line:

```bash
cd web
npx tsx -e "import { runSegmenterHarness } from './src/audio/NoteSegmenter.test-harness'; console.log(runSegmenterHarness());"
# Same pattern for: TimingEngine, MusicXmlParser, Matcher, Scorer, IncrementalMatcher
```

## Build Pipeline

1. `tsc -b` runs first (project references: `tsconfig.app.json` + `tsconfig.node.json`)
2. `vite build` outputs to `web/dist/`
3. CI deploys `web/dist/` to GitHub Pages

## Important quirks

- **HashRouter** - App uses `HashRouter` (not BrowserRouter) because it deploys to a subdirectory (`/PitchQuest/`). All routes are prefixed with `#`.
- **Vite base path** - Configured as `/PitchQuest/` in `vite.config.ts` for GitHub Pages compatibility.
- **AudioWorklet** - `pitch-processor.js` lives in `public/` and is loaded via `import.meta.env.BASE_URL`. Do not move it to `src/`.
- **No automated test suite** - Use the `*.test-harness.ts` files (see above).
- **`git add -A` is FORBIDDEN** - The working tree may contain untracked files (`.tmp/`, scratch files). Always use selective `git add <specific files>`. See `web/docs/STATUS.md` "Operational gotchas" for the full list.
- **Pre-existing lint errors** in `web/src/audio/hooks/useAudioContext.ts` (refs accessed during render). Do NOT fix as part of unrelated work; they predate Stages 1+.

## Tech Stack

- React 19 + TypeScript 5.9 (strict mode)
- Vite 8 + `@vitejs/plugin-react`
- MUI 7 (components) + Emotion (styling)
- `pitchy` library for pitch detection (YIN algorithm, 2048 buffer)
- React Router DOM 7
- ESLint flat config + `typescript-eslint`

## Architecture Notes

### Audio + scoring data flow (Stages 1–6)

```
MusicXML ──→ ExpectedNote[]         (Stage 3 parser)
                                    ↓
Mic ──→ usePitchDetection           (Stage 1)
        ↓ PitchData[]
   NoteSegmenter                     (Stage 1)
        ↓ DetectedNote[]
   TimingEngine.annotateNotes        (Stage 2)  ← bpm converts ms → beats
        ↓ BeatNote[]
   IncrementalMatcher.push           (Stage 6)  ← stateful cursor, wait-mode
        ↓ MatchedNote[]
   Scorer.scoreMatch (per-note via session.consume)
        ↓ ScoredNote { tier }
   <NoteLane> rAF-driven transform (Mode A: wait-mode)
   Completion overlay (scoreMatches on liveScored)
```

### Core tunings

- **Audio flow**: Mic → `AudioWorkletNode` → `pitchy.PitchDetector` → frequency → `frequencyToNote()` → UI
- **Smoothing**: MedianFilter (5) on frequency, MovingAverage (3) on cents
- **Clarity threshold**: 0.9 (pitchy clarity value)
- **Frequency range**: 80–1500 Hz
- **Beat-zero anchor**: `audioStartPerfNow` captured on Start Mic; subtracted from each frame's timestamp before segmentation. Without this, detected `startBeat` is arbitrary.
- **Lane config**: `PX_PER_BEAT: 120`, `GRACE_BEATS: 2` (auto-advance grace), `NOW_LINE_OFFSET_PX: 80` (see `laneConfig.ts`)
- **Score defaults**: pitch ±10 cents = perfect, ±30 cents = ok; time ±0.05 beats = perfect, ±0.2 beats = ok. Configurable in `Scorer.ts`.
- **Matcher window**: `[startBeat − 0.5, startBeat + durationBeats + 0.5]` beats. Greedy + used-detection Set to prevent double-matching.
- **Pitch class match**: Scorer treats `detected.midi !== expected.midi` as automatic `'miss'` (catches "right time, wrong note").
- **Extras policy**: Detected notes that don't match any expected are silently ignored (matcher) and don't affect scoring.

## Roadmap / Planned Work

See `web/docs/roadmap.md` for the original vision. **Stages 1–6 are complete** (note segmentation → timing → MusicXML → matching → scoring → wait-mode lane). **Stage 7 (Mode B continuous scrolling + session results screen) is next** — see `web/docs/STATUS.md` for the handoff and the planned next steps.
