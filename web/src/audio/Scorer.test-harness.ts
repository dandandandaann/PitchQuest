/**
 * Dev-only test harness for the Scorer.
 *
 * Pure function module — no React, no DOM, no I/O. Runs a battery of
 * synthetic MatchedNote arrays through `scoreMatches` and compares the
 * emitted `ScoreResult` (per-note tiers + summary) against hand-traced
 * expectations.
 *
 * `scoreMatches` is fully deterministic (no wall-clock, no randomness), so
 * every case below is exercised with absolute reproducibility.
 *
 * Cases cover:
 *   - perfect alignment (all "perfect")
 *   - time-only drift inside "ok" window (all "ok")
 *   - time drift past "ok" window (all "miss")
 *   - one unmatched expected note → one "miss" tier
 *   - wrong pitch played (midi mismatch) → "miss" (the gap the Matcher can't see)
 *   - mixed tiers (perfect / ok / miss in one run)
 */

import { scoreMatches } from './Scorer';
import type { ScoreResult, ScoringThresholds } from './Scorer';
import type { MatchedNote } from './Matcher';
import type { ExpectedNote } from '../score/types';
import type { BeatNote } from './TimingEngine';

export interface ScorerCase {
  name: string;
  matches: MatchedNote[];
  /** Optional threshold override. Defaults to `DEFAULT_SCORING_THRESHOLDS`. */
  thresholds?: ScoringThresholds;
  expectedResult: ScoreResult;
}

export interface ScorerResult {
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
  // startMs / durationMs are unused by the scorer; placeholders keep the
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

function matched(
  expected: ExpectedNote,
  detected: BeatNote | null,
  pitchErrorCents: number | null,
  timeErrorBeats: number | null,
): MatchedNote {
  return { expected, detected, pitchErrorCents, timeErrorBeats };
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

export const SCORER_CASES: ScorerCase[] = [
  // 1. All 8 notes matched at exact beats, 0 cents → every tier is
  //    "perfect". Summary: 8/8 perfect, 0 ok, 0 miss, 100% accuracy.
  {
    name: 'all perfect (8 notes, exact beats, 0 cents)',
    matches: [
      matched(SCALE_EXPECTED[0], SCALE_DETECTED_EXACT[0], 0, 0),
      matched(SCALE_EXPECTED[1], SCALE_DETECTED_EXACT[1], 0, 0),
      matched(SCALE_EXPECTED[2], SCALE_DETECTED_EXACT[2], 0, 0),
      matched(SCALE_EXPECTED[3], SCALE_DETECTED_EXACT[3], 0, 0),
      matched(SCALE_EXPECTED[4], SCALE_DETECTED_EXACT[4], 0, 0),
      matched(SCALE_EXPECTED[5], SCALE_DETECTED_EXACT[5], 0, 0),
      matched(SCALE_EXPECTED[6], SCALE_DETECTED_EXACT[6], 0, 0),
      matched(SCALE_EXPECTED[7], SCALE_DETECTED_EXACT[7], 0, 0),
    ],
    expectedResult: {
      perNote: [
        { match: { expected: SCALE_EXPECTED[0], detected: SCALE_DETECTED_EXACT[0], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[1], detected: SCALE_DETECTED_EXACT[1], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[2], detected: SCALE_DETECTED_EXACT[2], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[3], detected: SCALE_DETECTED_EXACT[3], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[4], detected: SCALE_DETECTED_EXACT[4], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[5], detected: SCALE_DETECTED_EXACT[5], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[6], detected: SCALE_DETECTED_EXACT[6], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[7], detected: SCALE_DETECTED_EXACT[7], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
      ],
      summary: { total: 8, perfect: 8, ok: 0, miss: 0, accuracyPct: 100 },
    },
  },

  // 2. All 8 notes uniformly +0.15 beats late, 0 cents. With defaults:
  //      pitchPerfect = true  (|0| < 10)
  //      timePerfect  = false (0.15 > 0.05)
  //      timeOk       = true  (0.15 < 0.2)
  //    → every tier is "ok". Accuracy = 8 × 0.5 / 8 × 100 = 50.
  {
    name: 'slightly late, in tune → all ok (+0.15 beats, 0 cents)',
    matches: SCALE_EXPECTED.map((exp) =>
      matched(
        exp,
        beatNote(exp.noteName, exp.midi, exp.startBeat + 0.15, 1, 0),
        0,
        0.15,
      ),
    ),
    expectedResult: {
      perNote: SCALE_EXPECTED.map((exp) => ({
        match: {
          expected: exp,
          detected: beatNote(exp.noteName, exp.midi, exp.startBeat + 0.15, 1, 0),
          pitchErrorCents: 0,
          timeErrorBeats: 0.15,
        },
        tier: 'ok',
      })),
      summary: { total: 8, perfect: 0, ok: 8, miss: 0, accuracyPct: 50 },
    },
  },

  // 3. All 8 notes uniformly +0.5 beats late, 0 cents. |timeErr|=0.5
  //    exceeds timeBeatsOk (0.2) → every tier is "miss". Accuracy = 0.
  {
    name: 'too late → all miss (+0.5 beats, 0 cents)',
    matches: SCALE_EXPECTED.map((exp) =>
      matched(
        exp,
        beatNote(exp.noteName, exp.midi, exp.startBeat + 0.5, 1, 0),
        0,
        0.5,
      ),
    ),
    expectedResult: {
      perNote: SCALE_EXPECTED.map((exp) => ({
        match: {
          expected: exp,
          detected: beatNote(exp.noteName, exp.midi, exp.startBeat + 0.5, 1, 0),
          pitchErrorCents: 0,
          timeErrorBeats: 0.5,
        },
        tier: 'miss',
      })),
      summary: { total: 8, perfect: 0, ok: 0, miss: 8, accuracyPct: 0 },
    },
  },

  // 4. 7 perfect matches + 1 unmatched (expected[3] is F4 with no
  //    candidate). Tier for expected[3] is "miss" (detected:null branch);
  //    the other 7 are "perfect". Accuracy = 7 / 8 × 100 = 87.5.
  {
    name: 'one missed note (7 perfect + 1 unmatched → 87.5%)',
    matches: [
      matched(SCALE_EXPECTED[0], SCALE_DETECTED_EXACT[0], 0, 0),
      matched(SCALE_EXPECTED[1], SCALE_DETECTED_EXACT[1], 0, 0),
      matched(SCALE_EXPECTED[2], SCALE_DETECTED_EXACT[2], 0, 0),
      matched(SCALE_EXPECTED[3], null, null, null), // unmatched → miss
      matched(SCALE_EXPECTED[4], SCALE_DETECTED_EXACT[4], 0, 0),
      matched(SCALE_EXPECTED[5], SCALE_DETECTED_EXACT[5], 0, 0),
      matched(SCALE_EXPECTED[6], SCALE_DETECTED_EXACT[6], 0, 0),
      matched(SCALE_EXPECTED[7], SCALE_DETECTED_EXACT[7], 0, 0),
    ],
    expectedResult: {
      perNote: [
        { match: { expected: SCALE_EXPECTED[0], detected: SCALE_DETECTED_EXACT[0], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[1], detected: SCALE_DETECTED_EXACT[1], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[2], detected: SCALE_DETECTED_EXACT[2], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[3], detected: null, pitchErrorCents: null, timeErrorBeats: null }, tier: 'miss' },
        { match: { expected: SCALE_EXPECTED[4], detected: SCALE_DETECTED_EXACT[4], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[5], detected: SCALE_DETECTED_EXACT[5], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[6], detected: SCALE_DETECTED_EXACT[6], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[7], detected: SCALE_DETECTED_EXACT[7], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
      ],
      summary: { total: 8, perfect: 7, ok: 0, miss: 1, accuracyPct: 87.5 },
    },
  },

  // 5. Wrong pitch played: expected[3] is F4 (midi 65) but the detected
  //    note is C4 (midi 60). Pitch-class mismatch in scoreMatch → "miss",
  //    regardless of cents/time. The other 7 are perfect. Accuracy = 87.5.
  //    This case validates the gap the Matcher can't detect (Matcher
  //    reports near-zero pitchErrorCents when wrong note is played).
  {
    name: 'wrong pitch played (midi mismatch on expected[3]) → 87.5%',
    matches: [
      matched(SCALE_EXPECTED[0], SCALE_DETECTED_EXACT[0], 0, 0),
      matched(SCALE_EXPECTED[1], SCALE_DETECTED_EXACT[1], 0, 0),
      matched(SCALE_EXPECTED[2], SCALE_DETECTED_EXACT[2], 0, 0),
      matched(SCALE_EXPECTED[3], beatNote('C4', 60, 3, 1, 0), 0, 0), // wrong midi
      matched(SCALE_EXPECTED[4], SCALE_DETECTED_EXACT[4], 0, 0),
      matched(SCALE_EXPECTED[5], SCALE_DETECTED_EXACT[5], 0, 0),
      matched(SCALE_EXPECTED[6], SCALE_DETECTED_EXACT[6], 0, 0),
      matched(SCALE_EXPECTED[7], SCALE_DETECTED_EXACT[7], 0, 0),
    ],
    expectedResult: {
      perNote: [
        { match: { expected: SCALE_EXPECTED[0], detected: SCALE_DETECTED_EXACT[0], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[1], detected: SCALE_DETECTED_EXACT[1], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[2], detected: SCALE_DETECTED_EXACT[2], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[3], detected: beatNote('C4', 60, 3, 1, 0), pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'miss' },
        { match: { expected: SCALE_EXPECTED[4], detected: SCALE_DETECTED_EXACT[4], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[5], detected: SCALE_DETECTED_EXACT[5], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[6], detected: SCALE_DETECTED_EXACT[6], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[7], detected: SCALE_DETECTED_EXACT[7], pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
      ],
      summary: { total: 8, perfect: 7, ok: 0, miss: 1, accuracyPct: 87.5 },
    },
  },

  // 6. Mixed tiers in one run:
  //      0..2: perfect (exact beat, 0 cents)
  //      3..5: ok (+0.15 beats late, 0 cents)
  //      6..7: miss (+0.5 beats late AND +45 cents → fails both windows)
  //    Weighted accuracy = (3×1.0 + 3×0.5 + 2×0.0) / 8 × 100 = 4.5/8 × 100 = 56.25.
  {
    name: 'mixed tiers (3 perfect + 3 ok + 2 miss → 56.25%)',
    matches: [
      // 0..2: perfect
      matched(SCALE_EXPECTED[0], beatNote('C4', 60, 0, 1, 0), 0, 0),
      matched(SCALE_EXPECTED[1], beatNote('D4', 62, 1, 1, 0), 0, 0),
      matched(SCALE_EXPECTED[2], beatNote('E4', 64, 2, 1, 0), 0, 0),
      // 3..5: ok (slightly late, in tune)
      matched(SCALE_EXPECTED[3], beatNote('F4', 65, 3.15, 1, 0), 0, 0.15),
      matched(SCALE_EXPECTED[4], beatNote('G4', 67, 4.15, 1, 0), 0, 0.15),
      matched(SCALE_EXPECTED[5], beatNote('A4', 69, 5.15, 1, 0), 0, 0.15),
      // 6..7: miss (too late AND off pitch)
      matched(SCALE_EXPECTED[6], beatNote('B4', 71, 6.5, 1, 45), 45, 0.5),
      matched(SCALE_EXPECTED[7], beatNote('C5', 72, 7.5, 1, 45), 45, 0.5),
    ],
    expectedResult: {
      perNote: [
        { match: { expected: SCALE_EXPECTED[0], detected: beatNote('C4', 60, 0, 1, 0), pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[1], detected: beatNote('D4', 62, 1, 1, 0), pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[2], detected: beatNote('E4', 64, 2, 1, 0), pitchErrorCents: 0, timeErrorBeats: 0 }, tier: 'perfect' },
        { match: { expected: SCALE_EXPECTED[3], detected: beatNote('F4', 65, 3.15, 1, 0), pitchErrorCents: 0, timeErrorBeats: 0.15 }, tier: 'ok' },
        { match: { expected: SCALE_EXPECTED[4], detected: beatNote('G4', 67, 4.15, 1, 0), pitchErrorCents: 0, timeErrorBeats: 0.15 }, tier: 'ok' },
        { match: { expected: SCALE_EXPECTED[5], detected: beatNote('A4', 69, 5.15, 1, 0), pitchErrorCents: 0, timeErrorBeats: 0.15 }, tier: 'ok' },
        { match: { expected: SCALE_EXPECTED[6], detected: beatNote('B4', 71, 6.5, 1, 45), pitchErrorCents: 45, timeErrorBeats: 0.5 }, tier: 'miss' },
        { match: { expected: SCALE_EXPECTED[7], detected: beatNote('C5', 72, 7.5, 1, 45), pitchErrorCents: 45, timeErrorBeats: 0.5 }, tier: 'miss' },
      ],
      summary: { total: 8, perfect: 3, ok: 3, miss: 2, accuracyPct: 56.25 },
    },
  },
];

/** Allowed slack on beat-valued fields to absorb float wobble. */
const BEAT_TOLERANCE = 0.005;
/** Allowed slack on `accuracyPct` (fractional points of percent). */
const ACCURACY_TOLERANCE = 0.005;

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

/**
 * Compare two ScoreResult values field-by-field and return a human-readable
 * diff message, or undefined if they agree.
 */
function diffCase(actual: ScoreResult, expected: ScoreResult): string | undefined {
  if (actual.perNote.length !== expected.perNote.length) {
    return `perNote length: expected ${expected.perNote.length}, got ${actual.perNote.length}`;
  }

  for (let i = 0; i < expected.perNote.length; i++) {
    const a = actual.perNote[i];
    const e = expected.perNote[i];

    // Tier must match exactly.
    if (a.tier !== e.tier) {
      return `case[${i}].tier: expected ${e.tier}, got ${a.tier}`;
    }

    const am = a.match;
    const em = e.match;

    // expected.*: name/midi exact, beats within tolerance.
    if (am.expected.noteName !== em.expected.noteName) {
      return `case[${i}].expected.noteName: expected ${em.expected.noteName}, got ${am.expected.noteName}`;
    }
    if (am.expected.midi !== em.expected.midi) {
      return `case[${i}].expected.midi: expected ${em.expected.midi}, got ${am.expected.midi}`;
    }
    if (Math.abs(am.expected.startBeat - em.expected.startBeat) > BEAT_TOLERANCE) {
      return `case[${i}].expected.startBeat: expected ${em.expected.startBeat}, got ${am.expected.startBeat}`;
    }
    if (Math.abs(am.expected.durationBeats - em.expected.durationBeats) > BEAT_TOLERANCE) {
      return `case[${i}].expected.durationBeats: expected ${em.expected.durationBeats}, got ${am.expected.durationBeats}`;
    }

    // detected: null-vs-non-null parity must match. Re-check inline so
    // TypeScript narrows both sides for the helper call without casts.
    const aDetPresent = am.detected !== null;
    const eDetPresent = em.detected !== null;
    if (aDetPresent !== eDetPresent) {
      return `case[${i}].detected: expected ${eDetPresent ? 'set' : 'null'}, got ${aDetPresent ? 'set' : 'null'}`;
    }
    if (am.detected !== null && em.detected !== null) {
      const dDiff = compareBeatNotes(am.detected, em.detected, i);
      if (dDiff !== undefined) return dDiff;
    }

    // pitchErrorCents / timeErrorBeats: null-ness parity + (when present)
    // match within tolerance.
    if (am.pitchErrorCents !== em.pitchErrorCents) {
      return `case[${i}].pitchErrorCents: expected ${em.pitchErrorCents}, got ${am.pitchErrorCents}`;
    }
    if (am.timeErrorBeats === null && em.timeErrorBeats === null) continue;
    if (am.timeErrorBeats === null || em.timeErrorBeats === null) {
      return `case[${i}].timeErrorBeats: expected ${em.timeErrorBeats}, got ${am.timeErrorBeats}`;
    }
    if (Math.abs(am.timeErrorBeats - em.timeErrorBeats) > BEAT_TOLERANCE) {
      return `case[${i}].timeErrorBeats: expected ${em.timeErrorBeats}, got ${am.timeErrorBeats}`;
    }
  }

  // Summary fields: counts exact, accuracyPct within tolerance.
  const as = actual.summary;
  const es = expected.summary;
  if (as.total !== es.total) {
    return `summary.total: expected ${es.total}, got ${as.total}`;
  }
  if (as.perfect !== es.perfect) {
    return `summary.perfect: expected ${es.perfect}, got ${as.perfect}`;
  }
  if (as.ok !== es.ok) {
    return `summary.ok: expected ${es.ok}, got ${as.ok}`;
  }
  if (as.miss !== es.miss) {
    return `summary.miss: expected ${es.miss}, got ${as.miss}`;
  }
  if (Math.abs(as.accuracyPct - es.accuracyPct) > ACCURACY_TOLERANCE) {
    return `summary.accuracyPct: expected ${es.accuracyPct}, got ${as.accuracyPct}`;
  }

  return undefined;
}

export function runScorerHarness(): ScorerResult {
  const details: ScorerResult['details'] = [];
  let pass = 0;
  let fail = 0;

  for (const c of SCORER_CASES) {
    let actual: ScoreResult;
    let runtimeError: string | undefined;
    try {
      actual = scoreMatches(c.matches, c.thresholds);
    } catch (err) {
      runtimeError = err instanceof Error ? err.message : String(err);
      actual = { perNote: [], summary: { total: 0, perfect: 0, ok: 0, miss: 0, accuracyPct: 100 } };
    }

    const diff = runtimeError !== undefined ? `scorer threw: ${runtimeError}` : diffCase(actual, c.expectedResult);
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
