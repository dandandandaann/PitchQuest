/**
 * Dev-only test harness for IncrementalMatcher.
 *
 * Mirrors the shape of the existing 5 harnesses (Matcher, Scorer, etc.).
 * Exercises the stateful push/forceMissActive API against synthetic fixtures.
 *
 * Cases:
 *   1. Perfect run — 8 expected quarter notes, 8 in-window pushes in order.
 *   2. Out-of-window push ignored — push at beat 100 while active is beat 0.
 *   3. Dropped note + forceMissActive — one missed note, later pushes still hit.
 *   4. Out-of-order pushes — push expected[2]'s note first (ignored), then expected[0].
 *   5. Empty expected list — push always null, forceMissActive throws.
 *   6. Wrong-pitch detected note (correct time, wrong MIDI) — window matches, returns MatchedNote.
 *   7. consumedCount + remaining getters — reflect live cursor state.
 *   8. rewind — undo a push so the same expected note is active again.
 */

import { IncrementalMatcher } from './IncrementalMatcher';
import type { MatchedNote } from './Matcher';
import type { ExpectedNote } from '../score/types';
import type { BeatNote } from './TimingEngine';

// ---------------------------------------------------------------------------
// Builders (mirrors Matcher.test-harness.ts style)
// ---------------------------------------------------------------------------

function expectedNote(
  noteName: string,
  midi: number,
  startBeat: number,
  durationBeats: number,
): ExpectedNote {
  return { noteName, midi, startBeat, durationBeats };
}

function beatNote(
  noteName: string,
  midi: number,
  startBeat: number,
  durationBeats: number,
  avgCents: number,
): BeatNote {
  return { noteName, midi, startMs: 0, durationMs: 0, avgCents, startBeat, durationBeats };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** 8 quarter notes at beats 0..7 (C-major scale). */
const SCALE: ExpectedNote[] = [
  expectedNote('C4', 60, 0, 1),
  expectedNote('D4', 62, 1, 1),
  expectedNote('E4', 64, 2, 1),
  expectedNote('F4', 65, 3, 1),
  expectedNote('G4', 67, 4, 1),
  expectedNote('A4', 69, 5, 1),
  expectedNote('B4', 71, 6, 1),
  expectedNote('C5', 72, 7, 1),
];

// ---------------------------------------------------------------------------
// Harness result shape (matches existing harnesses)
// ---------------------------------------------------------------------------

export interface HarnessResult {
  pass: number;
  fail: number;
  details: { name: string; pass: boolean; diff?: string }[];
}

// ---------------------------------------------------------------------------
// Case definitions
// ---------------------------------------------------------------------------

type CaseFn = () => { name: string; pass: boolean; diff?: string };

function assert(
  name: string,
  got: unknown,
  expected: unknown,
): { name: string; pass: boolean; diff?: string } {
  // Use deep-ish equality for objects; primitives via `===`.
  const pass =
    (got === expected) ||
    (typeof got === 'object' && typeof expected === 'object' && JSON.stringify(got) === JSON.stringify(expected));

  return {
    name,
    pass: Boolean(pass),
    diff: pass ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`,
  };
}

const CASES: CaseFn[] = [
  // -------------------------------------------------------------------------
  // Case 1 — Perfect run: 8 expected, 8 in-window pushes in order.
  // -------------------------------------------------------------------------
  () => {
    const m = new IncrementalMatcher(SCALE);
    const matches: (MatchedNote | null)[] = [];
    for (let i = 0; i < SCALE.length; i++) {
      const detected = beatNote(SCALE[i].noteName, SCALE[i].midi, SCALE[i].startBeat, 1, 0);
      matches.push(m.push(detected));
    }

    const allMatched = matches.every((r): r is MatchedNote => r !== null);
    const a1 = assert('8 pushes all returned MatchedNote (not null)', allMatched, true);
    const a2 = assert('consumedCount is 8', m.consumedCount, 8);
    const a3 = assert('remaining is empty', m.remaining, []);
    const a4 = assert('active is null', m.active, null);

    return { name: 'Perfect run: 8 expected + 8 in-window pushes', pass: a1.pass && a2.pass && a3.pass && a4.pass, diff: [a1, a2, a3, a4].find(x => !x.pass)?.diff };
  },

  // -------------------------------------------------------------------------
  // Case 2 — Out-of-window push ignored: push at beat 100 while active is beat 0.
  // -------------------------------------------------------------------------
  () => {
    const m = new IncrementalMatcher([expectedNote('C4', 60, 0, 1)]);

    // Push way out of window.
    const result = m.push(beatNote('C4', 60, 100, 1, 0));

    const a1 = assert('out-of-window push returned null', result, null);
    const a2 = assert('consumedCount still 0', m.consumedCount, 0);
    const a3 = assert('active still points to the first note', m.active?.noteName, 'C4');

    return { name: 'Out-of-window push ignored (beat 100 vs active beat 0)', pass: a1.pass && a2.pass && a3.pass, diff: [a1, a2, a3].find(x => !x.pass)?.diff };
  },

  // -------------------------------------------------------------------------
  // Case 3 — Dropped active note + later pushes + forceMissActive.
  //   3 expected at beats 0, 2, 4 (spaced 2 beats apart; with ±0.5 window
  //   the windows are [−0.5, 1.5], [1.5, 3.5], [3.5, 5.5] — no overlap).
  //   Push nothing for #0 (beat 0).
  //   Push #1 at beat 2 (matches D4).
  //   Push #2 at beat 4 (matches E4).
  //   forceMissActive() once → synthetic miss for #0 (C4).
  //   Final consumedCount=3.
  // -------------------------------------------------------------------------
  () => {
    const notes = [
      expectedNote('C4', 60, 0, 1),
      expectedNote('D4', 62, 2, 1),   // beat 2 — out of C4's window [-0.5, 1.5]
      expectedNote('E4', 64, 4, 1),   // beat 4 — out of D4's window [1.5, 3.5]
    ];
    const m = new IncrementalMatcher(notes);

    // C4@0 (active): pushes D4@2 and E4@4 are both OUTSIDE C4@0's
    // window [-0.5, 1.5], so both return null.
    const r1 = m.push(beatNote('D4', 62, 2, 1, 0));
    const r2 = m.push(beatNote('E4', 64, 4, 1, 0));
    // (asserted below alongside the other checks)

    // Note #0 (C4@0) was never pushed — force it to miss.
    // Cursor advances to index 1; active becomes D4@2.
    const miss = m.forceMissActive();

    // Now D4@2 IS in its own window [1.5, 3.5] — matches as expected[1].
    const hit1 = m.push(beatNote('D4', 62, 2, 1, 0));
    // E4@4 is in D4@2's window [1.5, 3.5] — matches expected[1] again
    // (greedy: cursor would advance to index 2, but then E4@4 falls in
    // E4@4's own window [3.5, 5.5] for the next step).
    const hit2 = m.push(beatNote('E4', 64, 4, 1, 0));

    const a1 = assert('hit1 returned MatchedNote', hit1 !== null, true);
    const a2 = assert('hit1 matched D4', hit1?.expected.noteName, 'D4');
    const a3 = assert('hit2 returned MatchedNote', hit2 !== null, true);
    const a4 = assert('hit2 matched E4', hit2?.expected.noteName, 'E4');
    const a5 = assert('miss detected is null', miss.detected, null);
    const a6 = assert('miss matched C4', miss.expected.noteName, 'C4');
    const a7 = assert('consumedCount is 3', m.consumedCount, 3);
    const a8 = assert('active is null', m.active, null);

    const n1 = assert('first out-of-window push returned null', r1, null);
    const n2 = assert('second out-of-window push returned null', r2, null);
    const all = [a1, a2, a3, a4, a5, a6, a7, a8, n1, n2];
    return { name: 'Dropped active note + later pushes + forceMissActive', pass: all.every(x => x.pass), diff: all.find(x => !x.pass)?.diff };
  },

  // -------------------------------------------------------------------------
  // Case 4 — Out-of-order pushes: push expected[2]'s note first (out of
  // window for active=0), then push expected[0] (in window).
  // -------------------------------------------------------------------------
  () => {
    const notes = [
      expectedNote('C4', 60, 0, 1),
      expectedNote('D4', 62, 1, 1),
      expectedNote('E4', 64, 2, 1),
    ];
    const m = new IncrementalMatcher(notes);

    // Push expected[2]'s note (E4) first — out of window for active C4@0.
    const r1 = m.push(beatNote('E4', 64, 2, 1, 0));
    // Push expected[0]'s note (C4) second — now in window.
    const r2 = m.push(beatNote('C4', 60, 0, 1, 0));

    const a1 = assert('first push (E4 out-of-window) returned null', r1, null);
    const a2 = assert('second push (C4 in-window) returned MatchedNote', r2 !== null, true);
    const a3 = assert('second push matched C4', r2?.expected.noteName, 'C4');
    const a4 = assert('consumedCount is 1', m.consumedCount, 1);

    const all = [a1, a2, a3, a4];
    return { name: 'Out-of-order pushes (expected[2] first → ignored, then expected[0])', pass: all.every(x => x.pass), diff: all.find(x => !x.pass)?.diff };
  },

  // -------------------------------------------------------------------------
  // Case 5 — Empty expected list.
  // -------------------------------------------------------------------------
  () => {
    const m = new IncrementalMatcher([]);

    // push always returns null.
    const r1 = m.push(beatNote('C4', 60, 0, 1, 0));
    const a1 = assert('push returns null on empty list', r1, null);
    const a2 = assert('consumedCount is 0', m.consumedCount, 0);
    const a3 = assert('remaining is []', m.remaining, []);
    const a4 = assert('active is null', m.active, null);

    // forceMissActive throws.
    let threw = false;
    let throwMsg = '';
    try {
      m.forceMissActive();
    } catch (err) {
      threw = true;
      throwMsg = err instanceof Error ? err.message : String(err);
    }
    const a5 = assert('forceMissActive threw', threw, true);
    const a6 = assert('error message is "No active note to force-miss"', throwMsg, 'No active note to force-miss');

    const all = [a1, a2, a3, a4, a5, a6];
    return { name: 'Empty expected list', pass: all.every(x => x.pass), diff: all.find(x => !x.pass)?.diff };
  },

  // -------------------------------------------------------------------------
  // Case 6 — Wrong-pitch detected note at correct time: expected C4@0,
  // detected D4@0 (wrong pitch class, correct time). Window matches,
  // push returns a MatchedNote. Scorer would classify this as miss —
  // IncrementalMatcher only checks the window, not pitch class.
  // -------------------------------------------------------------------------
  () => {
    const notes = [expectedNote('C4', 60, 0, 1)];
    const m = new IncrementalMatcher(notes);

    // D4@0 is in the window for C4@0 (expected), but wrong pitch class.
    const result = m.push(beatNote('D4', 62, 0, 1, 0));

    const a1 = assert('push returned a MatchedNote (not null)', result !== null, true);
    const a2 = assert('matched expected C4', result?.expected.noteName, 'C4');
    const a3 = assert('detected is the D4 BeatNote', result?.detected?.noteName, 'D4');
    const a4 = assert('detected midi is 62 (D4)', result?.detected?.midi, 62);
    const a5 = assert('consumedCount advanced to 1', m.consumedCount, 1);

    const all = [a1, a2, a3, a4, a5];
    return { name: 'Wrong-pitch detected note (correct time, wrong MIDI) — window match returns MatchedNote', pass: all.every(x => x.pass), diff: all.find(x => !x.pass)?.diff };
  },

  // -------------------------------------------------------------------------
  // Case 7 — consumedCount and remaining getters reflect live cursor state.
  // 4 expected notes; after 2 successful pushes, consumedCount=2, remaining=2.
  // -------------------------------------------------------------------------
  () => {
    const notes = [
      expectedNote('C4', 60, 0, 1),
      expectedNote('D4', 62, 1, 1),
      expectedNote('E4', 64, 2, 1),
      expectedNote('F4', 65, 3, 1),
    ];
    const m = new IncrementalMatcher(notes);

    // Initial state.
    const init0 = assert('init: consumedCount=0', m.consumedCount, 0);
    const init1 = assert('init: remaining has 4 entries', m.remaining.length, 4);

    // Push first note.
    m.push(beatNote('C4', 60, 0, 1, 0));

    const mid0 = assert('after 1 push: consumedCount=1', m.consumedCount, 1);
    const mid1 = assert('after 1 push: remaining has 3 entries', m.remaining.length, 3);
    const mid2 = assert('after 1 push: active is D4', m.active?.noteName, 'D4');

    // Push second note.
    m.push(beatNote('D4', 62, 1, 1, 0));

    const end0 = assert('after 2 pushes: consumedCount=2', m.consumedCount, 2);
    const end1 = assert('after 2 pushes: remaining has 2 entries', m.remaining.length, 2);
    const end2 = assert('after 2 pushes: active is E4', m.active?.noteName, 'E4');
    const end3 = assert('after 2 pushes: remaining[0] is E4', m.remaining[0].noteName, 'E4');
    const end4 = assert('after 2 pushes: remaining[1] is F4', m.remaining[1].noteName, 'F4');

    const all = [init0, init1, mid0, mid1, mid2, end0, end1, end2, end3, end4];
    return { name: 'consumedCount + remaining getters reflect live cursor state', pass: all.every(x => x.pass), diff: all.find(x => !x.pass)?.diff };
  },

  // -------------------------------------------------------------------------
  // Case 8 — rewind: undo a push so the same expected note is active again.
  //   2 expected at beats 0 and 1.
  //   Push a correct detection at beat 0 → cursor advances to 1, active = expected[1].
  //   rewind → cursor back to 0, active = expected[0].
  //   Push the same detection again → matches expected[0] again.
  //   Sub-assert: rewind at cursor=0 throws RangeError.
  // -------------------------------------------------------------------------
  () => {
    const notes = [
      expectedNote('C4', 60, 0, 1),
      expectedNote('D4', 62, 1, 1),
    ];
    const m = new IncrementalMatcher(notes);

    // Initial push — C4@0 → cursor advances to 1, active = D4.
    const first = m.push(beatNote('C4', 60, 0, 1, 0));

    const a0 = assert('first push returned MatchedNote', first !== null, true);
    const a1 = assert('after first push: consumedCount=1', m.consumedCount, 1);
    const a2 = assert('after first push: active is D4', m.active?.noteName, 'D4');

    // Rewind — cursor back to 0, active = C4 again.
    m.rewind();

    const a3 = assert('after rewind: consumedCount=0', m.consumedCount, 0);
    const a4 = assert('after rewind: active is C4', m.active?.noteName, 'C4');
    const a5 = assert('after rewind: remaining has 2 entries', m.remaining.length, 2);
    const a6 = assert('after rewind: remaining[0] is C4', m.remaining[0].noteName, 'C4');

    // Push the same detection again — should match expected[0] (C4) again.
    const second = m.push(beatNote('C4', 60, 0, 1, 0));

    const a7 = assert('second push returned MatchedNote', second !== null, true);
    const a8 = assert('second push matched C4', second?.expected.noteName, 'C4');
    const a9 = assert('after second push: consumedCount=1', m.consumedCount, 1);
    const a10 = assert('after second push: active is D4', m.active?.noteName, 'D4');

    // Sub-assertion: rewind at cursor=0 throws RangeError.
    const freshMatcher = new IncrementalMatcher([expectedNote('C4', 60, 0, 1)]);
    let threw = false;
    let throwMsg = '';
    try {
      freshMatcher.rewind();
    } catch (err) {
      threw = true;
      throwMsg = err instanceof Error ? err.message : String(err);
    }
    const a11 = assert('rewind at cursor=0 threw', threw, true);
    const a12 = assert('rewind error message is correct', throwMsg, 'IncrementalMatcher.rewind: cursor already at 0');

    const all = [a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12];
    return { name: 'rewind: undo a push so the same expected note is active again', pass: all.every(x => x.pass), diff: all.find(x => !x.pass)?.diff };
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function runIncrementalMatcherHarness(): HarnessResult {
  const details: HarnessResult['details'] = [];
  let pass = 0;
  let fail = 0;

  for (const c of CASES) {
    try {
      const result = c();
      if (result.pass) {
        pass += 1;
        details.push({ name: result.name, pass: true });
      } else {
        fail += 1;
        details.push({ name: result.name, pass: false, diff: result.diff });
      }
    } catch (err) {
      fail += 1;
      details.push({
        name: c.name ?? '(unnamed case)',
        pass: false,
        diff: `case threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return { pass, fail, details };
}
