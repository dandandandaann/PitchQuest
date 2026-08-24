# PitchQuest — Status & Handoff

**Last updated:** end of Stage 6 (commit `a7b86d4`).
**Audience:** the next manager agent (or human) picking up this project.

---

## What is this project?

PitchQuest is a React 19 + TypeScript + Vite app at `/Users/daniel/repo/PitchQuest/web/`. The original app was a basic microphone pitch tuner (Tuner page); the work documented here evolved it into a Guitar-Hero-style practice tool that takes a MusicXML score, segments the user's live mic input, matches expected vs detected notes, scores the result, and animates it in a scrolling lane.

## Where things live

```
web/src/
├── audio/                   # Pitch domain — audio in, performance data out
│   ├── hooks/
│   │   ├── useAudioContext.ts        # AudioContext lifecycle + audioStartPerfNow (beat-zero anchor)
│   │   ├── usePitchDetection.ts      # Mic → worklet → pitchy → PitchData
│   │   ├── useScoreSession.ts       # Stage 6: per-session state machine (IncrementalMatcher, rAF ticker, liveScored[])
│   │   └── useDevPanelHarnesses.ts   # Stage 6: mounts all 6 harness results for the dev panel
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
│   └── *.test-harness.ts             # 6 pure-function harnesses (see "Test harnesses" below)
├── score/                   # Score domain — sheet music in
│   ├── types.ts                      # ExpectedNote
│   ├── MusicXmlParser.ts             # XML string → ExpectedNote[]
│   └── MusicXmlParser.test-harness.ts
├── components/              # Shared UI
│   ├── CentsMeter.tsx, PitchDisplay.tsx, SidebarLayout.tsx, NoteHistory.tsx
│   ├── ScorePicker.tsx               # Stage 6: library picker + file upload
│   └── NoteLane.tsx, NoteLane.css   # Stage 6: rAF-driven scrolling lane
├── pages/
│   ├── HomePage.tsx
│   ├── TunerPage.tsx                 # Real-time needle + cents meter
│   └── PracticePage.tsx              # Score practice + lane + dev panel
└── App.tsx                           # HashRouter with / /tuner /practice routes

web/public/
├── pitch-processor.js                # AudioWorklet (pitch detection)
└── scores/
    ├── manifest.json                  # Stage 6: 22-entry score catalog
    ├── twinkle-twinkle-little-star.musicxml
    ├── mary-had-a-little-lamb.musicxml
    ├── ode-to-joy.musicxml
    └── frere-jacques.musicxml
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

### Test harnesses (41 cases total, all passing)

Run any of them at runtime via `npx tsx`:

```bash
cd web
npx tsx -e "import { runSegmenterHarness } from './src/audio/NoteSegmenter.test-harness'; console.log(runSegmenterHarness());"
# same pattern for: TimingEngine, MusicXmlParser, Matcher, Scorer, IncrementalMatcher
```

| Harness | Cases | Notes |
|---|---|---|
| NoteSegmenter | 6 | Wall-clock silence finalization is NOT deterministically testable (documented caveat) |
| TimingEngine | 8 | Includes a `bpm=0` throw case |
| MusicXmlParser | 7 | Includes rest-advances-currentBeat regression test |
| Matcher | 7 | Includes cross-window-steal artifact |
| Scorer | 7 | Includes wrong-pitch-class-mismatch case (the matcher gap); case 7 locks `scoreOne` passthrough contract |
| IncrementalMatcher | 6 | Wait-mode cursor; cases: perfect run, out-of-window ignored, dropped note + forceMissActive, out-of-order ignored, empty list, wrong-pitch window match |

All harnesses are pure functions (no React/DOM/I/O). They're also wired into the **dev panel on PracticePage** (6 sections, "Show dev panel" button at the bottom). When you open the page, you can see all 41 cases running live in the browser.

## What's next

Per `web/docs/roadmap.md`, only Stage 7 remains:

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
git -C /Users/daniel/repo/PitchQuest config user.name
git -C /Users/daniel/repo/PitchQuest config user.email
# If either is empty or wrong, set them:
git -C /Users/daniel/repo/PitchQuest config user.name "Daniel"
git -C /Users/daniel/repo/PitchQuest config user.email "7233639+dandandandaann@users.noreply.github.com"
# After commit, verify:
git -C /Users/daniel/repo/PitchQuest log -1 --format="%an <%ae>"
# If wrong, amend:
git -C /Users/daniel/repo/PitchQuest commit --amend --reset-author --no-edit
```

This was caught and fixed once (Stage 3 Task A → `916f73c` after amend); the local config was set at that point so subsequent commits should be fine, but sandboxed workers may still slip up.

### 2. Working directory

`AGENTS.md` says: "**Code is in `./web/`** — not at repo root. All commands must run from within `web/`."

Worker agents often run `git add -A` from the repo root which would commit `.gitignore`-covered files like `.tmp/`. **Always use selective `git add <files>`** — never `git add -A`.

### 3. Pre-existing lint errors in `useAudioContext.ts`

This file has 2 `react-hooks/refs` errors (accessing `audioContextRef.current` during render on lines 28 and 30-something). They've been there since before any of the Stage 1+ work began.

**Mitigation:** every lint task says "0 errors, pre-existing warnings acceptable". DO NOT fix as part of unrelated work — open a dedicated housekeeping task if you want to address it.

### 4. PracticePage is split across hooks now

After Stage 6, `PracticePage.tsx` is slimmed down; session state lives in `useScoreSession` and harness results live in `useDevPanelHarnesses`. The original "too much in one component" risk is mitigated. The dev panel wiring is in `useDevPanelHarnesses`.

### 5. No automated test suite

`AGENTS.md` says: "No test suite". All testing is via the dev-only pure-function harnesses in `web/src/**/test-harness.ts`. This is intentional — adding `vitest`/`jest` would be a meta-task; the harnesses work and have 41 cases passing.

### 6. The `performance.now()` zero-origin problem (resolved)

Stage 3 Task A solved this: `audioStartPerfNow` is captured on Start Mic and subtracted from each frame's timestamp before segmentation. The comment in `Matcher.ts` and `TimingEngine.ts` documents why this matters and what would break without it.

### 7. Browser-only modules

`MusicXmlParser.ts` uses browser-native `DOMParser`. It works fine in the SPA. If anyone ever tries to SSR, it will break — there's no SSR config in `vite.config.ts` so this isn't a current concern, but worth noting.

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

## Tasks currently in the backlog

- `eb19ec46` — Follow-up: add 6/8 case without `<duration>` to exercise type+beat-type math (low priority)
- Stage 7 backlog: Mode B (continuous scrolling), session results screen, library expansion to 22 pieces, `pitchClassOnly` flag in `ScoringThresholds`, pre-existing `useAudioContext.ts` lint errors

## How to continue (for the next manager agent)

1. **Read this file and `web/docs/roadmap.md`** to understand state and direction.
2. **Pick up Stage 7** — Mode B + session results screen are the planned next steps. The `IncrementalMatcher` + `<NoteLane>` + `useScoreSession` architecture is already in place and Stage 7-ready. Before delegating:
   - Decide on the results screen UX (modal overlay vs. separate route).
   - Confirm the Mode B scroll approach (remove wait-mode cursor, let rAF flow continuously).
3. **Consider housekeeping**:
   - Pre-existing `useAudioContext.ts` lint errors (small, dedicated task).
   - Stage 3 6/8 follow-up (already in backlog).
   - Library expansion (Tasks 1b/1c from Stage 6 plan — fill in remaining 18 MusicXML files).
4. **Don't push to remote** — the user said they'll push after testing locally.

## Commands cheat sheet

```bash
# Run from web/ for all of these
cd web

# Build (type-check + production build)
npm run build

# Lint (will show the pre-existing useAudioContext.ts errors — expected)
npm run lint

# Dev server with HMR
npm run dev

# Run any harness at runtime
npx tsx -e "import { runSegmenterHarness } from './src/audio/NoteSegmenter.test-harness'; console.log(runSegmenterHarness());"
```
