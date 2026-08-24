# Stage 6 — Visual Feedback ("Guitar Hero" Mode A) — Implementation Plan

**Status:** planning only. Do NOT modify source files from this document.
**Scope:** Mode A (note-by-note wait mode) + static score library + lane visualization.
**Out of scope:** Mode B (continuous scrolling) and Stage 7 session loop — mentioned at the end as future work.

---

## 1. Architectural decisions

### 1.1 Streaming matcher — **stateful sibling, not a Matcher mutation**

**Decision:** Add a new module `IncrementalMatcher` (in `web/src/audio/IncrementalMatcher.ts`) that owns the cursor state. Leave `Matcher.matchNotes` and its 7 harness cases unchanged.

**Reasoning:**
- `matchNotes` is the canonical batch API used by the existing test harness (7 cases) and was deliberately stateless so all 34 cases could stay deterministic. Mutating it forces the harness to grow new cases for the stateful path and risks regressing the pure-function contract documented in `STATUS.md`.
- A separate `IncrementalMatcher` class can keep an internal "remaining expected" cursor plus a `used` detection-id set, and expose `push(detected) → matchedSoFar`. That naturally fits the React lifecycle (one instance per session, held in a `useRef`).
- Stage 7's session loop will reuse this same object — re-using an already-tested class is cheaper than retrofitting `matchNotes`.

**API shape (target):**
```ts
export class IncrementalMatcher {
  constructor(expected: ExpectedNote[], opts?: MatcherOptions);
  /** Consume a single detected note. Returns any new MatchedNote created by this push (0 or 1). */
  push(detected: BeatNote): MatchedNote | null;
  /** How many expected notes have been matched (perfectly or partially) so far. */
  readonly consumedCount: number;
  /** Remaining expected notes still pending. */
  readonly remaining: ExpectedNote[];
  /** Force-resolve the currently-active expected note as 'miss' (used by grace-period auto-advance). */
  forceMissActive(): MatchedNote;
}
```

**Window logic (v1):** identical to `Matcher.matchNotes` (±0.5 beat default), but only the *first* expected note is "active" at a time. A detected note matches the active one if it falls in `[active.startBeat − 0.5, active.startBeat + active.durationBeats + 0.5]`. On a hit, the cursor advances. On a miss (out of window or wrong pitch), the detection is ignored — the active note stays active and the user can keep trying. `forceMissActive()` is called by a beat-clock tick when `currentBeat > active.startBeat + active.durationBeats + GRACE_BEATS`.

### 1.2 Single-note scoring — **add `scoreOne` to Scorer (small, additive)**

**Decision:** Export `scoreOne(match: MatchedNote): ScoreTier` as a public function alongside the existing `scoreMatch` (which already exists and does exactly this — see `Scorer.ts` lines 86-108). Re-export it; no new logic.

**Reasoning:**
- `Scorer.ts` already has `scoreMatch(match)` — a perfectly usable "score one" primitive that the UI can call on the live `MatchedNote` returned by `IncrementalMatcher.push`. The current `scoreMatches(matches[])` is just `map(scoreMatch) + summary`.
- No new pure code is required. The plan is to **document and re-export** `scoreMatch` under the clearer name `scoreOne` (or simply re-export as-is) so the UI doesn't have to import from a place that looks batch-only. The test harness `Scorer.test-harness.ts` already exercises `scoreMatch` indirectly through `scoreMatches`; adding 1–2 explicit `scoreOne` cases is enough to lock the contract.

### 1.3 Hook extraction — **new `useScoreSession` hook + leave PracticePage big but tidier**

**Decision:** Create `web/src/audio/hooks/useScoreSession.ts`. Move:
- `expected[]` state
- `currentIndex` cursor
- `IncrementalMatcher` instance (held in a `useRef`)
- the `currentBeat` ticker (a `requestAnimationFrame` loop driven by `audioContext.currentTime`)
- a `liveScoredNotes` array (already-matched `ScoredNote[]`)
- the auto-advance grace-period check

Leave in `PracticePage.tsx`:
- mic + segmenter lifecycle (already there)
- BPM input
- score-loader UI (just wires the hook)
- lane rendering (just reads from the hook)

**Reasoning:** the existing `STATUS.md` gotcha #4 explicitly flags PracticePage as "approaching too much in one component". This is the moment to start splitting. `useScoreSession` is also exactly the boundary where Mode A vs Mode B will diverge later (Stage 7+), so getting the seam right now pays for itself.

### 1.4 Lane rendering — **rAF-driven transform, not React render cycle**

**Decision:** `<NoteLane>` is a single React component that mounts once per score. It runs its own `requestAnimationFrame` loop reading `audioContext.currentTime - audioStartPerfNow/1000` (the `performance.now()` anchor that already exists in `useAudioContext`) to compute `currentBeat`. Each frame, it sets a single CSS transform (`translateX(-currentBeat * PX_PER_BEAT + NOW_LINE_OFFSET)`) on a child `<div>` that contains all expected-note blocks.

**Why not re-render React on every frame?**
- A typical 60-note piece re-rendered at 60fps with React reconciliation would be wasteful and visibly jittery when the segmenter emits notes.
- A single `transform: translateX(...)` on a wrapper `<div>` is GPU-composited and smooth.

**Block layout (per ExpectedNote):**
- `x = startBeat * PX_PER_BEAT` (offset relative to the wrapper)
- `y = (HIGHEST_MIDI − midi) * PX_PER_SEMITONE` — pitch on the y-axis, low notes at bottom
- `width = durationBeats * PX_PER_BEAT`
- `height = PX_PER_SEMITONE`
- `background-color`:
  - default (upcoming, never attempted): neutral gray
  - active (current): bright highlight border
  - completed-perfect: green
  - completed-ok: yellow
  - completed-miss: red

**Constants** live in a new `web/src/audio/laneConfig.ts` file (pure module — easy to tune):
```ts
export const LANE_CONFIG = {
  PX_PER_BEAT: 120,
  PX_PER_SEMITONE: 8,
  NOW_LINE_OFFSET_PX: 80,   // "now" line sits this far from the left edge
  VISIBLE_BEATS_BEFORE: 2,  // how far left of "now" we keep rendering
  VISIBLE_BEATS_AFTER: 8,   // how far right of "now" we render
  DEFAULT_MIDI_RANGE: { low: 55, high: 84 }, // G3..C6 default
  GRACE_BEATS: 2,           // auto-advance after this many beats past end of active note
};
```

The defaults are conservative; tuning happens during playtest.

---

## 2. Bundled score library — candidate list

All files live under `web/public/scores/` and are referenced by a new `web/public/scores/manifest.json`. Each piece is loaded by `fetch()` with `import.meta.env.BASE_URL` (Vite base path is `/PitchQuest/`).

The MusicXML license landscape is messy. The list below mixes (a) pieces I am confident are PD, (b) pieces that are *almost certainly* PD but need a final license check, and (c) pieces marked "needs verification". The plan's first task (Task 1) explicitly includes verifying licenses before committing files.

| # | Title | Composer | Why PD | Difficulty | License status |
|---|---|---|---|---|---|
| 1 | C major scale (single octave) | n/a | n/a | trivial | safe — generate inline |
| 2 | Ode to Joy | Beethoven (1824) | author died >100y ago | easy | safe |
| 3 | Twinkle Twinkle Little Star | traditional | folk melody | easy | safe |
| 4 | Mary Had a Little Lamb | traditional | folk melody | easy | safe |
| 5 | Happy Birthday | Hill/Goodman (1935) | US copyright expired | easy | safe |
| 6 | When the Saints Go Marching In | traditional | folk melody | easy | safe |
| 7 | Frère Jacques | traditional | folk melody | easy | safe |
| 8 | Au Clair de la Lune | traditional (18th-c. French folk) | folk melody | easy | safe |
| 9 | Scarborough Fair | traditional English | folk melody | easy | safe |
| 10 | Greensleeves | traditional English | folk melody | medium | safe |
| 11 | Amazing Grace | traditional (lyrics 1779) | folk melody | medium | safe |
| 12 | Minuet in G (BWV Anh. 114 / 116) | attributed to J.S. Bach (actually Petzold) | pre-1928 | medium | safe |
| 13 | Prelude in C (BWV 846) | J.S. Bach (1722) | author died >200y ago | medium | safe |
| 14 | Air on the G String (BWV 1068) | J.S. Bach (1731) | author died >200y ago | medium | safe |
| 15 | Gymnopédie No. 1 | Erik Satie (1888) | author died >100y ago | medium | safe |
| 16 | Can Can (Orpheus in the Underworld) | Offenbach (1858) | author died >100y ago | hard | safe |
| 17 | Eine kleine Nachtmusik (theme) | Mozart (1787) | author died >200y ago | medium | safe |
| 18 | Turkish March (Rondo Alla Turca) | Mozart (1783) | author died >200y ago | hard | safe |
| 19 | Für Elise | Beethoven (1810) | author died >100y ago | hard | safe |
| 20 | Pachelbel's Canon in D | Pachelbel (c. 1680) | author died >300y ago | hard | safe |
| 21 | Jingle Bells | James Lord Pierpont (1857) | author died >100y ago | easy | safe |
| 22 | Silent Night | Franz Xaver Gruber (1818) | author died >100y ago | easy | safe |

That's 22 candidates — comfortably above the 20-piece floor. The first 4 (Twinkle, Mary Had a Little Lamb, Ode to Joy, Frère Jacques) are the recommended "easy starter set" to ship first; the rest are filled in by Task 1.

**MusicXML source preference:** Mutopia Project (`https://www.mutopiaproject.org/`) and IMSLP (`https://imslp.org/`) host pre-made MusicXML. Where neither has the piece, Task 1 generates a minimal MusicXML by hand (the format is small — see `MusicXmlParser.ts` for the supported subset: single part, no chord, no transpose, etc.).

**`manifest.json` shape:**
```json
[
  {
    "id": "twinkle-twinkle-little-star",
    "title": "Twinkle, Twinkle, Little Star",
    "composer": "Traditional",
    "difficulty": "easy",
    "file": "twinkle-twinkle-little-star.musicxml",
    "bpm": 90,
    "license": "public domain, traditional folk melody"
  }
]
```

`bpm` is per-piece — each piece knows its own tempo.

---

## 3. Task breakdown

Each task is sized for one worker in one shot. Dependencies listed as "depends on X" / "independent" are explicit.

---

### Task 1 — Score library (manifest + bundle 4 starter pieces)

**Files touched:**
- New: `web/public/scores/manifest.json`
- New: `web/public/scores/twinkle-twinkle-little-star.musicxml`
- New: `web/public/scores/mary-had-a-little-lamb.musicxml`
- New: `web/public/scores/ode-to-joy.musicxml`
- New: `web/public/scores/frere-jacques.musicxml`

**Objective:** Ship a working score library with 4 easy pieces (and a manifest) so Tasks 3+ can load a score by HTTP. Pieces #5-22 in the table above are filled in by a follow-on housekeeping task, not Stage 6 itself — Stage 6 only needs 4 to demonstrate the feature.

**Why 4 and not 20:** The "20 pieces" target is a *library richness* goal, not a Stage-6-correctness goal. The picker UI (Task 3) just iterates `manifest.json` and renders cards; it works for any length. Adding more pieces is mechanical.

**Acceptance:**
- `manifest.json` is valid JSON, lists 4 entries, each with `id`, `title`, `composer`, `difficulty`, `file`, `bpm`, `license`.
- Each `.musicxml` file parses with the existing `parseMusicXml` (test in the dev panel by loading each one in Task 3).
- All pieces are in the supported subset (single part, no `<chord>`, no `<transpose>`, `<type>` based durations only).
- `npm run build` still passes (no TypeScript changes, but sanity-check the bundle).
- License notes committed alongside the XML files in the manifest's `license` field per entry (each entry's `license` field says e.g. "public domain, traditional folk melody").

**Independent / depends on:** independent.

---

### Task 2 — `IncrementalMatcher` pure module + test harness

**Files touched:**
- New: `web/src/audio/IncrementalMatcher.ts`
- New: `web/src/audio/IncrementalMatcher.test-harness.ts`

**Objective:** Implement the streaming matcher as a pure class with no React/DOM dependencies. Add a harness following the same `*.test-harness.ts` shape as the other 5 modules.

**Acceptance:**
- Class implements the API in §1.1: constructor, `push`, `consumedCount` (getter), `remaining` (getter), `forceMissActive`.
- `push` returns `null` for detections outside the active window (no advance); returns a `MatchedNote` for in-window detections (cursor advances).
- `forceMissActive` returns a synthetic miss `MatchedNote` and advances the cursor. If no active note remains, throws (match the existing throw-on-invalid style — see `matchNotes` `RangeError`).
- Harness has at least 6 cases:
  1. Perfect run: 8 expected, 8 in-window pushes → 8 matches, cursor at 8.
  2. Out-of-window push is ignored: push a note at beat 100 while active is beat 0 → cursor unchanged, push returns `null`.
  3. Dropped note (no push for active) → after all remaining pushes, `forceMissActive` for each skipped note yields 8 misses.
  4. Out-of-order: push detected[2] before detected[0] → detected[2] is out of window (active is expected[0]), ignored; detected[0] matches.
  5. Empty expected list → push never advances, throws on `forceMissActive`.
  6. Wrong-pitch detected note (correct time, wrong midi) → matches by window but is scored as miss by Scorer; here we just confirm IncrementalMatcher's window match returns the MatchedNote and Scorer handles the wrong-pitch-classification downstream.
- `npx tsx -e "import { runIncrementalMatcherHarness } from './src/audio/IncrementalMatcher.test-harness'; console.log(runIncrementalMatcherHarness());"` reports **6/6 pass**.
- A new dev-panel section (Task 5) wires this in via `PracticePage.tsx`; Task 2 itself just creates the harness file.

**Independent / depends on:** independent of Tasks 3-5 (it's pure code). The hook (Task 4) depends on this.

---

### Task 3 — Score picker UI on PracticePage

**Files touched:**
- `web/src/pages/PracticePage.tsx` (small additions only — extract later in Task 6)
- New: `web/src/components/ScorePicker.tsx`

**Objective:** Add a "Load score" panel with two paths:
1. **Browse library:** fetch `${import.meta.env.BASE_URL}scores/manifest.json` on mount; render a simple grid of cards (title, composer, difficulty tag, BPM). Clicking a card fetches the matching `.musicxml`, runs it through `parseMusicXml`, and lifts the resulting `ExpectedNote[]` to PracticePage state via an `onScoreLoaded(expected, bpm)` callback prop.
2. **Upload:** a `<input type="file" accept=".xml,.musicxml,.mxl">` that reads the file via `FileReader.readAsText` and runs `parseMusicXml` on the string. If the MusicXML doesn't include `<sound tempo>`, default BPM is 80 (`DEFAULT_BPM` from TimingEngine) and a small "edit BPM" inline field shows up.

**Acceptance:**
- Library picker fetches the manifest using `${import.meta.env.BASE_URL}` (NOT hard-coded `/`) so it works under `/PitchQuest/` base path on GitHub Pages.
- Uploading a file with `<chord>` throws and the error message displays in a banner (not in the console).
- Picked/uploaded score populates `expectedNotes` state in PracticePage; this state appears at the top of the page (the live-detected log stays where it is).
- A "Clear score" button removes the loaded score.
- `npm run lint` shows 0 new errors. The 2 pre-existing `useAudioContext.ts` warnings are still acceptable.
- `npm run build` passes.

**Independent / depends on:** Task 1 (the manifest and XMLs must exist for the library picker to fetch anything). The upload path works without Task 1 (user-supplied files).

---

### Task 4 — `useScoreSession` hook + lane state wiring

**Files touched:**
- New: `web/src/audio/hooks/useScoreSession.ts`
- New: `web/src/audio/laneConfig.ts`
- `web/src/pages/PracticePage.tsx` (consume the hook)

**Objective:** Extract the per-session state machine out of PracticePage. The hook owns:
- `expected: ExpectedNote[]` (set by the picker via `setExpected`)
- `currentIndex: number`
- `IncrementalMatcher` instance (held in a `useRef` — survives re-renders)
- `liveScored: ScoredNote[]` — already-completed notes with their tier
- `activeTier: ScoreTier | null` — the tier to render on the active block (live updates as the user plays)
- A `rAF` ticker that reads `performance.now() - audioStartPerfNow` (NOT `audioContext.currentTime`) to compute `currentBeat`, fires `forceMissActive` once `currentBeat > active.startBeat + active.durationBeats + LANE_CONFIG.GRACE_BEATS`. **We deliberately do not depend on `audioContext.currentTime` in the rAF loop** — `performance.now()` is monotonic, already running, and avoids depending on the `audioContextRef.current` quirk in `useAudioContext` (which returns the ref value at render time rather than a stable ref). See §6.10.
- `consume(detected: BeatNote): ScoredNote | null` callback — exposed to PracticePage's existing segmenter effect. **Caller MUST pass `BeatNote`, not raw `DetectedNote`** — the hook uses `startBeat`/`durationBeats` for window checks. PracticePage already computes `beatNotes = useMemo(() => annotateNotes(detectedNotes, bpm))` (line 38); Task 5 wires this existing annotated array into `consume()` (not the raw `detectedNotes`).
- When `consumedCount === expected.length`, the rAF loop cancels itself and `activeTier` is set to `null` (avoids wasted CPU after the song ends).

**Acceptance:**
- Hook compiles with strict TypeScript, no `any`.
- The `rAF` loop is properly torn down when audio stops or the component unmounts (no leaks).
- React StrictMode double-mount in dev does not create two overlapping rAF loops (the hook guards via a `cancelled` flag captured in the cleanup closure).
- Calling `consume()` while audio is off returns `null` and does nothing.
- `consume()`'s parameter is typed `BeatNote` (not `DetectedNote`) so the caller's annotation step is enforced at compile time.
- `forceMissActive` path is exercised by waiting past the grace period — the `activeTier` flips to `'miss'` and `currentIndex` advances.
- `ScoredNote` for the auto-advanced miss is appended to `liveScored` with `tier: 'miss'` and the synthetic `MatchedNote.detected: null`.
- When the score is fully consumed, the rAF stops and `activeTier` is `null`.

**Independent / depends on:** Task 2 (needs `IncrementalMatcher`). Task 1 not required for the hook itself, but Task 5 (UI integration) needs both.

---

### Task 5 — `<NoteLane>` component + PracticePage integration + dev panel update

**Files touched:**
- New: `web/src/components/NoteLane.tsx`
- New: `web/src/components/NoteLane.css` (or co-located styles)
- `web/src/pages/PracticePage.tsx` (mount `<NoteLane>`, wire `consume` from hook into the segmenter effect, wire `audioContext` + `audioStartPerfNow` into the lane)

**Objective:** Render the lane and wire it to live detection. This is the "Guitar Hero" moment.

**Acceptance:**
- `<NoteLane expected={...} liveScored={...} activeIndex={...} audioContext={...} audioStartPerfNow={...} />` mounts once a score is loaded.
- Blocks translate leftward smoothly (visually verified at 60fps in the dev panel — `currentBeat` is the only thing that moves).
- Active note has a visible highlight border.
- A correctly-played note (in window, right pitch) flips the active block from gray → green/yellow within ~100ms of the detection.
- A misplayed note does NOT advance the cursor — the active block remains highlighted.
- After ~2 beats (default `GRACE_BEATS`) past `active.startBeat + active.durationBeats`, the block flips red and the cursor advances.
- When the entire score is consumed, the lane displays the final summary (`ScoreSummary`) in a small overlay (no full results screen — that's Stage 7).
- Dev panel gains a 6th section: "Incremental Matcher: 6/6 pass" wired to `runIncrementalMatcherHarness()`.
- `npm run build` and `npm run lint` pass (with the usual 2 pre-existing `useAudioContext` warnings).

**Independent / depends on:** Tasks 1, 2, 3, 4.

---

### Task 6 — Refactor PracticePage + housekeeping

**Files touched:**
- `web/src/pages/PracticePage.tsx` (slim down)
- Optionally: extract `useDevPanelHarnesses` (the 6-section dev panel) into a small hook

**Objective:** After Tasks 3-5 land, PracticePage has even more state than before. Take this opportunity to extract the 6-section dev panel rendering into its own hook so it can grow further (Stage 7's results screen harness, etc.) without bloating PracticePage.

**Acceptance:**
- PracticePage contains: mic lifecycle, BPM input, score picker (or its mount), `<NoteLane>` mount, segmenter→`consume` wiring, and the dev-panel toggle.
- A new `useDevPanelHarnesses()` hook (in `web/src/audio/hooks/`) owns the 6 useState hooks for harness results and exposes the JSX directly (or a render-prop callback).
- No behavioral changes from the user's perspective — same panels, same numbers.
- `npm run build` and `npm run lint` still pass.

**Independent / depends on:** Tasks 1-5 (this is a tidying pass after they all land).

---

## 4. Files to modify / create

**Modify:**
- `web/src/pages/PracticePage.tsx` — pick up ScorePicker, useScoreSession, NoteLane, dev-panel harness count

**Create:**
- `web/public/scores/manifest.json`
- `web/public/scores/twinkle-twinkle-little-star.musicxml`
- `web/public/scores/mary-had-a-little-lamb.musicxml`
- `web/public/scores/ode-to-joy.musicxml`
- `web/public/scores/frere-jacques.musicxml`
- `web/src/audio/IncrementalMatcher.ts`
- `web/src/audio/IncrementalMatcher.test-harness.ts`
- `web/src/audio/laneConfig.ts`
- `web/src/audio/hooks/useScoreSession.ts`
- `web/src/audio/hooks/useDevPanelHarnesses.ts` (Task 6 only)
- `web/src/components/ScorePicker.tsx`
- `web/src/components/NoteLane.tsx`
- `web/src/components/NoteLane.css` (or co-located)

---

## 5. Dependencies

```
Task 1 (scores) ─────────┐
                         ├─→ Task 3b (ScorePicker library path)
Task 2 (IncrementalMatcher + harness) ─────────────────────────────┐
                                                                   ├─→ Task 5 (NoteLane + integration)
Task 3a (ScorePicker upload path) ─────────────────────────────────┤
                                                                   ├─→ Task 4 (useScoreSession)
                                                                   ↓
                                                                 Task 6 (refactor)
```

- **Task 1** is independent.
- **Task 2** is independent.
- **Task 3a (upload path only)** is independent of Task 1 — works immediately with user-supplied files.
- **Task 3b (library path)** depends on Task 1 (manifest + XMLs must exist to be fetched).
- **Task 4** depends on Task 2 (uses `IncrementalMatcher`).
- **Task 5** depends on Tasks 1, 2, 3 (full), 4.
- **Task 6** depends on Task 5.

**Parallelizable (revised after plan review):**

- **Wave 1 (parallel):** Task 1, Task 2, Task 3a (upload).
- **Wave 2 (parallel after Wave 1):** Task 3b (library — after Task 1 lands), Task 4 (after Task 2 lands).
- **Wave 3:** Task 5 (after Wave 2 fully lands).
- **Wave 4:** Task 6 (after Task 5).

For delegation simplicity, **Task 3 ships as a single worker pass** but the worker is told to land 3a (upload) first and 3b (library) second so the upload path is testable even if Task 1 is still in flight.

---

## 6. Risks / open questions

These are decisions the user should confirm before (or during) implementation. I've made a default assumption for each, called out below; flag if you want to change them.

### 6.1 Grace-period auto-advance timing (default: **2 beats past end of note**)

**Open question:** Is 2 beats the right grace period? Too short = user gets rushed; too long = the song stalls.

**Default:** `LANE_CONFIG.GRACE_BEATS = 2` — a quarter-note-rest at most tempos. Tunable in `laneConfig.ts` without code changes elsewhere. During playtest, watch for users saying "I was about to play it!" or "the song got stuck" and adjust.

### 6.2 Lane animation framerate (default: **rAF, no cap**)

**Open question:** Do we want to throttle rAF on the lane? On a 120Hz monitor the lane re-paints 120 times/sec; that's fine for a single `transform`. On a laptop with bad battery life this might matter.

**Default:** No throttle. `requestAnimationFrame` matches the display refresh rate automatically. The cost is one `transform` write per frame, which is GPU-composited.

### 6.3 What to display between phrases (default: **empty lane, no special message**)

**Open question:** When the score has a gap (e.g., last note ends at beat 4, next starts at beat 12), the user has 8 beats of silence. What shows?

**Default:** The lane continues to scroll (the gap is just whitespace). The "now" line stays fixed at the left edge of the lane. No "wait for the next phrase" message. Rationale: matches the natural "music scrolls past you" feel and avoids modal-like interruptions. Easy to revisit if playtest shows users getting confused.

### 6.4 Octave equivalence (default: **NOT in v1**)

**Open question:** Should C4 vs C5 count as a hit? `STATUS.md` gotcha #9 flags this as a v2 candidate; current scorer reports it as `'miss'`.

**Default:** **Out of scope for Stage 6.** Stage 6 inherits the existing strict behavior. If playtest shows users stumbling on octave mistakes that *should* be ok, add a `pitchClassOnly: boolean` flag to `ScoringThresholds` in a follow-on housekeeping task. Don't add it now.

### 6.5 Number of bundled pieces in v1 (default: **4 easy pieces + manifest stub**)

**Open question:** Is "20 pieces" a hard floor or an aspiration?

**Default:** Ship 4 in Task 1 (Twinkle, Mary Had a Little Lamb, Ode to Joy, Frère Jacques). The 18-entry remainder table in this plan is the *expansion roadmap* for Tasks 1b/1c. The picker UI is content-agnostic — works for 4 or 22. If "20 in v1" is required, bump Task 1 to ship all 22 — it's mostly mechanical file authoring.

### 6.6 MusicXML license verification (default: **per-task verification, conservative list**)

**Open question:** Are all 22 candidates above actually public-domain-clear?

**Default:** All 22 are pre-1928 works or traditional folk melodies in jurisdictions where the melody itself isn't copyrightable. **All 22 marked "safe" in the table above are within that boundary.** Mutopia / IMSLP files have their own per-file licenses — Task 1 verifies each downloaded file's license header before committing. Pieces with any uncertainty ("needs verification") are dropped, not included. **This is the only risk that can fully block Task 1; resolve during that task, not after.**

### 6.7 Pitchy/audio worklet re-entrancy

**Open question:** Does calling `consume(detected)` from the segmenter's existing effect (which runs on every detected note) cause race conditions with the rAF tick in `useScoreSession`?

**Default:** No — React's effects are synchronous; the rAF loop reads the same `useRef`-backed state in the next frame. Confirmed by the pattern used in `usePitchDetection.ts` already (refs survive renders). Document this in the hook's JSDoc.

### 6.8 Where to put the lane (default: **same page, top of PracticePage**)

**Open question:** New `/play` route or extend `/practice`?

**Default:** **Same page.** Adding a new route forces the sidebar to grow and the mic/audio context lifecycle to survive navigation. PracticePage already owns all the audio plumbing — keep it there. A `/play` route is a Stage 7 candidate (session-results-screen separation).

### 6.9 Pre-existing lint errors in `useAudioContext.ts`

**Reminder:** Per `STATUS.md` gotcha #3, these 2 errors predate Stage 1 and stay. **Do not "fix while I'm in there."** Add this to Task 6's checklist as a "do not touch" reminder.

### 6.10 `useAudioContext` reactivity quirk (documented, not a Stage 6 blocker)

**Context:** `useAudioContext` returns `audioContext: audioContextRef.current` (the ref value at render time) rather than the ref object itself or a state variable. Consumers re-read the value only when something else triggers a re-render.

**Why this is NOT a Stage 6 blocker:** The plan deliberately avoids depending on `audioContext` in any rAF loop. `useScoreSession`'s rAF ticker reads `performance.now() - audioStartPerfNow` (independent of `audioContext` entirely). The `NoteLane` rAF receives `audioStartPerfNow` as a prop and reads its own `performance.now()` per frame. The existing `usePitchDetection` continues to work because PracticePage re-renders on `isStarted` change, picking up the freshly-set `audioContext`.

**Why this is worth noting:** A future Stage 7+ need for sample-accurate timing via `audioContext.currentTime` would require refactoring `useAudioContext` to expose the ref object directly (`audioContextRef`) rather than `.current`. **NOT in Stage 6 scope.** Add a backlog note.

### 6.11 `MusicXmlParser` does not read `<sound tempo>` (v1 limitation)

**Context:** `MusicXmlParser.ts` documents in its JSDoc that v1 does not parse `<key>`, `<time>`, or `<sound tempo>`. This means **every uploaded score** will fall back to a default BPM regardless of its `<sound tempo>` annotation.

**Stage 6 default:** The ScorePicker's "loaded BPM" inline edit field is **always shown** when a score is loaded (not conditional). For bundled scores, `manifest.json` carries the BPM per piece; for uploaded scores, BPM defaults to `DEFAULT_BPM` and the user edits it. ScorePicker shows a one-line hint: "Edit BPM if needed — uploaded files don't auto-detect tempo."

### 6.12 `manifest.json` fetch failure handling

**Default:** If the manifest fetch fails (network error, non-200, malformed JSON), ScorePicker renders a non-blocking error banner with the error message. The upload path remains fully functional as a fallback. If the manifest parses but is empty (`[]`), ScorePicker renders "No scores available" (distinct from the fetch-error banner).

### 6.13 `manifest.json` empty state

**Default:** Empty `[]` manifest renders "No scores available" with the upload path as the recommended next step.

---

## 7. Test harness plan

The status doc reports **34 cases total** across 5 harnesses. Stage 6 adds:

| Harness | Cases added | New total |
|---|---|---|
| NoteSegmenter | 0 | 6 |
| TimingEngine | 0 | 8 |
| MusicXmlParser | 0 | 7 |
| Matcher | 0 | 7 |
| Scorer | 1 (explicit `scoreOne` for a wrong-pitch-class case to lock the contract) | 7 |
| **IncrementalMatcher (new)** | **6** | **6** |
| **Grand total** | **+7** | **41** |

### New cases:

**`Scorer.test-harness.ts` (+1 case):**
- 7. **explicit `scoreOne` passthrough** — same fixtures as case 5 (wrong pitch class), but assert that `scoreOne(match)` returns `'miss'` independently. Locks the API for the UI consumer (Task 4's `consume`).

**`IncrementalMatcher.test-harness.ts` (+6 cases):**
- 1. Perfect run (8 expected, 8 in-window pushes → 8 matches in order).
- 2. Out-of-window push ignored (push at beat 100 while active is beat 0 → returns null, cursor unchanged).
- 3. Dropped active note + later pushes → `forceMissActive` × 1 yields one synthetic miss, later pushes still match.
- 4. Out-of-order pushes (push expected[2]'s note first) → ignored; then push expected[0]'s → matches.
- 5. Empty expected list → `push(any)` returns null, `forceMissActive` throws.
- 6. Wrong-pitch detected note (correct time, wrong midi) → IncrementalMatcher matches by window (returns MatchedNote); Scorer handles wrong-pitch-class downstream. Confirms the two layers compose.

### Harness wiring

- Each harness exports a `runIncrementalMatcherHarness(): IncrementalMatcherResult` function with the same `{ pass, fail, details }` shape as the other 5 harnesses.
- `useDevPanelHarnesses` (Task 6) mounts all 6 harnesses in one effect and exposes them to PracticePage's dev panel.
- The `cmd`-line entry point stays the same pattern: `npx tsx -e "import { runIncrementalMatcherHarness } from './src/audio/IncrementalMatcher.test-harness'; console.log(runIncrementalMatcherHarness());"`.

### What is NOT getting a harness

- `useScoreSession` (Task 4) — it's a React hook; not a pure function. It uses `requestAnimationFrame`, `AudioContext`, `performance.now()`. Testing it cleanly requires either a `vitest` setup (out of scope per `STATUS.md` gotcha #5) or a browser-level harness that's a much bigger commitment. **Skip the harness; cover with manual playtest.**
- `NoteLane` (Task 5) — same reasoning. Visual rendering is verified by running `npm run dev` and looking at it.
- `laneConfig.ts` (Task 4) — pure constants. No behavior to test.

---

## 8. Future work (Stage 7+ — out of scope for this plan)

Per `STATUS.md` and `roadmap.md`:
- **Mode B (continuous scrolling):** replace the wait-mode cursor with a continuous `currentBeat` that flows without waiting. The `IncrementalMatcher` class is already designed to handle this — Mode B would skip the `consume()` callback and just let the rAF tick advance the cursor as `currentBeat` passes `active.startBeat + active.durationBeats`.
- **Session loop / results screen:** the `ScoreSummary` is already computed by `scoreMatches`; Stage 7 just needs a results view + per-note history (the `ScoredNote[]` from `useScoreSession.liveScored` is the input).
- **Multi-voice / chords:** `MusicXmlParser.ts` currently throws on `<chord>`; Stage 8+ work.
- **Stage 3 6/8 follow-up:** already in backlog as `eb19ec46`. Independent housekeeping.
- **Fill the library out to all 22 pieces** (Tasks 1b/1c).
- **Octave-equivalence flag** in `ScoringThresholds` (per §6.4).
- **Pre-existing `useAudioContext.ts` lint errors** (per §6.9 and `STATUS.md` gotcha #3).
