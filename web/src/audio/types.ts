/**
 * Shared audio-domain types.
 *
 * `DetectedNote` is the output of the `NoteSegmenter`: a single held pitch
 * event with start time, duration, and an average cents-deviation reading.
 */
export interface DetectedNote {
  noteName: string;
  midi: number;
  startMs: number;
  durationMs: number;
  avgCents: number;
}
