# PitchQuest — Status & Handoff

**Last updated:** end of Stage 5 (commit `31cbea0`).
**Audience:** the next manager agent (or human) picking up this project.

---

## What is this project?

PitchQuest is a React 19 + TypeScript + Vite app at `/Users/daniel/repo/PitchQuest/web/`. The original app was a basic microphone pitch tuner (Tuner page); the work documented here evolved it into a Guitar-Hero-style practice tool that takes a MusicXML score, segments the user's live mic input, matches expected vs detected notes, scores the result, and (eventually) animates it.

## Where things live

```
web/src/
├── audio/                   # Pitch domain — audio in, performance data out
│   ├── hooks/
│   │   ├── useAudioContext.ts        # AudioContext lifecycle + audioStartPerfNow (beat-zero anchor)
│   │   └── usePitchDetection.ts      # Mic → worklet → pitchy → PitchData
│   ├── NoteSegmenter.ts              # Pitch stream → DetectedNote[]
│   ├── TimingEngine.ts               # ms � beats; BeatNote annotation
│   ├── Matcher.ts                    # ExpectedNote[] + BeatNote[] → MatchedNote[]
│   ├── Scorer.ts                     # MatchedNote[] → ScoreResult { perNote, summary }
│   ├── types.ts                      # DetectedNote
│   ├── utils/
│   │   ├── pitch-math.ts             # frequencyToNote (flats-style: "C4", "Db5")
│   │   ├── smoothing.ts              # MedianFilter, MovingAverage
│   │   └── format.ts                 # formatCents, formatBeats
│   └── *.test-harness.ts             # 5 pure-function harnesses (see "Test harnesses" below)
├── score/                   # Score domain — sheet music in
│   ├── types.ts                      # ExpectedNote
│   ├── MusicXmlParser.ts             # XML string → ExpectedNote[]
│   └── MusicXmlParser.test-harness.ts
├── components/              # Shared UI (CentsMeter, PitchDisplay, SidebarLayout, NoteHistory)
├── pages/
│   ├── HomePage.tsx
│   ├── TunerPage.tsx                 # Real-time needle + cents meter
│   └── PracticePage.tsx              # Segmented notes + BPM + dev panel (5 sections)
├── audio/hooks/useAudioContext.ts    # ⚠️ Has 2 PRE-EXISTING lint errors (refs during render). Out of scope.
└── App.tsx                           # HashRouter with / /tuner /practice routes
```

## What's done (roadmap stages)

Stages 1–5 of `web/docs/roadmap.md` are complete:

| Stage | Description | Commits |
|---|---|---|
| 1 | Note segmentation | `30654d7` (timestamps) → `aeff1a1` (segmenter) → `ee5f224` (live render) → `1e0f508` (Practice route) → `ce0b136` (harness) |
| 2 | Timing model | `f506726` (TimingEngine) → `8feb651` (BPM + beat display) → `5a56f34` (harness) |
| 3 | MusicXML ingestion | `916f73c` (beat-zero anchor) → `0651825` (parser) → `a1aa346` (harness + rest-advances-currentBeat bugfix) |
| 4 | Matching engine | `0a0591b` (Matcher) → `765b7fa` (harness + MatchedNote.detected widening) |
| 5 | Scoring system | `85cd824` (Scorer) → `31cbea0` (harness) |
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
   Matcher.matchNotes                (Stage 4)
        ↓ MatchedNote[]
   Scorer.scoreMatches               (Stage 5)
        ↓ ScoreResult { perNote, summary }
   [Stage 6: visualize]
   [Stage 7: session stats]
```

### Test harnesses (34 cases total, all passing)

Run any of them at runtime via `npx tsx`:

```bash
cd web
npx tsx -e "import { runSegmenterHarness } from './src/audio/NoteSegmenter.test-harness'; console.log(runSegmenterHarness());"
# same pattern for: TimingEngine, MusicXmlParser, Matcher, Scorer
```

| Harness | Cases | Notes |
|---|---|---|
| NoteSegmenter | 6 | Wall-clock silence finalization is NOT deterministically testable (documented caveat) |
| TimingEngine | 8 | Includes a `bpm=0` throw case |
| MusicXmlParser | 7 | Includes rest-advances-currentBeat regression test |
| Matcher | 7 | Includes cross-window-steal artifact |
| Scorer | 6 | Includes wrong-pitch-class-mismatch case (the matcher gap) |

All harnesses are pure functions (no React/DOM/I/O). They're also wired into the **dev panel on PracticePage** (5 sections, "Show dev panel" button at the bottom). When you open the page, you can see all 34 cases running live in the browser.

## What's next

Per `web/docs/roadmap.md`, the remaining stages are:

### Stage 6 — Visual feedback (next, big)

Roadmap:
> Start minimal:
> - Scrolling staff (or even just blocks)
> - Notes colored:
>   - 🟢 correct
>   - 🟡 off timing
>   - 🔴 wrong pitch
> 👉 This is where it becomes "Guitar Hero"

**Real complexity:** Stage 6 introduces UI that consumes the LIVE `ScoreResult`. This needs:

1. A "Load score" button on PracticePage that parses a MusicXML string → `ExpectedNote[]` (the parser exists; just needs a UI affordance to paste/upload).
2. A "Start session" control that aligns the AudioContext clock with beat 0 of the score.
3. A scrolling lane / staff that shows expected notes moving toward a "now" line, colored by the live tier as the user plays.
4. **Real-time scoring** — currently `Scorer.scoreMatches` takes a complete `MatchedNote[]`. Stage 6 needs a way to score incrementally as detected notes come in (extend `Matcher.matchNotes` to handle streaming input, OR add a per-frame `matchOneNote` variant).

**Architectural questions for Stage 6 (not yet decided — surface them up front):**

- **Lane vs staff visualization:** scrolling blocks are simpler; staff notation requires a music-rendering library (VexFlow is the standard but is a real dependency). Recommend blocks for v1.
- **Score ingestion:** paste text, upload file, or both? Paste is simpler; upload needs an `<input type="file">` + `FileReader`.
- **Incremental scoring:** does `Matcher` need to become stateful (accumulating detected notes over time)? Or does Stage 6 maintain its own expected-vs-played-so-far state?
- **Pre-loaded sample scores:** ship a "C-major scale" button that hard-codes a tiny MusicXML so the user can try the feature without finding a file?

**Recommended Stage 6 task breakdown (planning not yet done):**

1. Add "Load score" UI + button on PracticePage, store parsed `ExpectedNote[]` in state.
2. Extend `Matcher` (or add a sibling) to support incremental matching — `pushMatch(expected, newDetected) → newMatches + remainingExpected`.
3. Add `<NoteLane>` component that renders expected notes scrolling past, colored by live tier.
4. Wire everything to the existing `ScoreResult` for live feedback.

### Stage 7 — Session loop (after Stage 6)

Roadmap:
> * Play → feedback → retry
> * Track: accuracy %, problem notes

The data is already there (`ScoreSummary.accuracyPct`, `ScoredNote` per-note). Stage 7 is mostly UI: a "results screen" after a take, plus per-note history.

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

### 4. PracticePage has accumulated state

After Stages 1–5, `PracticePage.tsx` has:
- 6 `useState` hooks (audioStartPerfNow-derived state, segmenter state, harness state)
- 5+ `useEffect` hooks (segmenter lifecycle, push effect, 5 mount-effect setState calls)
- A growing dev panel

**Before Stage 6**, consider whether to refactor this into smaller hooks (`useNoteSegmenterLog`, `useDevPanelHarnesses`, `useScoreSession`). The current state works but is approaching "too much in one component".

### 5. No automated test suite

`AGENTS.md` says: "No test suite". All testing is via the dev-only pure-function harnesses in `web/src/**/test-harness.ts`. This is intentional — adding `vitest`/`jest` would be a meta-task; the harnesses work and have 34 cases passing.

### 6. The `performance.now()` zero-origin problem (resolved)

Stage 3 Task A solved this: `audioStartPerfNow` is captured on Start Mic and subtracted from each frame's timestamp before segmentation. The comment in `Matcher.ts` and `TimingEngine.ts` documents why this matters and what would break without it.

### 7. Browser-only modules

`MusicXmlParser.ts` uses browser-native `DOMParser`. It works fine in the SPA. If anyone ever tries to SSR, it will break — there's no SSR config in `vite.config.ts` so this isn't a current concern, but worth noting.

### 8. The matcher has greedy-window-steal artifact

Documented in `Matcher.test-harness.ts` case 6: when expected notes are close together (default 1 beat apart) and the windows overlap (each is 0.5 wide), a misplaced detected note can "steal" the slot of a neighboring expected note. The scorer handles this gracefully (the stolen expected still gets scored — just with bad timing/pitch numbers). v2 could use Hungarian assignment to fix.

### 9. Pitch class match is strict (C4 ≠ C5)

The scorer reports C4 vs C5 as "miss" even though they share the same pitch class. Documented as a v2 candidate in `Scorer.ts` JSDoc. If user testing shows this is a common error mode, switch to pitch-class-only comparison.

## Tasks currently in the backlog

The task tracker has one outstanding task:

- `eb19ec46` — Follow-up: add 6/8 case without `<duration>` to exercise type+beat-type math (low priority)

This was flagged in the Stage 3 Task C review — the existing 6/8 test case uses `<duration>2</duration>`, which bypasses the `<type>`+`<beat-type>` math branch. Adding a case with only `<type>quarter</type>` in 6/8 time would catch future regressions in that formula.

## How to continue (for the next manager agent)

1. **Read this file and `web/docs/roadmap.md`** to understand state and direction.
2. **Pick up Stage 6** (visual feedback) — it's the next big thing and where the project becomes user-visible as "Guitar Hero". Before delegating:
   - Decide the architectural questions in "What's next → Stage 6" above.
   - Use the planner agent to produce a concrete task breakdown (same pattern used for Stages 1–5).
3. **Consider housekeeping**:
   - Pre-existing `useAudioContext.ts` lint errors (small, dedicated task).
   - Stage 3 6/8 follow-up (already in backlog).
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
