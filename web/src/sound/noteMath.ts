/**
 * Pure note-name math for the sound module.
 *
 * Framework-free: no Web Audio, no DOM, no React, no browser globals.
 * Scientific pitch notation with middle C = C4 = MIDI 60, matching the drill
 * tables in ../trumpet and ../trombone. Flat spelling is the default, matching
 * `NOTES` in ../audio/utils/pitch-math.ts.
 */

export type NoteLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = '#' | 'b' | null;

export interface ParsedNote {
  letter: NoteLetter;
  accidental: Accidental;
  octave: number;
  midi: number;
}

/** Semitone offset of each natural letter above C. */
const LETTER_SEMITONES: Readonly<Record<NoteLetter, number>> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/** Strict note-name grammar: an A–G letter, an optional single accidental, then an integer octave. */
const NOTE_NAME_RE = /^([A-G])(#|b)?(-?\d+)$/;

/** Flat-spelled pitch classes, mirroring `NOTES` in ../audio/utils/pitch-math.ts. */
const FLAT_NAMES: readonly string[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Sharp-spelled pitch classes. */
const SHARP_NAMES: readonly string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Parses a scientific-pitch note name into its letter, accidental, octave and
 * MIDI number. Strict: only `/^([A-G])(#|b)?(-?\d+)$/` is accepted. Returns
 * `null` for anything else and NEVER throws.
 *
 * Note: "Cb4" and "B#4" are accepted (they are grammatically valid) and resolve
 * to MIDI 59 and 72 respectively — enharmonic equivalents of B3 / C5.
 */
export function parseNoteName(note: string): ParsedNote | null {
  const match = NOTE_NAME_RE.exec(note);
  if (match === null) return null;

  const letter = match[1] as NoteLetter;
  const accidental = (match[2] ?? null) as Accidental;
  const octave = Number.parseInt(match[3], 10);
  const accidentalOffset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  const midi = (octave + 1) * 12 + LETTER_SEMITONES[letter] + accidentalOffset;

  return { letter, accidental, octave, midi };
}

/** Convenience wrapper around {@link parseNoteName} — throws a descriptive Error on an unparseable name. */
export function noteNameToMidi(note: string): number {
  const parsed = parseNoteName(note);
  if (parsed === null) {
    throw new Error(`noteNameToMidi: unparseable note name "${note}" (expected e.g. "C4", "F#3", "Bb4")`);
  }
  return parsed.midi;
}

/** Equal-tempered frequency for a MIDI number. A4 (MIDI 69) defaults to 440 Hz. */
export function midiToFrequency(midi: number, a4Hz: number = 440): number {
  return a4Hz * Math.pow(2, (midi - 69) / 12);
}

/**
 * Renders a MIDI number as a scientific-pitch note name. Defaults to flat
 * spelling (matching ../audio/utils/pitch-math.ts); pass `'sharp'` for sharps.
 * The MIDI number is rounded to the nearest integer first.
 */
export function midiToNoteName(midi: number, prefer: 'flat' | 'sharp' = 'flat'): string {
  const names = prefer === 'sharp' ? SHARP_NAMES : FLAT_NAMES;
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  const index = ((rounded % 12) + 12) % 12;
  return `${names[index]}${octave}`;
}
