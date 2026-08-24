/**
 * IncrementalMatcher — stateful "wait mode" matcher for PitchQuest Stage 6.
 *
 * Designed for the Guitar Hero "wait mode" session loop:
 *   - The song does NOT advance until the currently-active expected note is hit
 *     (or auto-marked as miss after the grace period).
 *   - Each `push` checks one detected note against the active expected note only.
 *   - Out-of-window or wrong-pitch-class detections return null — the active
 *     note stays active and the user can keep trying.
 *
 * This class is stateless by design on the REACT lifecycle — one instance
 * lives in a `useRef` and is reused across renders. All state is encapsulated
 * in the cursor (`_cursor`). No external state is mutated.
 *
 * Window logic mirrors `Matcher.matchNotes` for the active note only:
 *   [active.startBeat - windowBeforeBeats, active.startBeat + active.durationBeats + windowAfterBeats]
 *
 * v1 limitations:
 *   - Does NOT score pitch-class mismatches. A detected note with the wrong
 *     MIDI number that falls in the active window still returns a MatchedNote
 *     (cursor advances). The caller scores it via `Scorer.scoreMatch` and
 *     the result will be `tier='miss'`. This keeps the matcher layer simple.
 *   - Greedy: one detected note per expected. Does not backtrack.
 */

import type { ExpectedNote } from '../score/types';
import type { BeatNote } from './TimingEngine';
import type { MatchedNote, MatcherOptions } from './Matcher';

/** Default window before expected.startBeat (beats). */
const DEFAULT_WINDOW_BEFORE_BEATS = 0.5;

/** Default window after expected.startBeat + durationBeats (beats). */
const DEFAULT_WINDOW_AFTER_BEATS = 0.5;

export class IncrementalMatcher {
  /** All expected notes (immutable after construction). */
  readonly #expected: readonly ExpectedNote[];

  /** Index of the currently-active expected note. */
  #cursor: number = 0;

  readonly #windowBeforeBeats: number;
  readonly #windowAfterBeats: number;

  /**
   * @param expected  Ordered list of expected notes (from MusicXML).
   * @param opts      Matcher window options (same shape as `MatcherOptions`).
   *                  Defaults: windowBefore=0.5, windowAfter=0.5 beats.
   */
  constructor(expected: ExpectedNote[], opts?: MatcherOptions) {
    this.#expected = [...expected];           // copy — cursor mutates
    this.#windowBeforeBeats = opts?.windowBeforeBeats ?? DEFAULT_WINDOW_BEFORE_BEATS;
    this.#windowAfterBeats   = opts?.windowAfterBeats   ?? DEFAULT_WINDOW_AFTER_BEATS;
  }

  // -------------------------------------------------------------------------
  // Public getters
  // -------------------------------------------------------------------------

  /** How many expected notes have been consumed so far (cursor position). */
  get consumedCount(): number {
    return this.#cursor;
  }

  /** Remaining expected notes (all notes after the current cursor). */
  get remaining(): ExpectedNote[] {
    return this.#expected.slice(this.#cursor);
  }

  /**
   * The currently-active expected note — the one the user is trying to hit
   * right now. `null` when all notes have been consumed.
   */
  get active(): ExpectedNote | null {
    return this.#cursor < this.#expected.length ? this.#expected[this.#cursor] : null;
  }

  // -------------------------------------------------------------------------
  // Core API
  // -------------------------------------------------------------------------

  /**
   * Try to match one detected note against the currently-active expected note.
   *
   * - **In-window:** constructs and returns a `MatchedNote` with `detected`
   *   populated. Cursor advances to the next expected note.
   * - **Out-of-window:** returns `null`. Cursor is unchanged — the active
   *   note remains the target for the next push.
   *
   * Note: a wrong-pitch-class detection (e.g. user plays C4 when expected D4)
   * that falls in the window STILL returns a MatchedNote with `detected`
   * populated. The scorer (upstream: `Scorer.scoreMatch`) classifies this as
   * `tier='miss'`. The matcher layer does NOT make pitch-class decisions.
   *
   * @returns A `MatchedNote` if the detected note was in the active window,
   *          or `null` if the active note is out of reach.
   */
  push(detected: BeatNote): MatchedNote | null {
    const active = this.active;
    if (active === null) return null;

    const winLow  = active.startBeat - this.#windowBeforeBeats;
    const winHigh = active.startBeat + active.durationBeats + this.#windowAfterBeats;

    // Out of window → cursor unchanged, return null.
    if (detected.startBeat < winLow || detected.startBeat > winHigh) {
      return null;
    }

    // In window — build the MatchedNote and advance the cursor.
    const result: MatchedNote = {
      expected: active,
      detected,
      pitchErrorCents: detected.avgCents,
      timeErrorBeats:  detected.startBeat - active.startBeat,
    };

    this.#cursor += 1;
    return result;
  }

  /**
   * Force-resolve the currently-active expected note as a miss and advance
   * the cursor.
   *
   * Used by the grace-period rAF tick in `useScoreSession` when the user
   * hasn't played the active note within the allowed window.
   *
   * @returns A synthetic `MatchedNote` with `tier='miss'` and `detected=null`.
   * @throws `RangeError` if no active note remains (all notes already consumed).
   */
  forceMissActive(): MatchedNote {
    const active = this.active;
    if (active === null) {
      throw new RangeError('No active note to force-miss');
    }

    const result: MatchedNote = {
      expected: active,
      detected: null,
      pitchErrorCents: NaN,
      timeErrorBeats:  NaN,
    };

    this.#cursor += 1;
    return result;
  }
}
