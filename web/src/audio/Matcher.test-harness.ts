/**
 * Dev-only test harness for the Matcher.
 *
 * Pure function module — no React, no DOM, no I/O. Runs a battery of
 * synthetic (expected, detected) note arrays through `matchNotes` and compares
 * the emitted MatchedNote[] against hand-traced expectations.
 *
 * `matchNotes` is fully deterministic (no wall-clock, no randomness), so
 * every case below is exercised with absolute reproducibility.
 *
 * Cases cover:
 *   - perfect alignment (sanity)
 *   - constant time offset (all late / sharp)
 *   - dropped expected note (cascade through subsequent notes)
 *   - spurious detected note outside all windows (silently dropped)
 *   - detected note shifted outside its expected's window (unmatched)
 *   - empty detected list (every expected unmatched)
 */

import { matchNotes } from './Matcher';
import type { MatchedNote, MatcherOptions } from './Matcher';
import type { ExpectedNote } from '../score/types';
import type { BeatNote } from './TimingEngine';

export interface MatcherCase {
  name: string;
  expected: ExpectedNote[];
  detected: BeatNote[];
  expectedMatch: MatchedNote[];
  /** Optional matcher options override (e.g. narrower window for testing). */
  opts?: MatcherOptions;
}

export interface MatcherResult {
  pass: number;
  fail: number;
  details: { name: string; pass: boolean; diff?: string }[];
}

// ---------------------------------------------------------------------------
// Builders for compact, readable test fixtures.
// ---------------------------------------------------------------------------

function expectedNote(name: string, midi: number, startBeat: number, durationBeats: number): ExpectedNote {
  return { noteName: name, midi, startBeat, durationBeats };
}

function beatNote(name: string, midi: number, startBeat: number, durationBeats: number, avgCents: number): BeatNote {
  // startMs/durationMs are unused by the matcher; placeholders keep the
  // type satisfied.
  return {
    noteName: name,
    midi,
    startMs: 0,
    durationMs: 0,
    avgCents,
    startBeat,
    durationBeats,
  };
}

function matched(exp: ExpectedNote, det: BeatNote, timeErr: number, pitchErr: number): MatchedNote {
  return { expected: exp, detected: det, pitchErrorCents: pitchErr, timeErrorBeats: timeErr };
}

function miss(exp: ExpectedNote): MatchedNote {
  return { expected: exp, detected: null, pitchErrorCents: null, timeErrorBeats: null };
}

// Canonical C-major scale expected (each 1 beat, starting at beats 0..7).
const SCALE_EXPECTED: ExpectedNote[] = [
  expectedNote('C4', 60, 0, 1),
  expectedNote('D4', 62, 1, 1),
  expectedNote('E4', 64, 2, 1),
  expectedNote('F4', 65, 3, 1),
  expectedNote('G4', 67, 4, 1),
  expectedNote('A4', 69, 5, 1),
  expectedNote('B4', 71, 6, 1),
  expectedNote('C5', 72, 7, 1),
];

// Detected copies at exact beats, cents = 0.
const SCALE_DETECTED_EXACT: BeatNote[] = [
  beatNote('C4', 60, 0, 1, 0),
  beatNote('D4', 62, 1, 1, 0),
  beatNote('E4', 64, 2, 1, 0),
  beatNote('F4', 65, 3, 1, 0),
  beatNote('G4', 67, 4, 1, 0),
  beatNote('A4', 69, 5, 1, 0),
  beatNote('B4', 71, 6, 1, 0),
  beatNote('C5', 72, 7, 1, 0),
];

// ---------------------------------------------------------------------------
// Test cases.
// ---------------------------------------------------------------------------

export const MATCHER_CASES: MatcherCase[] = [
  // 1. Perfect alignment: 8 expected, 8 detected at exact beats, all
  //    avgCents=0. Every match should have pitchErrorCents=0 and
  //    timeErrorBeats=0.
  {
    name: 'perfect alignment (C-major scale, exact beats, 0 cents)',
    expected: SCALE_EXPECTED,
    detected: SCALE_DETECTED_EXACT,
    expectedMatch: [
      matched(SCALE_EXPECTED[0], SCALE_DETECTED_EXACT[0], 0, 0),
      matched(SCALE_EXPECTED[1], SCALE_DETECTED_EXACT[1], 0, 0),
      matched(SCALE_EXPECTED[2], SCALE_DETECTED_EXACT[2], 0, 0),
      matched(SCALE_EXPECTED[3], SCALE_DETECTED_EXACT[3], 0, 0),
      matched(SCALE_EXPECTED[4], SCALE_DETECTED_EXACT[4], 0, 0),
      matched(SCALE_EXPECTED[5], SCALE_DETECTED_EXACT[5], 0, 0),
      matched(SCALE_EXPECTED[6], SCALE_DETECTED_EXACT[6], 0, 0),
      matched(SCALE_EXPECTED[7], SCALE_DETECTED_EXACT[7], 0, 0),
    ],
  },

  // 2. All detected shifted +0.1 beats late. Every expected still has a
  //    candidate in its default [−0.5, startBeat+1+0.5] window; each match
  //    reports timeErrorBeats=+0.1 and pitchErrorCents=0.
  {
    name: 'late by 0.1 beats (constant +0.1 time offset, 0 cents)',
    expected: SCALE_EXPECTED,
    detected: SCALE_DETECTED_EXACT.map(d => beatNote(d.noteName, d.midi, d.startBeat + 0.1, d.durationBeats, 0)),
    expectedMatch: [
      matched(SCALE_EXPECTED[0], beatNote('C4', 60, 0.1, 1, 0), 0.1, 0),
      matched(SCALE_EXPECTED[1], beatNote('D4', 62, 1.1, 1, 0), 0.1, 0),
      matched(SCALE_EXPECTED[2], beatNote('E4', 64, 2.1, 1, 0), 0.1, 0),
      matched(SCALE_EXPECTED[3], beatNote('F4', 65, 3.1, 1, 0), 0.1, 0),
      matched(SCALE_EXPECTED[4], beatNote('G4', 67, 4.1, 1, 0), 0.1, 0),
      matched(SCALE_EXPECTED[5], beatNote('A4', 69, 5.1, 1, 0), 0.1, 0),
      matched(SCALE_EXPECTED[6], beatNote('B4', 71, 6.1, 1, 0), 0.1, 0),
      matched(SCALE_EXPECTED[7], beatNote('C5', 72, 7.1, 1, 0), 0.1, 0),
    ],
  },

  // 3. All detected at exact beats but uniformly +50 cents sharp. Every
  //    match has pitchErrorCents=+50 and timeErrorBeats=0.
  {
    name: 'sharp by 50 cents (constant +50 cents, exact beats)',
    expected: SCALE_EXPECTED,
    detected: SCALE_DETECTED_EXACT.map(d => beatNote(d.noteName, d.midi, d.startBeat, d.durationBeats, 50)),
    expectedMatch: [
      matched(SCALE_EXPECTED[0], beatNote('C4', 60, 0, 1, 50), 0, 50),
      matched(SCALE_EXPECTED[1], beatNote('D4', 62, 1, 1, 50), 0, 50),
      matched(SCALE_EXPECTED[2], beatNote('E4', 64, 2, 1, 50), 0, 50),
      matched(SCALE_EXPECTED[3], beatNote('F4', 65, 3, 1, 50), 0, 50),
      matched(SCALE_EXPECTED[4], beatNote('G4', 67, 4, 1, 50), 0, 50),
      matched(SCALE_EXPECTED[5], beatNote('A4', 69, 5, 1, 50), 0, 50),
      matched(SCALE_EXPECTED[6], beatNote('B4', 71, 6, 1, 50), 0, 50),
      matched(SCALE_EXPECTED[7], beatNote('C5', 72, 7, 1, 50), 0, 50),
    ],
  },

  // 4. Missed 3rd note (E4). 7 detected: drop E4 AND shift all later notes
  //    by +1 beat so they fall outside expected[2]'s [1.5, 3] window and
  //    cannot rescue it. Each subsequent expected then matches the
  //    preceding shifted detected with timeErrorBeats=+1.
  {
    name: 'missed 3rd note (E4 dropped; later notes cascade +1 beat)',
    expected: SCALE_EXPECTED,
    detected: [
      beatNote('C4', 60, 0, 1, 0),
      beatNote('D4', 62, 1, 1, 0),
      // E4@2 missing.
      beatNote('F4', 65, 4, 1, 0),
      beatNote('G4', 67, 5, 1, 0),
      beatNote('A4', 69, 6, 1, 0),
      beatNote('B4', 71, 7, 1, 0),
      beatNote('C5', 72, 8, 1, 0),
    ],
    expectedMatch: [
      matched(SCALE_EXPECTED[0], beatNote('C4', 60, 0, 1, 0), 0, 0),
      matched(SCALE_EXPECTED[1], beatNote('D4', 62, 1, 1, 0), 0, 0),
      miss(SCALE_EXPECTED[2]),
      matched(SCALE_EXPECTED[3], beatNote('F4', 65, 4, 1, 0), 1, 0),
      matched(SCALE_EXPECTED[4], beatNote('G4', 67, 5, 1, 0), 1, 0),
      matched(SCALE_EXPECTED[5], beatNote('A4', 69, 6, 1, 0), 1, 0),
      matched(SCALE_EXPECTED[6], beatNote('B4', 71, 7, 1, 0), 1, 0),
      matched(SCALE_EXPECTED[7], beatNote('C5', 72, 8, 1, 0), 1, 0),
    ],
  },

  // 5. Spurious detected note way outside every expected's window is
  //    silently dropped by the extras policy. 8 expected, 9 detected.
  {
    name: 'extra detected note outside all windows is silently dropped',
    expected: SCALE_EXPECTED,
    detected: [
      ...SCALE_DETECTED_EXACT,
      beatNote('E5', 76, 10, 1, 0), // way past the last expected window [6.5, 8.5]
    ],
    expectedMatch: [
      matched(SCALE_EXPECTED[0], SCALE_DETECTED_EXACT[0], 0, 0),
      matched(SCALE_EXPECTED[1], SCALE_DETECTED_EXACT[1], 0, 0),
      matched(SCALE_EXPECTED[2], SCALE_DETECTED_EXACT[2], 0, 0),
      matched(SCALE_EXPECTED[3], SCALE_DETECTED_EXACT[3], 0, 0),
      matched(SCALE_EXPECTED[4], SCALE_DETECTED_EXACT[4], 0, 0),
      matched(SCALE_EXPECTED[5], SCALE_DETECTED_EXACT[5], 0, 0),
      matched(SCALE_EXPECTED[6], SCALE_DETECTED_EXACT[6], 0, 0),
      matched(SCALE_EXPECTED[7], SCALE_DETECTED_EXACT[7], 0, 0),
    ],
  },

  // 6. Detected[3] (F4) is shifted to beat 4.1 — outside expected[3]'s
  //    default window [2.5, 4] (4.1 > 4). With greedy left-to-right
  //    matching, expected[3]'s only in-window candidate is detected[4]
  //    (G4@4, exactly at the upper window edge). So expected[3] "steals"
  //    G4 with timeErrorBeats=+1. Then expected[4] (G4, window [3.5, 5])
  //    picks up the now-unused detected[3] (F4@4.1, err=0.1) as its best
  //    candidate. This is the documented cross-note window-stealing
  //    artifact of the greedy + symmetric-window algorithm (see Matcher
  //    header for v1 limitations). The case exercises: out-of-window
  //    shift + greedy reassignment.
  {
    name: 'detected[3] shifted +1.1 beats → cross-note window steal (F4→G4, G4→F4)',
    expected: SCALE_EXPECTED,
    detected: [
      beatNote('C4', 60, 0, 1, 0),
      beatNote('D4', 62, 1, 1, 0),
      beatNote('E4', 64, 2, 1, 0),
      beatNote('F4', 65, 4.1, 1, 0), // shifted: would-be expected[3], lands at beat 4.1
      beatNote('G4', 67, 4, 1, 0),
      beatNote('A4', 69, 5, 1, 0),
      beatNote('B4', 71, 6, 1, 0),
      beatNote('C5', 72, 7, 1, 0),
    ],
    expectedMatch: [
      matched(SCALE_EXPECTED[0], beatNote('C4', 60, 0, 1, 0), 0, 0),
      matched(SCALE_EXPECTED[1], beatNote('D4', 62, 1, 1, 0), 0, 0),
      matched(SCALE_EXPECTED[2], beatNote('E4', 64, 2, 1, 0), 0, 0),
      // expected[3] (F4) steals detected[4] G4@4 (err=1) — only in-window candidate.
      matched(SCALE_EXPECTED[3], beatNote('G4', 67, 4, 1, 0), 1, 0),
      // expected[4] (G4) now picks up detected[3] F4@4.1 (err=0.1).
      matched(SCALE_EXPECTED[4], beatNote('F4', 65, 4.1, 1, 0), 0.1, 0),
      matched(SCALE_EXPECTED[5], beatNote('A4', 69, 5, 1, 0), 0, 0),
      matched(SCALE_EXPECTED[6], beatNote('B4', 71, 6, 1, 0), 0, 0),
      matched(SCALE_EXPECTED[7], beatNote('C5', 72, 7, 1, 0), 0, 0),
    ],
  },

  // 7. Empty detected list: every expected is unmatched. This exercises
  //    the no-candidate branch of matchNotes.
  {
    name: 'empty detected list → all 8 expected unmatched',
    expected: SCALE_EXPECTED,
    detected: [],
    expectedMatch: [
      miss(SCALE_EXPECTED[0]),
      miss(SCALE_EXPECTED[1]),
      miss(SCALE_EXPECTED[2]),
      miss(SCALE_EXPECTED[3]),
      miss(SCALE_EXPECTED[4]),
      miss(SCALE_EXPECTED[5]),
      miss(SCALE_EXPECTED[6]),
      miss(SCALE_EXPECTED[7]),
    ],
  },
];

/** Allowed slack on `timeErrorBeats` to absorb float wobble. */
const BEAT_TOLERANCE = 0.005;

/**
 * Compare two BeatNote values field-by-field and return a human-readable
 * diff message, or undefined if they agree. Accepting BeatNote (not
 * BeatNote | null) is what gives us the narrowing we need without casts.
 */
function compareBeatNotes(a: BeatNote, e: BeatNote, i: number): string | undefined {
  if (a.noteName !== e.noteName) {
    return `case[${i}].detected.noteName: expected ${e.noteName}, got ${a.noteName}`;
  }
  if (a.midi !== e.midi) {
    return `case[${i}].detected.midi: expected ${e.midi}, got ${a.midi}`;
  }
  if (Math.abs(a.startBeat - e.startBeat) > BEAT_TOLERANCE) {
    return `case[${i}].detected.startBeat: expected ${e.startBeat}, got ${a.startBeat}`;
  }
  if (Math.abs(a.durationBeats - e.durationBeats) > BEAT_TOLERANCE) {
    return `case[${i}].detected.durationBeats: expected ${e.durationBeats}, got ${a.durationBeats}`;
  }
  if (a.avgCents !== e.avgCents) {
    return `case[${i}].detected.avgCents: expected ${e.avgCents}, got ${a.avgCents}`;
  }
  return undefined;
}

function diffCase(actual: MatchedNote[], expected: MatchedNote[]): string | undefined {
  if (actual.length !== expected.length) {
    return `expected length ${expected.length}, got ${actual.length}`;
  }
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];

    // expected.noteName / midi / startBeat / durationBeats must match exactly.
    if (a.expected.noteName !== e.expected.noteName) {
      return `case[${i}].expected.noteName: expected ${e.expected.noteName}, got ${a.expected.noteName}`;
    }
    if (a.expected.midi !== e.expected.midi) {
      return `case[${i}].expected.midi: expected ${e.expected.midi}, got ${a.expected.midi}`;
    }
    if (Math.abs(a.expected.startBeat - e.expected.startBeat) > BEAT_TOLERANCE) {
      return `case[${i}].expected.startBeat: expected ${e.expected.startBeat}, got ${a.expected.startBeat}`;
    }
    if (Math.abs(a.expected.durationBeats - e.expected.durationBeats) > BEAT_TOLERANCE) {
      return `case[${i}].expected.durationBeats: expected ${e.expected.durationBeats}, got ${a.expected.durationBeats}`;
    }

    // detected must be null-or-not-null consistently with the expectation.
    // TypeScript's control-flow narrowing only persists across direct
    // property accesses, not separate boolean variables — so we re-check
    // `a.detected !== null && e.detected !== null` inline below to narrow
    // both fields to BeatNote.
    const aDetPresent = a.detected !== null;
    const eDetPresent = e.detected !== null;
    if (aDetPresent !== eDetPresent) {
      return `case[${i}].detected: expected ${eDetPresent ? 'set' : 'null'}, got ${aDetPresent ? 'set' : 'null'}`;
    }
    if (a.detected !== null && e.detected !== null) {
      // MatchedNote.detected is typed BeatNote | null (widened in Matcher.ts
      // from DetectedNote | null). The inline null-checks above narrow
      // both `a.detected` and `e.detected` to BeatNote for the helper call.
      const dDiff = compareBeatNotes(a.detected, e.detected, i);
      if (dDiff !== undefined) return dDiff;
    }

    // pitchErrorCents and timeErrorBeats must mirror null-ness and (when
    // present) match within tolerance.
    if (a.pitchErrorCents !== e.pitchErrorCents) {
      return `case[${i}].pitchErrorCents: expected ${e.pitchErrorCents}, got ${a.pitchErrorCents}`;
    }
    if (a.timeErrorBeats === null && e.timeErrorBeats === null) continue;
    if (a.timeErrorBeats === null || e.timeErrorBeats === null) {
      return `case[${i}].timeErrorBeats: expected ${e.timeErrorBeats}, got ${a.timeErrorBeats}`;
    }
    if (Math.abs(a.timeErrorBeats - e.timeErrorBeats) > BEAT_TOLERANCE) {
      return `case[${i}].timeErrorBeats: expected ${e.timeErrorBeats}, got ${a.timeErrorBeats}`;
    }
  }
  return undefined;
}

export function runMatcherHarness(): MatcherResult {
  const details: MatcherResult['details'] = [];
  let pass = 0;
  let fail = 0;

  for (const c of MATCHER_CASES) {
    let actual: MatchedNote[];
    let runtimeError: string | undefined;
    try {
      actual = matchNotes(c.expected, c.detected, c.opts);
    } catch (err) {
      runtimeError = err instanceof Error ? err.message : String(err);
      actual = [];
    }

    const diff = runtimeError !== undefined ? `matcher threw: ${runtimeError}` : diffCase(actual, c.expectedMatch);
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
