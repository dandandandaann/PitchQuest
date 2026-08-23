/**
 * Timing model for PitchQuest (Roadmap Stage 2).
 *
 * v1 limitations:
 *  - `DetectedNote.startMs` is measured from `performance.now()`, which has an
 *    arbitrary monotonic origin (page load or worker start). Beat 0 therefore
 *    has no musical meaning — beats are RELATIVE offsets, not synchronized
 *    to a metronome or audio-context time. This is fine for visualizing a
 *    single take but will matter for Stage 3 (MusicXML score alignment).
 *  - BPM is fixed for a session. Variable tempo / rubato / tempo maps are
 *    deferred to a later stage.
 *  - No quantize, no swing, no humanization. Beat positions are exact.
 */

import type { DetectedNote } from './types';

/** Default tempo for v1. Roadmap Stage 2. */
export const DEFAULT_BPM = 80;

/** Milliseconds in one minute. */
export const MS_PER_MINUTE = 60_000;

/**
 * A `DetectedNote` enriched with beat-relative positions derived from a fixed
 * BPM. The original ms fields are preserved for reference.
 */
export interface BeatNote extends DetectedNote {
  startBeat: number;
  durationBeats: number;
}

/**
 * Milliseconds per single beat at the given BPM.
 *
 * Throws `RangeError` for non-positive BPM.
 */
export function msPerBeat(bpm: number): number {
  if (!(bpm > 0)) {
    throw new RangeError(`msPerBeat: bpm must be > 0, got ${bpm}`);
  }
  return MS_PER_MINUTE / bpm;
}

/** Convert absolute milliseconds to beats at the given BPM. */
export function msToBeats(ms: number, bpm: number): number {
  return ms / msPerBeat(bpm);
}

/** Convert beats to milliseconds at the given BPM. */
export function beatsToMs(beats: number, bpm: number): number {
  return beats * msPerBeat(bpm);
}

/** Annotate a single `DetectedNote` with beat positions. */
export function annotateNote(note: DetectedNote, bpm: number): BeatNote {
  return {
    ...note,
    startBeat: msToBeats(note.startMs, bpm),
    durationBeats: msToBeats(note.durationMs, bpm),
  };
}

/** Annotate an array of `DetectedNote`s with beat positions. Order preserved. */
export function annotateNotes(notes: DetectedNote[], bpm: number): BeatNote[] {
  return notes.map(n => annotateNote(n, bpm));
}