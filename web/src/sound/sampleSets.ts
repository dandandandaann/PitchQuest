/**
 * Static sample-set configuration for the sound module.
 *
 * Framework-free: no Web Audio, no DOM, no React, no browser globals. Paths are
 * RELATIVE to the app base URL (no leading slash); absolute URL construction
 * happens later in SamplePlayer.ts.
 *
 * The referenced `.mp3` files are rendered separately and may not exist yet —
 * that is fine, this module only describes them.
 */

import { DEFAULT_ENVELOPE } from './envelope';
import type { EnvelopeSpec } from './envelope';

export type InstrumentId = 'trumpet' | 'trombone';

export interface SoundSample {
  /** SOUNDING (concert) MIDI pitch of the rendered audio file. */
  midi: number;
  /** Path relative to the app base URL, e.g. "sounds/trumpet/trumpet-052.mp3". No leading slash. */
  path: string;
}

export interface InstrumentSoundConfig {
  id: InstrumentId;
  /** Semitones ADDED to the WRITTEN drill note to get the SOUNDING pitch. */
  transposeSemitones: number;
  /** GM program, 1-based (MusicXML convention) — provenance only, unused at runtime. */
  gmProgram1Based: number;
  samples: readonly SoundSample[];
  envelope: EnvelopeSpec;
  gain: number;
}

/** Bb trumpet is transposing: written C4 sounds concert Bb3 (-2 semitones). */
export const TRUMPET_TRANSPOSE_SEMITONES: number = -2;
/** Trombone is non-transposing. */
export const TROMBONE_TRANSPOSE_SEMITONES: number = 0;

/** Length of each committed sample slice, in seconds. Must be >= envelope duration. */
export const SLICE_SEC: number = 0.8;

const TRUMPET_SAMPLES: readonly SoundSample[] = [
  { midi: 52, path: 'sounds/trumpet/trumpet-052.mp3' },
  { midi: 57, path: 'sounds/trumpet/trumpet-057.mp3' },
  { midi: 61, path: 'sounds/trumpet/trumpet-061.mp3' },
  { midi: 66, path: 'sounds/trumpet/trumpet-066.mp3' },
  { midi: 70, path: 'sounds/trumpet/trumpet-070.mp3' },
  { midi: 75, path: 'sounds/trumpet/trumpet-075.mp3' },
  { midi: 79, path: 'sounds/trumpet/trumpet-079.mp3' },
  { midi: 84, path: 'sounds/trumpet/trumpet-084.mp3' },
];

const TROMBONE_SAMPLES: readonly SoundSample[] = [
  { midi: 40, path: 'sounds/trombone/trombone-040.mp3' },
  { midi: 45, path: 'sounds/trombone/trombone-045.mp3' },
  { midi: 50, path: 'sounds/trombone/trombone-050.mp3' },
  { midi: 55, path: 'sounds/trombone/trombone-055.mp3' },
  { midi: 60, path: 'sounds/trombone/trombone-060.mp3' },
  { midi: 65, path: 'sounds/trombone/trombone-065.mp3' },
];

export const INSTRUMENT_SOUNDS: Readonly<Record<InstrumentId, InstrumentSoundConfig>> = {
  trumpet: {
    id: 'trumpet',
    transposeSemitones: TRUMPET_TRANSPOSE_SEMITONES,
    gmProgram1Based: 57,
    samples: TRUMPET_SAMPLES,
    envelope: DEFAULT_ENVELOPE,
    gain: 0.9,
  },
  trombone: {
    id: 'trombone',
    transposeSemitones: TROMBONE_TRANSPOSE_SEMITONES,
    gmProgram1Based: 58,
    samples: TROMBONE_SAMPLES,
    envelope: DEFAULT_ENVELOPE,
    gain: 0.9,
  },
};
