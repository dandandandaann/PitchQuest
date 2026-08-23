/**
 * Score-domain types.
 *
 * `ExpectedNote` is the canonical representation of a single note from the
 * score (after MusicXML parsing). `DetectedNote` from `NoteSegmenter` and
 * `ExpectedNote` here are designed to be matched 1:1 by Stage 4's scorer.
 */

/**
 * A single note from the score.
 *
 * `noteName` is in flats-style ("C4", "Db5", "Bb3") so it can be compared
 * directly against `DetectedNote.noteName` (which is produced via
 * `frequencyToNote` and uses the same flat-based naming).
 */
export interface ExpectedNote {
  /** Note name in flats-style (e.g. "C4", "Db5", "Bb3"). Matches `DetectedNote.noteName`. */
  noteName: string;
  /** MIDI number, integer. */
  midi: number;
  /** Beat position from session start, float. */
  startBeat: number;
  /** Duration in beats, float. */
  durationBeats: number;
}

export interface ParseMusicXmlOptions {
  /**
   * Fixed tempo for the score, in beats per minute.
   *
   * The parser does NOT read `<sound tempo="...">` from the XML — the caller
   * supplies this. Beat positions in `ExpectedNote.startBeat` are in raw
   * beats (not seconds); `bpm` is currently unused by the parser itself but
   * is part of the signature so downstream consumers (scoring, UI) can
   * convert beats → seconds without needing to re-read the XML.
   */
  bpm: number;
}
