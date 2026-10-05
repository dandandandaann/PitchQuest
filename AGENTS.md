# PitchQuest - Agent Instructions

> **Read `web/docs/STATUS.md` first** if you're picking up this project. It has the full handoff context: what's done (Stages 1–6, plus the post-roadmap trumpet/trombone drills and sound layer), the current end-to-end data flow, what's next (Stage 7 — Mode B + session results), and 11 operational gotchas worth knowing before you start.

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
│   │   │   │   └── useDevPanelHarnesses.ts # Stage 6: mounts 9 of the 11 harness results
│   │   │   ├── utils/                # pitch-math, smoothing, format
│   │   │   ├── IncrementalMatcher.ts     # Stage 6: stateful wait-mode matcher
│   │   │   ├── laneConfig.ts             # Stage 6: lane constants
│   │   │   ├── NoteSegmenter.ts          # Stage 1: PitchData[] → DetectedNote[]
│   │   │   ├── TimingEngine.ts           # Stage 2: ms ↔ beats; BeatNote
│   │   │   ├── Matcher.ts                # Stage 4: ExpectedNote[] + BeatNote[] → MatchedNote[]
│   │   │   ├── Scorer.ts                 # Stage 5: MatchedNote[] → ScoreResult
│   │   │   ├── types.ts                  # DetectedNote
│   │   │   └── *.test-harness.ts         # Pure-function test harnesses (see below: 11 files, 128 cases)
│   │   ├── score/                    # Score domain (sheet music in)
│   │   │   ├── types.ts              # ExpectedNote
│   │   │   ├── MusicXmlParser.ts     # Stage 3: XML → ExpectedNote[] (browser-only: DOMParser)
│   │   │   └── MusicXmlParser.test-harness.ts  # ⚠ cannot run under Node/tsx — dev panel only
│   │   ├── trumpet/                  # Trumpet drill domain: fingerings.ts, valvePress.ts (+ harnesses)
│   │   ├── trombone/                 # Trombone drill domain: positions.ts (+ harness)
│   │   ├── sound/                    # Web Audio sample playback: SamplePlayer, useInstrumentSound,
│   │   │                             #   sampleSets, selectSample, noteMath, envelope (+ harness)
│   │   ├── components/              # CentsMeter, PitchDisplay, SidebarLayout, NoteHistory,
│   │   │   ├── ScorePicker.tsx      #   LanguageToggle, DevPanel, DrillSubmitButton,
│   │   │   ├── SlideControl.tsx     #   SlideControl (+ harness, returns a string),
│   │   │   ├── TrumpetDisplay.tsx   #   TrumpetDisplay (VexFlow staff + valves), TromboneDisplay
│   │   │   └── NoteLane.tsx         # Stage 6: rAF-driven scrolling lane
│   │   ├── i18n/                     # DIY i18n: I18nContext, keys.ts, dictionaries/{en,pt}
│   │   ├── styles/                   # tokens.css, clay.css, pages.css (drill + mobile overrides)
│   │   ├── theme/muiTheme.ts         # MUI theme
│   │   ├── utils/haptics.ts          # Vibration API (Android-only, silent no-op on iOS)
│   │   ├── pages/                    # HomePage, TunerPage, PracticePage, TrumpetDrillPage, TromboneDrillPage
│   │   └── App.tsx                   # HashRouter: /, /practice, /tuner, /trumpet-drill, /trombone-drill (drills lazy-loaded)
│   ├── scripts/                      # Asset generators: make_sound_samples.py, make_trombone_assets.py, measure_pitch.py
│   ├── public/
│   │   ├── pitch-processor.js       # AudioWorklet
│   │   ├── scores/                  # Stage 6: MusicXML library (manifest with 22 entries, 4 bundled files)
│   │   ├── sounds/                  # 14 MP3 brass samples (trumpet ×8, trombone ×6) + CREDITS.md
│   │   ├── trumpet/                 # 8 valve press-state PNGs
│   │   └── trombone/                # 7 slide-position WebPs
│   └── docs/STATUS.md               # Handoff doc
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

There's no automated test suite, but each pure module has a `*.test-harness.ts` next to it — **11 files, 128 cases total**: NoteSegmenter 6, TimingEngine 8, MusicXmlParser 7, Matcher 7, Scorer 6, IncrementalMatcher 8, valvePress 8, fingerings 15, positions 12, SlideControl 32, sound 19.

Open `PracticePage` in the browser and click "Show dev panel" to see the 9 mounted harnesses run live (the dev panel is mounted ONLY on PracticePage — deliberately not on the drill pages). OR run most of them from the command line:

```bash
cd web
npx tsx -e "import { runSegmenterHarness } from './src/audio/NoteSegmenter.test-harness'; console.log(runSegmenterHarness());"
# Same pattern for: TimingEngine, Matcher, Scorer, IncrementalMatcher, valvePress, fingerings, positions, sound
# ⚠ MusicXmlParser's harness is BROWSER-ONLY: under Node/tsx it reports 0/7 with
#   "DOMParser is not defined" (the parser needs DOMParser). It only passes in the dev panel.
# ⚠ SlideControl's harness returns a formatted string ("SlideControl harness: 32/32 pass"),
#   not a case array like the others.
```

## Build Pipeline

1. `tsc -b` runs first (project references: `tsconfig.app.json` + `tsconfig.node.json`)
2. `vite build` outputs to `web/dist/`
3. CI deploys `web/dist/` to GitHub Pages

## Important quirks

- **HashRouter** - App uses `HashRouter` (not BrowserRouter) because it deploys to a subdirectory (`/PitchQuest/`). All routes are prefixed with `#`.
- **Vite base path** - Configured as `/PitchQuest/` in `vite.config.ts` for GitHub Pages compatibility.
- **AudioWorklet** - `pitch-processor.js` lives in `public/` and is loaded via `import.meta.env.BASE_URL`. Do not move it to `src/`.
- **No automated test suite** - Use the `*.test-harness.ts` files (see above). Note the MusicXmlParser harness is browser-only and SlideControl's returns a string.
- **Drills + sound layer (post-roadmap)** - The trumpet/trombone drills and `src/sound/` were built AFTER the original roadmap; they are not roadmap stages. The sound layer plays the answered note on a correct drill submit; the live `AudioContext` must stay created lazily inside `SamplePlayer.play()` (autoplay unlock) — don't hoist it.
- **Mobile drill layout (≤640px)** - Drill overrides live in the single `@media (max-width: 640px)` block in `src/styles/pages.css`: legend hidden, staff well 220px → 140px CSS-only (VexFlow SVG scales via its `viewBox="0 0 340 220"` — don't change the renderer), one-row valves and detents. Desktop is unchanged.
- **`git add -A` is FORBIDDEN** - The working tree may contain untracked files (`.tmp/`, scratch files). Always use selective `git add <specific files>`. See `web/docs/STATUS.md` "Operational gotchas" for the full list.
- **Brazilian Portuguese (pt-BR)** - The app's `pt` locale is Brazilian Portuguese, never European Portuguese. All PT copy follows the pt-BR glossary in `web/src/i18n/dictionaries/pt.ts`. Keep this in mind for any future translation work.
- **Pre-existing lint errors** in `web/src/audio/hooks/useAudioContext.ts` (refs accessed during render). **Resolved as of 2026-10-05** — `npm run lint` is fully clean; keep it that way.

## Tech Stack

- React 19 + TypeScript 5.9 (strict mode)
- Vite 8 + `@vitejs/plugin-react`
- MUI 7 (components) + Emotion (styling)
- `pitchy` library for pitch detection (YIN algorithm, 2048 buffer)
- React Router DOM 7
- `vexflow` 5 — renders the drill staves (`TrumpetDisplay`)
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

### Drills + sound (post-roadmap, separate from the scoring flow)

- **Trumpet drill** (`/trumpet-drill`): random note on a VexFlow staff; hold valves with J/K/L (or on-screen multi-touch pistons), then Space/`DrillSubmitButton` to check & advance. Correct fingering only.
- **Trombone drill** (`/trombone-drill`): slide-position drill; `SlideControl` = drag on the trombone image / 7 tap detents / arrow keys.
- **Shared**: accidental filter (all / ♯ / ♭ / ♮), toggles (hide note names, hide status, mute), metrics (Time, Notes/min, Correct, Wrong), haptics (Vibration API, Android-only), and playback of the answered note on a correct submit.
- **Sound**: `src/sound/` — 14 MP3s in `public/sounds/` (trumpet ×8, MIDI 52–84, `transposeSemitones: -2`; trombone ×6, MIDI 40–65, transpose 0), rendered by `web/scripts/make_sound_samples.py` (MuseScore 4 + MS Basic.sf3, MIT — see `public/sounds/CREDITS.md`). Envelope 5 ms attack / 445 ms hold / 250 ms release. Sample paths are relative; `SamplePlayer` prepends the base URL.

## Roadmap / Planned Work

See `web/docs/roadmap.md` for the original vision (do not edit it — it's the historical plan). **Stages 1–6 are complete** (note segmentation → timing → MusicXML → matching → scoring → wait-mode lane). **Stage 7 (Mode B continuous scrolling + session results screen) is still the next planned work** — see `web/docs/STATUS.md` for the handoff and the planned next steps. The trumpet/trombone drills and the sound layer were built after Stage 6 and are NOT part of the roadmap's original stages.
