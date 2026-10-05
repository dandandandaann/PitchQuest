# PitchQuest — Status & Handoff

**Last updated:** 2026-10-05 — doc refresh after the post-Stage 6 drill/sound era (40 commits `35d08de` → `45b220a`: trumpet drill, trombone drill, sound layer, i18n to 248 keys, mobile passes, bug fixes). Stages 1–6 unchanged; **Stage 7 still pending**.
**Audience:** the next manager agent (or human) picking up this project.

---

## What is this project?

PitchQuest is a React 19 + TypeScript + Vite app at `/home/daniel/repo/pitch-quest/web/`. The original app was a basic microphone pitch tuner (Tuner page); the work documented here evolved it into a Guitar-Hero-style practice tool that takes a MusicXML score, segments the user's live mic input, matches expected vs detected notes, scores the result, and animates it in a scrolling lane. After Stage 6 the app grew two instrument **finger drills** (trumpet valves, trombone slide) with a Web Audio **sound layer** — see "Post-Stage 6: drills + sound" below.

## Where things live

```
web/src/
├── audio/                   # Pitch domain — audio in, performance data out
│   ├── hooks/
│   │   ├── useAudioContext.ts        # AudioContext lifecycle + audioStartPerfNow (beat-zero anchor)
│   │   ├── usePitchDetection.ts      # Mic → worklet → pitchy → PitchData
│   │   ├── useScoreSession.ts       # Stage 6: per-session state machine (IncrementalMatcher, rAF ticker, liveScored[])
│   │   └── useDevPanelHarnesses.ts   # Stage 6: mounts 9 of the 11 harnesses for the dev panel
│   ├── IncrementalMatcher.ts         # Stage 6: stateful wait-mode matcher (cursor over ExpectedNote[])
│   ├── laneConfig.ts                 # Stage 6: pure lane constants (PX_PER_BEAT, GRACE_BEATS, etc.)
│   ├── NoteSegmenter.ts              # Stage 1: PitchData[] → DetectedNote[]
│   ├── TimingEngine.ts               # Stage 2: ms ↔ beats; BeatNote annotation
│   ├── Matcher.ts                    # Stage 4: ExpectedNote[] + BeatNote[] → MatchedNote[]
│   ├── Scorer.ts                     # Stage 5: MatchedNote[] → ScoreResult { perNote, summary }
│   ├── types.ts                      # DetectedNote
│   ├── utils/
│   │   ├── pitch-math.ts             # frequencyToNote (flats-style: "C4", "Db5")
│   │   ├── smoothing.ts              # MedianFilter, MovingAverage
│   │   └── format.ts                 # formatCents, formatBeats
│   └── *.test-harness.ts             # 5 pure-function harnesses (see "Test harnesses" below)
├── score/                   # Score domain — sheet music in
│   ├── types.ts                      # ExpectedNote
│   ├── MusicXmlParser.ts             # XML string → ExpectedNote[] (browser-only: DOMParser)
│   └── MusicXmlParser.test-harness.ts  # ⚠ cannot run under Node/tsx (DOMParser) — dev panel only
├── trumpet/                 # Trumpet drill domain (built after the roadmap)
│   ├── fingerings.ts                 # Written note → valve combination
│   ├── fingerings.test-harness.ts
│   ├── valvePress.ts                 # Multi-touch valve press state machine
│   └── valvePress.test-harness.ts
├── trombone/                # Trombone drill domain
│   ├── positions.ts                  # Slide positions (log-spaced real geometry)
│   └── positions.test-harness.ts
├── sound/                   # Web Audio playback layer (built after the roadmap)
│   ├── SamplePlayer.ts               # Fetch → decode (lazy OfflineAudioContext) → play
│   ├── useInstrumentSound.ts         # React hook over SamplePlayer (lazy AudioContext unlock in play())
│   ├── sampleSets.ts                 # 14-sample config (trumpet ×8, trombone ×6) + transpose
│   ├── selectSample.ts               # Nearest-sample selection
│   ├── noteMath.ts                   # MIDI/note helpers (pure)
│   ├── envelope.ts                   # Attack/hold/release envelope spec
│   └── sound.test-harness.ts
├── components/              # Shared UI (12 components)
│   ├── CentsMeter.tsx, PitchDisplay.tsx, SidebarLayout.tsx, NoteHistory.tsx
│   ├── LanguageToggle.tsx            # i18n: EN/PT switcher, sidebar (above mic card)
│   ├── ScorePicker.tsx               # Stage 6: library picker + file upload
│   ├── NoteLane.tsx, NoteLane.css   # Stage 6: rAF-driven scrolling lane
│   ├── DevPanel.tsx                  # Collapsed-by-default harness card — mounted ONLY on PracticePage
│   ├── DrillSubmitButton.tsx         # Shared drill submit (Space-equivalent, pointer-capture guarded)
│   ├── SlideControl.tsx              # Trombone slide control (drag / 7 tap detents / arrow keys)
│   ├── SlideControl.test-harness.ts  # ⚠ returns a formatted STRING, not a case array
│   ├── slidePositions.ts             # Pure detent math shared by SlideControl + its harness
│   ├── TrumpetDisplay.tsx            # Staff + valve pistons (VexFlow)
│   └── TromboneDisplay.tsx           # Trombone artwork + slide ruler
├── i18n/                    # DIY i18n — I18nContext (provider + useT/useLocale/useSetLocale), keys.ts, dictionaries/{en,pt}.ts
├── styles/                  # Design system — tokens.css, clay.css, pages.css (drill + mobile overrides)
├── theme/
│   └── muiTheme.ts                   # MUI theme
├── utils/
│   └── haptics.ts                    # Vibration API wrapper (Android-only; silent no-op on iOS)
├── pages/
│   ├── HomePage.tsx
│   ├── TunerPage.tsx                 # Real-time needle + cents meter
│   ├── PracticePage.tsx              # Score practice + lane + dev panel (the only DevPanel mount)
│   ├── TrumpetDrillPage.tsx          # Valve drill (J/K/L + Space)
│   └── TromboneDrillPage.tsx         # Slide-position drill (drag / detents / arrows)
└── App.tsx                           # HashRouter with / /practice /tuner /trumpet-drill /trombone-drill routes (drills lazy-loaded with Suspense RouteFallback)

web/scripts/                       # Reproducible asset generators (run on the host, not in the app)
├── make_sound_samples.py             # Renders the 14 brass MP3s (MuseScore 4 + MS Basic.sf3)
├── make_trombone_assets.py           # Renders the 7 slide-position WebPs
└── measure_pitch.py                  # Offline pitch measurement for tuning checks

web/public/
├── pitch-processor.js                # AudioWorklet (pitch detection)
├── scores/                           # 22-entry manifest.json; only 4 MusicXML files bundled
│   ├── twinkle-twinkle-little-star.musicxml
│   ├── mary-had-a-little-lamb.musicxml
│   ├── ode-to-joy.musicxml
│   └── frere-jacques.musicxml
├── sounds/                           # 14 MP3 brass samples + CREDITS.md (MS Basic.sf3, MIT) + manifest.json
├── trumpet/                          # 8 valve press-state PNGs (trumpet-press-*.png)
└── trombone/                         # 7 slide-position WebPs (trombone-pos-*.webp)
```

## What's done (roadmap stages)

Stages 1–6 of `web/docs/roadmap.md` are complete:

| Stage | Description | Commits |
|---|---|---|
| 1 | Note segmentation | `30654d7` (timestamps) → `aeff1a1` (segmenter) → `ee5f224` (live render) → `1e0f508` (Practice route) → `ce0b136` (harness) |
| 2 | Timing model | `f506726` (TimingEngine) → `8feb651` (BPM + beat display) → `5a56f34` (harness) |
| 3 | MusicXML ingestion | `916f73c` (beat-zero anchor) → `0651825` (parser) → `a1aa346` (harness + rest-advances-currentBeat bugfix) |
| 4 | Matching engine | `0a0591b` (Matcher) → `765b7fa` (harness + MatchedNote.detected widening) |
| 5 | Scoring system | `85cd824` (Scorer) → `31cbea0` (harness) |
| 6 | Visual feedback (Mode A: wait-mode) | `5538097` (plan) → `1560ea2` (score library + manifest) → `bd1e6ce` (IncrementalMatcher + 7-case harness) → `8d6369a` (ScorePicker) → `66bf7b3` (useScoreSession + laneConfig) → `6771906` (NoteLane + integration) → `a7b86d4` (self-terminating rAF follow-ups) |
| — | Housekeeping | `20a2f57` (.gitattributes LF), `e02bf9e` (.gitignore .tmp/) |

### End-to-end data flow (live and complete)

```
MusicXML ──→ ExpectedNote[]         (Stage 3 parser)
                                    ↓
Mic ──→ usePitchDetection           (Stage 1)
        ↓ PitchData[]
   NoteSegmenter                     (Stage 1)
        ↓ DetectedNote[]
   TimingEngine.annotateNotes        (Stage 2)
        ↓ BeatNote[]
   IncrementalMatcher.push            (Stage 6, wait-mode; stateful cursor)
        ↓ MatchedNote[]
   Scorer.scoreMatch (per-note via session.consume)
        ↓ ScoredNote { tier }
   ScoreSession.consume → liveScored[] + activeTier + currentIndex
        ↓
   <NoteLane> rAF-driven transform (Mode A: wait-mode)
        ↓
   Completion overlay (scoreMatches on liveScored)
```

### Test harnesses (11 files, 128 cases total)

Most of them run under Node via `npx tsx`, **except `MusicXmlParser.test-harness.ts`, which is browser-only** (the parser needs `DOMParser`):

```bash
cd web
npx tsx -e "import { runSegmenterHarness } from './src/audio/NoteSegmenter.test-harness'; console.log(runSegmenterHarness());"
# same pattern for: TimingEngine, Matcher, Scorer, IncrementalMatcher, valvePress, fingerings, positions, sound
# ⚠ NOT MusicXmlParser — under tsx/Node it reports 0/7 ("DOMParser is not defined").
#   It only passes in the browser (dev panel). SlideControl's harness is also CLI-runnable,
#   but returns a formatted string ("SlideControl harness: 32/32 pass"), not a case array.
```

| Harness | Cases | Notes |
|---|---|---|
| NoteSegmenter | 6 | Wall-clock silence finalization is NOT deterministically testable (documented caveat) |
| TimingEngine | 8 | Includes a `bpm=0` throw case |
| MusicXmlParser | 7 | **Browser-only** — throws `DOMParser is not defined` under Node/tsx (reports 0/7 there). Passes in the dev panel. Includes rest-advances-currentBeat regression test |
| Matcher | 7 | Includes cross-window-steal artifact |
| Scorer | 6 | Includes wrong-pitch-class-mismatch case (the matcher gap); locks `scoreOne` passthrough contract |
| IncrementalMatcher | 8 | Wait-mode cursor; perfect run, out-of-window ignored, dropped note + forceMissActive, out-of-order ignored, empty list, wrong-pitch window match, … |
| valvePress | 8 | Trumpet multi-touch valve state machine |
| fingerings | 15 | Written-note → valve combination, incl. accidental-filter semantics |
| positions | 12 | Trombone slide positions (log-spaced geometry) |
| SlideControl | 32 | Trombone slide control. **Different shape:** `runSlideControlHarness()` returns a formatted string (e.g. `"SlideControl harness: 32/32 pass"`), not a case array |
| sound | 19 | Pure note/envelope/sample-selection core (no Web Audio at test time) |

All harnesses are pure functions (no React/DOM/I/O), except that MusicXmlParser's needs a browser `DOMParser`. The **dev panel mounts 9 of the 11** (all except SlideControl and sound) and is mounted **only on PracticePage** — deliberately not on the drill pages (see `DevPanel.tsx` JSDoc). Open PracticePage and click "Show dev panel" to see those 9 sections running live in the browser.

### Post-Stage 6: drills + sound (40 commits `35d08de` → `45b220a`)

After Stage 6 (and the full-app i18n work documented below), the app grew two instrument drills and a sound layer. These are **not part of the original 7-stage roadmap** — they were built after it. Stage 7 is still the next planned roadmap work.

**Trumpet drill (`/trumpet-drill`, TrumpetDrillPage):** a random note on a VexFlow staff; hold its valves (J/K/L, multi-touch on the on-screen pistons), then Space or the on-screen `DrillSubmitButton` to check & advance. Correct fingering only.

**Trombone drill (`/trombone-drill`, TromboneDrillPage):** slide-position drill. `SlideControl` accepts drag on the trombone image, 7 tap detents, and arrow keys.

**Shared drill features:** accidental filter (all / ♯ / ♭ / ♮), toggles (hide note names, hide status, mute), metrics (Time, Notes/min, Correct notes, Wrong notes), haptics (`web/src/utils/haptics.ts`, Vibration API — Android-only, silent no-op on iOS), and — since the sound layer — playback of the answered note on a correct submit.

**Sound layer (`web/src/sound/`):** Web Audio playback of committed samples; the drill pages play the ANSWERED note on a correct submit. 14 MP3s in `web/public/sounds/` — trumpet ×8 (MIDI 52, 57, 61, 66, 70, 75, 79, 84; `transposeSemitones: -2` — Bb trumpet) and trombone ×6 (MIDI 40, 45, 50, 55, 60, 65; transpose 0). Rendered by `web/scripts/make_sound_samples.py` (MuseScore 4.7.4 + MS Basic.sf3, MIT licence — see `web/public/sounds/CREDITS.md`); 0.8 s slices, 96 kbps mono 44.1 kHz, peak −3 dBFS; envelope 5 ms attack / 445 ms hold / 250 ms release. Sample paths in `sampleSets.ts` are RELATIVE (no leading slash); `SamplePlayer` prepends the app base URL. Decoding uses a lazily-created module-scoped `OfflineAudioContext`; the LIVE `AudioContext` is created lazily inside `play()` — that lazy creation IS the autoplay unlock, so never call `play()` outside a user-gesture-triggered path.

**Sound-generator pitfall — the part-name / piano fallback** (fixed in `d4749fe`, samples regenerated in `19d06f6`): MuseScore 4.x's MusicXML importer IGNORES `<midi-program>` (program 57 and 1 render byte-identically) and picks the MS Basic preset from `<part-name>`; an unrecognised name ("Trumpet in C") silently falls back to the default PIANO patch — at the CORRECT pitch, so every existing gate passed and the bug shipped silently. `make_sound_samples.py` now uses the recognised `partName` "Trumpet" AND pins the preset with `<score-instrument><instrument-sound>brass.trumpet</instrument-sound>`, and a pure-stdlib SUSTAIN GATE in `render_and_measure()` fails the run if a note decays like a struck instrument (16×50 ms RMS windows; tail/head ≥ 0.65, slope ≥ −6.0 dB/s) instead of sustaining like brass. It also asserts each note's measured MIDI equals its intended MIDI, so filenames can't drift out of sync with `sampleSets.ts`.

**`--only <instrument>`** regenerates one instrument only; `write_manifest()` seeds from the existing `manifest.json` so the other instrument's block stays verbatim — a re-encode is audibly identical but byte-different, so this avoids pointless churn in the 6 trombone MP3s.

**Toolchain note:** the generator needs `mscore` (MuseScore 4.7.5 CLI at `/usr/bin/mscore`, run with `QT_QPA_PLATFORM=offscreen`) AND `ffmpeg`/`ffprobe`, which are NOT installed on this host and cannot be (no working sudo); they were supplied via gitignored shims in `.tmp/bin` pointing at `flatpak run --filesystem=<repo> --command=ffmpeg org.freedesktop.Platform//26.08`. `lame` IS available at `/usr/bin/lame` — so don't conclude the generator is unrunnable.

**Mobile (≤640 px) drill tightening** (commits `9d6d8e1`, `d91e6d7`, `45b220a`): the drill legend is hidden; the staff well shrinks 220 px → 140 px CSS-only (VexFlow's SVG carries `viewBox="0 0 340 220"`, so a shorter CSS height scales the staff uniformly with NO clipping — the renderer is deliberately NOT changed); trumpet valves share one row (`max-width: 100%`, `min-width: 52px`); trombone detents share one row (`flex-wrap: nowrap`, `flex: 1 1 0`, `min-width: 0`, `height: 48px`, `gap: var(--sp-1)`). Desktop (≥641 px) is unchanged. Every override lives inside the single `@media (max-width: 640px)` block in `pages.css`.

**Recent bug fixes worth knowing:** `DrillSubmitButton` guards `setPointerCapture` (try/catch + `hasPointerCapture` check) — unlike the valve/surface guard it deliberately does NOT decline the press when capture fails, because a submit must not be silently dropped. `SlideControl`'s dead `surfaceRef` was removed (`fc1c043`). The `.drill-legend__touch` touch-hint paragraph was deleted entirely (both drill pages, `pages.css`, and both i18n dictionaries — `d62e0b7`).

### DIY i18n (full-app) — post-Stage 6, reviewer APPROVED

Added after Stage 6 in commits `3bb0051` → `3846137` (provider + dictionaries, provider mount, toggle component, sidebar wiring), then expanded to **full-app coverage** in commits `d997bf8`, `2277cd4`, `18ce9cb`, `e58c9bf`, `a38d314`, `b4d1b1f`, `f1f47b4` (key expansion + EN scaffolding; SidebarLayout a11y strings; HomePage; TunerPage + tuner components; ScorePicker/NoteLane/TrumpetDisplay; PracticePage/TrumpetDrillPage/App fallback; final PT copy pass). Reviewed and **APPROVED** (0 blocking issues, 1 minor nit: PT copy uses "espaço" for the Space key token — cosmetic only, see LedeText note below). Stage 7 scope is unchanged.

- **Implementation: DIY i18n at `web/src/i18n/`** — no i18n library. `I18nProvider` (in `I18nContext.tsx`) is mounted in `main.tsx` above `<App>`.
- **Hooks:** `useT()` (translate a `TranslationKey`), `useLocale()`, `useSetLocale()`. All throw if used outside the provider.
- **Persistence:** `localStorage['pq.lang']`, with a `navigator` Portuguese-detection fallback (any `pt*` navigator language → `pt`, final default `pt`). The `pt` locale is **Brazilian Portuguese (pt-BR)**, not European Portuguese — this applies to all PT copy, the pt-BR-reviewed glossary, and any future PT additions. Stored choice wins. `pq.lang` is a reserved key — don't reuse it for other persisted prefs.
- **Side effect:** the provider keeps `<html lang>` in sync with the active locale.
- **UI:** `LanguageToggle` (`web/src/components/LanguageToggle.tsx`) renders in the sidebar, directly above the mic card.
- **Scope: full-app — 248 keys.** All 5 pages (Home, Tuner, Practice, TrumpetDrill, TromboneDrill), all shared components (SidebarLayout incl. a11y strings, ScorePicker, NoteLane, CentsMeter, NoteHistory, PitchDisplay, TrumpetDisplay, TromboneDisplay, LanguageToggle, DevPanel, DrillSubmitButton, SlideControl), and the App route-fallback strings are translated. The PT glossary lives as a comment at the top of `web/src/i18n/dictionaries/pt.ts` (perfeito / ok / errou, cents, batidas, sustenido / bemol, afinado, partitura, exercício, digitação, estrito / automático) — **do not retranslate ad hoc**; follow the approved glossary. To extend: add strings to `web/src/i18n/dictionaries/en.ts` + `pt.ts` (keys in `keys.ts`) and swap the hardcoded strings in the component.
- **Other persisted prefs (localStorage):** `pq.lang` plus per-drill UI prefs — `pq.trumpetDrill.{filter,hideNoteName,hideStatus,mute}` and `pq.tromboneDrill.{filter,hideNoteName,hideStatus,mute}`. `pq.lang` is a reserved key — don't reuse it for other persisted prefs.
- **Interpolation convention:** dynamic values use `{name}` placeholders in dictionary copy (e.g. `{bpm}`, `{cents}`, `{tier}`); the consuming component substitutes them at usage time (see `keys.ts` header).
- **PT copy** is Brazilian Portuguese (pt-BR) and has been reviewed. The PT lede on TrumpetDrillPage (`trumpet.header.lede`) must keep the literal `J`, `K`, `L`, and `Space` tokens — `LedeText` (in `TrumpetDrillPage.tsx`) splits on exactly those tokens to bold them; translating "Space" as "espaço" would break the highlighting.

## What's next

Per `web/docs/roadmap.md`, only Stage 7 remains. The drills + sound layer described above are **extra, post-roadmap work** — they don't change the Stage 7 plan:

### Stage 7 — Mode B (continuous scrolling) + session results screen

The `IncrementalMatcher` + `<NoteLane>` + `useScoreSession` stack is Stage 7-ready. The changes to go from Mode A (wait-mode) to Mode B (continuous scrolling) are small:
- **Mode B:** remove the wait-mode cursor logic. The `rAF` loop already reads `performance.now()` and computes `currentBeat`; Mode B just lets `currentBeat` flow continuously without waiting for `consume()` to match the active note. The lane scrolls smoothly at all times.
- **Session results screen:** `ScoreSummary` is already computed live as notes complete. Stage 7 adds a "results overlay" that appears when `consumedCount === expected.length`, showing accuracy %, problem notes, and a "retry / next piece" action.
- **Library expansion:** `manifest.json` already lists all 22 pieces (Twinkle, Mary Had a Little Lamb, Ode to Joy, Frère Jacques are bundled; the rest have `"file": null` placeholders).
- **Octave equivalence flag:** `STATUS.md` gotcha #9 — add `pitchClassOnly: boolean` to `ScoringThresholds` in a follow-on task.

## Operational gotchas (read these before doing anything)

### 1. Git identity

Every commit in this repo should be authored as `Daniel <7233639+dandandandaann@users.noreply.github.com>`. The repo already has a local `git config user.name/user.email` set, but **worker agents running in sandboxes may not inherit this** — they can commit as `agent <agent@local>` instead.

**Mitigation:** every delegation to a worker MUST include the git identity check + amend-if-wrong instructions. The pattern is:

```bash
git -C /home/daniel/repo/pitch-quest config user.name
git -C /home/daniel/repo/pitch-quest config user.email
# If either is empty or wrong, set them:
git -C /home/daniel/repo/pitch-quest config user.name "Daniel"
git -C /home/daniel/repo/pitch-quest config user.email "7233639+dandandandaann@users.noreply.github.com"
# After commit, verify:
git -C /home/daniel/repo/pitch-quest log -1 --format="%an <%ae>"
# If wrong, amend:
git -C /home/daniel/repo/pitch-quest commit --amend --reset-author --no-edit
```

This was caught and fixed once (Stage 3 Task A → `916f73c` after amend); the local config was set at that point so subsequent commits should be fine, but sandboxed workers may still slip up.

### 2. Working directory

`AGENTS.md` says: "**Code is in `./web/`** — not at repo root. All commands must run from within `web/`."

Worker agents often run `git add -A` from the repo root which would commit `.gitignore`-covered files like `.tmp/`. **Always use selective `git add <files>`** — never `git add -A`.

### 3. Suppressed `react-hooks/refs` errors in `useAudioContext.ts`

`useAudioContext.ts:33` accesses `audioContextRef.current` during render (in the returned object); that access is deliberately suppressed with an inline `// eslint-disable-line react-hooks/refs`. Because of that suppression, `npm run lint` is **clean (0 errors, 0 warnings)** — but the rule WOULD fire (2 errors: "Cannot access ref value during render") if the suppression were removed (verified empirically). The suppression was added in `916f73c` (Stage 3 Task A) and is intentional and load-bearing — do NOT "clean it up" without understanding it, and do not reintroduce additional render-time ref access. Do not fix this as part of unrelated work.

### 4. PracticePage is split across hooks now

After Stage 6, `PracticePage.tsx` is slimmed down; session state lives in `useScoreSession` and harness results live in `useDevPanelHarnesses`. The original "too much in one component" risk is mitigated. The dev panel wiring is in `useDevPanelHarnesses`.

### 5. No automated test suite

`AGENTS.md` says: "No test suite". All testing is via the dev-only pure-function harnesses in `web/src/**/test-harness.ts`. This is intentional — adding `vitest`/`jest` would be a meta-task; the harnesses work and have 128 cases across 11 files (see the harness table above).

### 6. The `performance.now()` zero-origin problem (resolved)

Stage 3 Task A solved this: `audioStartPerfNow` is captured on Start Mic and subtracted from each frame's timestamp before segmentation. The comment in `Matcher.ts` and `TimingEngine.ts` documents why this matters and what would break without it.

### 7. Browser-only modules

`MusicXmlParser.ts` uses browser-native `DOMParser`. It works fine in the SPA. If anyone ever tries to SSR, it will break — there's no SSR config in `vite.config.ts` so this isn't a current concern, but worth noting.

**Harness corollary:** `MusicXmlParser.test-harness.ts` CANNOT run under Node/tsx — it reports `0/7` with `"DOMParser is not defined"`. Only its dev-panel run (browser) counts as passing. Don't "fix" it by stubbing `DOMParser` globally; that would test a mock, not the parser.

Two more harness-shape quirks: `SlideControl.test-harness.ts` returns a formatted **string** (`"SlideControl harness: 32/32 pass"`), not a case array; and the dev panel mounts only **9 of the 11** harnesses (SlideControl and sound are excluded) and is mounted **only on PracticePage**.

### 8. The matcher has greedy-window-steal artifact

Documented in `Matcher.test-harness.ts` case 6: when expected notes are close together (default 1 beat apart) and the windows overlap (each is 0.5 wide), a misplaced detected note can "steal" the slot of a neighboring expected note. The scorer handles this gracefully (the stolen expected still gets scored — just with bad timing/pitch numbers). v2 could use Hungarian assignment to fix.

### 9. Pitch class match is strict (C4 ≠ C5)

The scorer reports C4 vs C5 as "miss" even though they share the same pitch class. Documented as a v2 candidate in `Scorer.ts` JSDoc. If user testing shows this is a common error mode, switch to pitch-class-only comparison. See also Stage 7 backlog item for `pitchClassOnly: boolean` flag.

### 10. The "Guitar Hero" wait-mode UX

- Mode A advances note-by-note. The user must hit each note before the next becomes active.
- Auto-advance grace period: 2 beats past `startBeat + durationBeats` (configurable in `laneConfig.ts`).
- The lane uses CSS `transform: translateX(...)` driven by `requestAnimationFrame` reading `performance.now()` (NOT `audioContext.currentTime`).
- `audioContextRef.current` reactivity quirk in `useAudioContext`: the hook returns `audioContextRef.current` (ref value at render time), not the ref itself. `useScoreSession` and `NoteLane` deliberately avoid depending on `audioContext` in rAF loops — they use `performance.now()` exclusively.
- Stage 7 will reuse `IncrementalMatcher`, `useScoreSession`, and `<NoteLane>` verbatim; only the wait-mode cursor logic is replaced with continuous scrolling.

### 11. The sound layer must stay autoplay-safe

`web/src/sound/SamplePlayer.ts` creates the LIVE `AudioContext` lazily **inside `play()`** (that lazy creation is the autoplay unlock — `play()` only ever runs from a keydown/button path). Decoding uses a separately-created module-scoped `OfflineAudioContext`. Do not hoist the live `AudioContext` to module scope or to hook mount; that would break the unlock chain. Sample paths in `sampleSets.ts` are relative (no leading slash) and `SamplePlayer` prepends the base URL — keep that split (it was corrected once in `8ec6767`). The drill pages play the answered note only on a CORRECT submit; mute is a per-drill localStorage pref.

## Tasks currently in the backlog

- `eb19ec46` — Follow-up: add 6/8 case without `<duration>` to exercise type+beat-type math (low priority)
- Stage 7 backlog: Mode B (continuous scrolling), session results screen, library expansion to 22 pieces, `pitchClassOnly` flag in `ScoringThresholds`
- Suppressed `useAudioContext.ts` render-time ref access — `useAudioContext.ts:33` carries an inline `// eslint-disable-line react-hooks/refs` (added in `916f73c`); lint is clean only because of it. The suppression is intentional and load-bearing — do not "clean it up" as part of unrelated work; keep it that way
- Possible follow-ons from the drill/sound era (not committed to anything): dev-panel mounts for SlideControl (32 cases) and sound (19 cases) — currently only runnable via CLI

## How to continue (for the next manager agent)

1. **Read this file and `web/docs/roadmap.md`** to understand state and direction. Note that the trumpet/trombone drills and the sound layer are post-roadmap additions — the roadmap's Stage 7 is still the next planned stage.
2. **Pick up Stage 7** — Mode B + session results screen are the planned next steps. The `IncrementalMatcher` + `<NoteLane>` + `useScoreSession` architecture is already in place and Stage 7-ready. Before delegating:
   - Decide on the results screen UX (modal overlay vs. separate route).
   - Confirm the Mode B scroll approach (remove wait-mode cursor, let rAF flow continuously).
3. **Consider housekeeping**:
   - Stage 3 6/8 follow-up (already in backlog).
   - Library expansion (Tasks 1b/1c from Stage 6 plan — fill in remaining 18 MusicXML files).
   - Optional: mount the SlideControl + sound harnesses in the dev panel (currently CLI-only).
4. **Don't push to remote** — the user said they'll push after testing locally.

## Commands cheat sheet

```bash
# Run from web/ for all of these
cd web

# Build (type-check + production build)
npm run build

# Lint (fully clean as of 2026-10-05 — keep it that way)
npm run lint

# Dev server with HMR
npm run dev

# Run most harnesses at runtime (⚠ MusicXmlParser's is browser-only — dev panel only)
npx tsx -e "import { runSegmenterHarness } from './src/audio/NoteSegmenter.test-harness'; console.log(runSegmenterHarness());"
npx tsx -e "import { runSlideControlHarness } from './src/components/SlideControl.test-harness'; console.log(runSlideControlHarness());"  # returns a formatted string
```
