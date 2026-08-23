/**
 * Dev-only test harness for the NoteSegmenter.
 *
 * Pure function module — no React, no DOM, no I/O. Runs a battery of
 * synthetic frame sequences through a fresh NoteSegmenter and compares the
 * emitted DetectedNote[] against hand-traced expectations.
 *
 * Caveat: the "silence gap finalizes" branch of NoteSegmenter relies on
 * `performance.now()` (wall-clock), so it can't be exercised deterministically
 * from a synthetic harness. The "null frame is safe" case below is included
 * only as a smoke test that `push(null)` does not throw — the resulting
 * in-flight note would be too short (46ms < minNoteMs=80) anyway, so the
 * empty result holds whether or not the wall-clock finalizes.
 */

import { NoteSegmenter } from './NoteSegmenter';
import type { DetectedNote } from './types';
import type { PitchData } from './hooks/usePitchDetection';

export interface HarnessCase {
  name: string;
  input: (PitchData | null)[];
  /** If true, `flush()` is called after the input. */
  flush?: boolean;
  expected: DetectedNote[];
}

export interface HarnessResult {
  pass: number;
  fail: number;
  details: { name: string; pass: boolean; diff?: string }[];
}

function frame(noteName: string, frequency: number, cents: number, timestamp: number): PitchData {
  return { noteName, frequency, clarity: 0.95, cents, timestamp };
}

export const HARNESS_CASES: HarnessCase[] = [
  // Case 1: a single monotone note.
  //   frame0 (ts=0): startNote — centsSum=0, centsCount=1, attackDeadline=50
  //   frame1 (ts=46): in attack window, ignored entirely
  //   frame2 (ts=92): same note — centsSum=-3, centsCount=2
  //   flush: endTs=92, duration=92, avgCents=round(-3/2)=round(-1.5)=-1
  //   (JS Math.round rounds .5 toward +Infinity, so Math.round(-1.5) === -1)
  {
    name: 'monotone C4',
    input: [
      frame('C4', 262, 0, 0),
      frame('C4', 262, 5, 46),
      frame('C4', 262, -3, 92),
    ],
    flush: true,
    expected: [{ noteName: 'C4', midi: 60, startMs: 0, durationMs: 92, avgCents: -1 }],
  },

  // Case 2: smoke test for push(null). The in-flight C4 (46ms) is below
  // minNoteMs=80 regardless of whether the silence branch fires, so the
  // empty result is deterministic. We do NOT assert a silence-finalization
  // behavior here — that depends on wall-clock time.
  {
    name: 'null frame is safe (smoke)',
    input: [
      frame('C4', 262, 0, 0),
      frame('C4', 262, 0, 46),
      null,
    ],
    flush: true,
    expected: [],
  },

  // Case 3: a 400-cent pitch jump inside the attack-ignore window is
  // suppressed. On flush the note is too short (46ms < 80ms) and dropped.
  {
    name: 'pitch jump within attack window is ignored',
    input: [
      frame('C4', 262, 0, 0),
      frame('E4', 330, 0, 46), // 400-cent jump, ts 46 < attackDeadline 50
    ],
    flush: true,
    expected: [],
  },

  // Case 4: same 400-cent jump, 50ms later — outside the attack window,
  // so C4 is finalized (100ms) and a new E4 is started. E4 in-flight at
  // flush has duration 0, which is below minNoteMs and is dropped.
  {
    name: 'pitch jump outside attack window finalizes first note',
    input: [
      frame('C4', 262, 0, 0),
      frame('E4', 330, 0, 100), // 400-cent jump, ts 100 >= attackDeadline 50
    ],
    flush: true,
    expected: [{ noteName: 'C4', midi: 60, startMs: 0, durationMs: 100, avgCents: 0 }],
  },

  // Case 5: long note that survives flush.
  //   frame0 (ts=0):  startNote — centsSum=0,  centsCount=1, attackDeadline=50
  //   frame1 (ts=46): in attack window, ignored
  //   frame2 (ts=92): same note — centsSum=-3, centsCount=2
  //   frame3 (ts=138): same note — centsSum=-1, centsCount=3
  //   flush: duration=138, avgCents=round(-1/3)=round(-0.333)=0
  {
    name: 'long note then flush',
    input: [
      frame('C4', 262, 0, 0),
      frame('C4', 262, 5, 46),
      frame('C4', 262, -3, 92),
      frame('C4', 262, 2, 138),
    ],
    flush: true,
    expected: [{ noteName: 'C4', midi: 60, startMs: 0, durationMs: 138, avgCents: 0 }],
  },

  // Case 6: two distinct notes via a 200-cent pitch jump.
  //   frame0 (ts=0):   startNote(C4) — centsSum=0, count=1
  //   frame1 (ts=46):  in attack window, ignored
  //   frame2 (ts=92):  same C4 — centsSum=0, count=2
  //   frame3 (ts=200): 200-cent jump -> finalize C4 (duration=200, avg=0),
  //                    startNote(D4) with attackDeadline=250
  //   frame4 (ts=246): in D4 attack window, ignored
  //   frame5 (ts=292): same D4 — centsSum=0, count=2
  //   flush: D4 finalized (duration=92, avg=0)
  {
    name: 'two distinct notes via pitch jump',
    input: [
      frame('C4', 262, 0, 0),
      frame('C4', 262, 0, 46),
      frame('C4', 262, 0, 92),
      frame('D4', 294, 0, 200),
      frame('D4', 294, 0, 246),
      frame('D4', 294, 0, 292),
    ],
    flush: true,
    expected: [
      { noteName: 'C4', midi: 60, startMs: 0, durationMs: 200, avgCents: 0 },
      { noteName: 'D4', midi: 62, startMs: 200, durationMs: 92, avgCents: 0 },
    ],
  },
];

/** Allowed slack on `durationMs` to absorb tiny arithmetic wobble. */
const DURATION_TOLERANCE_MS = 5;

function diffCase(actual: DetectedNote[], expected: DetectedNote[]): string | undefined {
  if (actual.length !== expected.length) {
    return `expected length ${expected.length}, got ${actual.length}`;
  }
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];
    if (a.noteName !== e.noteName) {
      return `case[${i}].noteName: expected ${e.noteName}, got ${a.noteName}`;
    }
    if (a.midi !== e.midi) {
      return `case[${i}].midi: expected ${e.midi}, got ${a.midi}`;
    }
    if (a.startMs !== e.startMs) {
      return `case[${i}].startMs: expected ${e.startMs}, got ${a.startMs}`;
    }
    if (Math.abs(a.durationMs - e.durationMs) > DURATION_TOLERANCE_MS) {
      return `case[${i}].durationMs: expected ${e.durationMs}, got ${a.durationMs}`;
    }
    if (a.avgCents !== e.avgCents) {
      return `case[${i}].avgCents: expected ${e.avgCents}, got ${a.avgCents}`;
    }
  }
  return undefined;
}

export function runSegmenterHarness(): HarnessResult {
  const details: HarnessResult['details'] = [];
  let pass = 0;
  let fail = 0;

  for (const c of HARNESS_CASES) {
    const segmenter = new NoteSegmenter();
    const emitted: DetectedNote[] = [];
    for (const f of c.input) {
      emitted.push(...segmenter.push(f));
    }
    if (c.flush) {
      emitted.push(...segmenter.flush());
    }

    const diff = diffCase(emitted, c.expected);
    if (diff === undefined) {
      pass += 1;
      details.push({ name: c.name, pass: true });
    } else {
      fail += 1;
      details.push({ name: c.name, pass: false, diff });
    }
  }

  return { pass, fail, details };
}