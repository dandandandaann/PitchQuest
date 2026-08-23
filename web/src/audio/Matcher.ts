/**
 * Matching engine (Roadmap Stage 4).
 *
 * Aligns an array of `ExpectedNote`s (from MusicXML) against an array of
 * `BeatNote`s (live detected notes, already annotated with beat positions by
 * `TimingEngine.annotateNotes`). Output is a `MatchedNote` for each expected
 * note, with the best-window detected note (or null on miss) and the
 * resulting pitch/time errors.
 *
 * v1 limitations:
 *  - Greedy left-to-right matching. If the user plays notes out of order,
 *    suboptimal matches may occur. Future work: Hungarian or DTW assignment.
 *  - Window is symmetric by default; humans tend to lag more than anticipate.
 *    Consider tuning `windowAfterBeats` higher in v2.
 *  - `pitchErrorCents` is the detected note's own cents-deviation around its
 *    DETECTED pitch — NOT a comparison to the expected pitch. A user playing
 *    the WRONG note at the right time will report near-zero pitch error.
 *    Stage 5 scorer should add a `pitchClassMatch: boolean` check
 *    (compare `detected.midi === expected.midi`).
 *  - Detected notes that fall outside any expected note's window (extras)
 *    are silently ignored. They do NOT appear in the output.
 */

import type { ExpectedNote } from '../score/types';
import type { BeatNote } from './TimingEngine';

/** Default size of the matching window before the expected note's startBeat. */
export const DEFAULT_WINDOW_BEFORE_BEATS = 0.5;

/** Default size of the matching window after the expected note's startBeat + durationBeats. */
export const DEFAULT_WINDOW_AFTER_BEATS = 0.5;

export interface MatchedNote {
  expected: ExpectedNote;
  /** The detected note matched to this expected note, or null if no candidate was found in the window. Always a BeatNote (carries startBeat/durationBeats). */
  detected: BeatNote | null;
  /** Average cents-deviation of the detected note, or null if unmatched. */
  pitchErrorCents: number | null;
  /** `detected.startBeat - expected.startBeat`, or null if unmatched. */
  timeErrorBeats: number | null;
}

export interface MatcherOptions {
  /** Catch window before expected.startBeat, in beats. Default 0.5. */
  windowBeforeBeats?: number;
  /** Catch window after expected.startBeat + durationBeats, in beats. Default 0.5. */
  windowAfterBeats?: number;
}

/**
 * Match each `ExpectedNote` against the closest in-window `BeatNote`.
 *
 * Algorithm:
 *  1. Iterate expected notes in order.
 *  2. For each expected note, scan all unused detected notes whose
 *     `startBeat` lies in `[startBeat - windowBeforeBeats, startBeat + durationBeats + windowAfterBeats]`.
 *  3. Pick the candidate with the smallest `|startBeat - expected.startBeat|`
 *     and mark its index as used.
 *  4. Emit a `MatchedNote`; if no candidate was found, `detected` and both
 *     error fields are null.
 *
 * Unmatched (extra) detected notes are silently dropped.
 *
 * Throws `RangeError` if either window option is negative (or NaN).
 */
export function matchNotes(
  expected: ExpectedNote[],
  detected: BeatNote[],
  opts?: MatcherOptions,
): MatchedNote[] {
  const windowBeforeBeats = opts?.windowBeforeBeats ?? DEFAULT_WINDOW_BEFORE_BEATS;
  const windowAfterBeats = opts?.windowAfterBeats ?? DEFAULT_WINDOW_AFTER_BEATS;

  if (!(windowBeforeBeats >= 0)) {
    throw new RangeError(`matchNotes: windowBeforeBeats must be >= 0, got ${windowBeforeBeats}`);
  }
  if (!(windowAfterBeats >= 0)) {
    throw new RangeError(`matchNotes: windowAfterBeats must be >= 0, got ${windowAfterBeats}`);
  }

  const used = new Set<number>();
  const out: MatchedNote[] = [];

  for (const E of expected) {
    const winLow = E.startBeat - windowBeforeBeats;
    const winHigh = E.startBeat + E.durationBeats + windowAfterBeats;

    let bestIdx = -1;
    let bestAbsErr = Infinity;
    for (let i = 0; i < detected.length; i++) {
      if (used.has(i)) continue;
      const D = detected[i];
      if (D.startBeat < winLow || D.startBeat > winHigh) continue;
      const err = Math.abs(D.startBeat - E.startBeat);
      if (err < bestAbsErr) {
        bestAbsErr = err;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) {
      out.push({ expected: E, detected: null, pitchErrorCents: null, timeErrorBeats: null });
    } else {
      const D = detected[bestIdx];
      used.add(bestIdx);
      out.push({
        expected: E,
        detected: D,
        pitchErrorCents: D.avgCents,
        timeErrorBeats: D.startBeat - E.startBeat,
      });
    }
  }

  return out;
}