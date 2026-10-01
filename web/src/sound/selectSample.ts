/**
 * Pure sample-selection logic for the sound module.
 *
 * Framework-free: no Web Audio, no DOM, no React, no browser globals.
 *
 * Transposition arithmetic (the single place it is applied):
 *   1. writtenMidi  = parsed.midi from parseNoteName(writtenNote)
 *   2. soundingMidi = writtenMidi + cfg.transposeSemitones
 *   3. choice       = argmin over cfg.samples of |soundingMidi - s.midi|
 *   4. cents        = (soundingMidi - choice.sample.midi) * 100
 * `transposeSemitones` is folded in at step 2 and MUST NOT be applied again.
 */

import { parseNoteName } from './noteMath';
import { INSTRUMENT_SOUNDS } from './sampleSets';
import type { InstrumentId, SoundSample } from './sampleSets';

export interface SampleChoice {
  sample: SoundSample;
  /** Signed cents offset of the sounding pitch above the chosen sample. */
  cents: number;
}

/** Applies the instrument's transposition to a written (drill) MIDI pitch, yielding the sounding pitch. */
export function soundingMidiForWritten(writtenMidi: number, instrument: InstrumentId): number {
  return writtenMidi + INSTRUMENT_SOUNDS[instrument].transposeSemitones;
}

/**
 * Nearest sample by |Δ semitones|. Ties resolve to the LOWER `sample.midi`
 * (deterministic regardless of input order). Throws on an empty list.
 */
export function selectSample(soundingMidi: number, samples: readonly SoundSample[]): SampleChoice {
  if (samples.length === 0) {
    throw new Error('selectSample: sample list is empty');
  }

  let best = samples[0];
  let bestDistance = Math.abs(soundingMidi - best.midi);

  for (let i = 1; i < samples.length; i++) {
    const candidate = samples[i];
    const distance = Math.abs(soundingMidi - candidate.midi);
    if (distance < bestDistance || (distance === bestDistance && candidate.midi < best.midi)) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return { sample: best, cents: (soundingMidi - best.midi) * 100 };
}

/**
 * Full path: written drill note -> { soundingMidi, choice }.
 * Returns `null` if the note name does not parse (never throws).
 */
export function choiceForWrittenNote(
  writtenNote: string,
  instrument: InstrumentId,
): { soundingMidi: number; choice: SampleChoice } | null {
  const parsed = parseNoteName(writtenNote);
  if (parsed === null) return null;

  const soundingMidi = soundingMidiForWritten(parsed.midi, instrument);
  const choice = selectSample(soundingMidi, INSTRUMENT_SOUNDS[instrument].samples);
  return { soundingMidi, choice };
}
