/**
 * Dev-only test harness for the TimingEngine.
 *
 * Pure function module — no React, no DOM, no I/O. Runs a battery of
 * synthetic DetectedNote arrays through TimingEngine annotation and compares
 * the emitted BeatNote[] against hand-traced expectations.
 *
 * TimingEngine is fully deterministic (no wall-clock), so every case can be
 * exercised here.
 */

import { annotateNote, annotateNotes } from './TimingEngine';
import type { BeatNote } from './TimingEngine';
import type { DetectedNote } from './types';

export interface TimingCase {
  name: string;
  bpm: number;
  input: DetectedNote[];
  expected: BeatNote[];
  /** If true, the case expects `annotateNote(input[0], bpm)` to throw. */
  shouldThrow?: boolean;
}

export interface TimingResult {
  pass: number;
  fail: number;
  details: { name: string; pass: boolean; diff?: string }[];
}

export const TIMING_CASES: TimingCase[] = [
  // Case 1: simple whole-note at 60bpm.
  //   msPerBeat(60) = 60000/60 = 1000
  //   startBeat    = 0    / 1000 = 0
  //   durationBeats = 1500 / 1000 = 1.5
  {
    name: 'annotateNote at 60bpm: 0ms/1500ms -> 0/1.5 beats',
    bpm: 60,
    input: [{ noteName: 'C4', midi: 60, startMs: 0, durationMs: 1500, avgCents: 0 }],
    expected: [{ noteName: 'C4', midi: 60, startMs: 0, durationMs: 1500, avgCents: 0, startBeat: 0, durationBeats: 1.5 }],
  },

  // Case 2: eighth-ish note at 80bpm, starting past the downbeat.
  //   msPerBeat(80) = 60000/80 = 750
  //   startBeat    = 2000 / 750 = 2.6666666...   (within 0.005 of 2.6667)
  //   durationBeats =  400 / 750 = 0.5333333...   (within 0.005 of 0.5333)
  {
    name: 'annotateNote at 80bpm: 2000ms/400ms -> ~2.6667/~0.5333 beats',
    bpm: 80,
    input: [{ noteName: 'A4', midi: 69, startMs: 2000, durationMs: 400, avgCents: -7 }],
    expected: [{ noteName: 'A4', midi: 69, startMs: 2000, durationMs: 400, avgCents: -7, startBeat: 2.6667, durationBeats: 0.5333 }],
  },

  // Case 3: annotateNotes preserves order and length.
  //   msPerBeat(120) = 500
  //   a: 0/500   -> 0/1
  //   b: 500/500 -> 1/1
  //   c: 1000/1000 -> 2/2
  {
    name: 'annotateNotes preserves order and length at 120bpm',
    bpm: 120,
    input: [
      { noteName: 'C4', midi: 60, startMs: 0, durationMs: 500, avgCents: 0 },
      { noteName: 'D4', midi: 62, startMs: 500, durationMs: 500, avgCents: 0 },
      { noteName: 'E4', midi: 64, startMs: 1000, durationMs: 1000, avgCents: 0 },
    ],
    expected: [
      { noteName: 'C4', midi: 60, startMs: 0, durationMs: 500, avgCents: 0, startBeat: 0, durationBeats: 1 },
      { noteName: 'D4', midi: 62, startMs: 500, durationMs: 500, avgCents: 0, startBeat: 1, durationBeats: 1 },
      { noteName: 'E4', midi: 64, startMs: 1000, durationMs: 1000, avgCents: 0, startBeat: 2, durationBeats: 2 },
    ],
  },

  // Case 4a: msToBeats / beatsToMs round-trip at bpm=60.
  //   msPerBeat(60) = 1000ms/beat (integer-aligned).
  //   ms -> beats -> ms is identity for 0, 1000, 2500 ms.
  {
    name: 'msToBeats/beatsToMs round-trip at bpm=60',
    bpm: 60,
    input: [
      { noteName: 'C4', midi: 60, startMs: 0, durationMs: 0, avgCents: 0 },
      { noteName: 'C4', midi: 60, startMs: 1000, durationMs: 0, avgCents: 0 },
      { noteName: 'C4', midi: 60, startMs: 2500, durationMs: 0, avgCents: 0 },
    ],
    expected: [
      { noteName: 'C4', midi: 60, startMs: 0, durationMs: 0, avgCents: 0, startBeat: 0, durationBeats: 0 },
      { noteName: 'C4', midi: 60, startMs: 1000, durationMs: 0, avgCents: 0, startBeat: 1, durationBeats: 0 },
      { noteName: 'C4', midi: 60, startMs: 2500, durationMs: 0, avgCents: 0, startBeat: 2.5, durationBeats: 0 },
    ],
  },

  // Case 4b: same property at bpm=80.
  //   msPerBeat(80) = 750ms/beat.
  //   0ms   -> 0    beats
  //   1500ms -> 2   beats
  //   3000ms -> 4   beats
  {
    name: 'msToBeats/beatsToMs round-trip at bpm=80',
    bpm: 80,
    input: [
      { noteName: 'C4', midi: 60, startMs: 0, durationMs: 0, avgCents: 0 },
      { noteName: 'C4', midi: 60, startMs: 1500, durationMs: 0, avgCents: 0 },
      { noteName: 'C4', midi: 60, startMs: 3000, durationMs: 0, avgCents: 0 },
    ],
    expected: [
      { noteName: 'C4', midi: 60, startMs: 0, durationMs: 0, avgCents: 0, startBeat: 0, durationBeats: 0 },
      { noteName: 'C4', midi: 60, startMs: 1500, durationMs: 0, avgCents: 0, startBeat: 2, durationBeats: 0 },
      { noteName: 'C4', midi: 60, startMs: 3000, durationMs: 0, avgCents: 0, startBeat: 4, durationBeats: 0 },
    ],
  },

  // Case 4c: same property at bpm=120.
  //   msPerBeat(120) = 500ms/beat.
  //   0ms  -> 0  beats
  //   500ms -> 1 beat
  //   1500ms -> 3 beats
  {
    name: 'msToBeats/beatsToMs round-trip at bpm=120',
    bpm: 120,
    input: [
      { noteName: 'C4', midi: 60, startMs: 0, durationMs: 0, avgCents: 0 },
      { noteName: 'C4', midi: 60, startMs: 500, durationMs: 0, avgCents: 0 },
      { noteName: 'C4', midi: 60, startMs: 1500, durationMs: 0, avgCents: 0 },
    ],
    expected: [
      { noteName: 'C4', midi: 60, startMs: 0, durationMs: 0, avgCents: 0, startBeat: 0, durationBeats: 0 },
      { noteName: 'C4', midi: 60, startMs: 500, durationMs: 0, avgCents: 0, startBeat: 1, durationBeats: 0 },
      { noteName: 'C4', midi: 60, startMs: 1500, durationMs: 0, avgCents: 0, startBeat: 3, durationBeats: 0 },
    ],
  },

  // Case 5: annotateNote with bpm=0 throws RangeError.
  //   msPerBeat guards: `!(bpm > 0)` -> throw RangeError('msPerBeat: bpm must be > 0, got 0')
  {
    name: 'annotateNote with bpm=0 throws RangeError',
    bpm: 0,
    input: [{ noteName: 'C4', midi: 60, startMs: 0, durationMs: 1000, avgCents: 0 }],
    expected: [],
    shouldThrow: true,
  },

  // Case 6: avgCents passthrough. A note with non-zero cents keeps its
  // avgCents untouched while beat fields are computed normally.
  //   msPerBeat(100) = 600
  //   startBeat    = 1200/600 = 2
  //   durationBeats =  600/600 = 1
  {
    name: 'avgCents is preserved verbatim through annotation',
    bpm: 100,
    input: [{ noteName: 'G4', midi: 67, startMs: 1200, durationMs: 600, avgCents: 23 }],
    expected: [{ noteName: 'G4', midi: 67, startMs: 1200, durationMs: 600, avgCents: 23, startBeat: 2, durationBeats: 1 }],
  },
];

/** Allowed slack on `startBeat` / `durationBeats` to absorb float wobble. */
const BEAT_TOLERANCE = 0.005;

function diffCase(actual: BeatNote[], expected: BeatNote[]): string | undefined {
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
    if (a.durationMs !== e.durationMs) {
      return `case[${i}].durationMs: expected ${e.durationMs}, got ${a.durationMs}`;
    }
    if (a.avgCents !== e.avgCents) {
      return `case[${i}].avgCents: expected ${e.avgCents}, got ${a.avgCents}`;
    }
    if (Math.abs(a.startBeat - e.startBeat) > BEAT_TOLERANCE) {
      return `case[${i}].startBeat: expected ${e.startBeat}, got ${a.startBeat}`;
    }
    if (Math.abs(a.durationBeats - e.durationBeats) > BEAT_TOLERANCE) {
      return `case[${i}].durationBeats: expected ${e.durationBeats}, got ${a.durationBeats}`;
    }
  }
  return undefined;
}

export function runTimingEngineHarness(): TimingResult {
  const details: TimingResult['details'] = [];
  let pass = 0;
  let fail = 0;

  for (const c of TIMING_CASES) {
    if (c.shouldThrow) {
      try {
        annotateNote(c.input[0], c.bpm);
        fail += 1;
        details.push({ name: c.name, pass: false, diff: 'expected throw, did not' });
      } catch {
        pass += 1;
        details.push({ name: c.name, pass: true });
      }
      continue;
    }

    const actual = annotateNotes(c.input, c.bpm);
    const diff = diffCase(actual, c.expected);
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