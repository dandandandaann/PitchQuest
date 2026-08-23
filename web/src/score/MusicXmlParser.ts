import type { ExpectedNote, ParseMusicXmlOptions } from './types';

/** Step letter → pitch class (semitone offset within an octave). */
const STEP_TO_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Note names keyed by pitch class, in flats-style. Mirrors `NOTES` in
 * `audio/utils/pitch-math.ts` so `noteName` output matches `DetectedNote`.
 */
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * MusicXML `<type>` → duration in quarter notes.
 *
 * Unknown types (32nd, 64th, 128th, breve, etc.) are intentionally omitted:
 * if a piece uses them, the caller should supply `<duration>` directly.
 */
const TYPE_TO_QUARTERS: Record<string, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
};

/**
 * MusicXML parser for PitchQuest (Roadmap Stage 3).
 *
 * v1 limitations (intentional):
 *  - Single part only (uses the first <part> element).
 *  - Single voice (no <voice> filtering).
 *  - No <chord> (throws if encountered).
 *  - Rests advance the beat counter without emitting an ExpectedNote.
 *  - No <backup>, <forward>, repeats, ties, grace notes.
 *  - No <transpose>; pitches are absolute.
 *  - No <key>/<time>/<sound tempo> parsing for beat conversion. The caller
 *    supplies bpm via options; divisions per beat is read from <divisions>.
 *  - No <fermata>, dynamics, articulations, lyrics, beams — all ignored.
 *  - Pitch output is FLATS-style (e.g. "Db5" not "C#5") to match what
 *    `NoteSegmenter` produces via `frequencyToNote`.
 */
export function parseMusicXml(xml: string, opts: ParseMusicXmlOptions): ExpectedNote[] {
  // `bpm` is part of the API for downstream consumers (scoring, beat→ms
  // conversion). The parser itself only deals in beats, so it doesn't
  // reference opts.bpm in the body. Silence unused-var without changing
  // the signature.
  void opts.bpm;

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError !== null) {
    throw new Error(
      `parseMusicXml: invalid XML — ${parserError.textContent ?? 'unknown parse error'}`,
    );
  }

  const part = doc.querySelector('part');
  if (part === null) {
    throw new Error('parseMusicXml: no <part> element found');
  }

  // <divisions> lives in the first measure's <attributes>. Default to 1
  // (each duration unit = one beat) if absent — MusicXML technically
  // requires it, but we tolerate well-formed-looking scores that omit it.
  const firstMeasure = part.querySelector('measure');
  const divisionsEl = firstMeasure?.querySelector('attributes > divisions');
  const divisions = divisionsEl
    ? Number.parseInt(divisionsEl.textContent ?? '1', 10)
    : 1;
  if (divisions <= 0) {
    throw new Error(`parseMusicXml: invalid <divisions> value: ${divisions}`);
  }

  let currentBeat = 0;
  const out: ExpectedNote[] = [];

  for (const measure of Array.from(part.querySelectorAll('measure'))) {
    for (const note of Array.from(measure.querySelectorAll(':scope > note'))) {
      // <chord> would mean this note starts at the same beat as the
      // previous one. Stage 4's scorer is monophonic, so we refuse rather
      // than guess.
      if (note.querySelector('chord') !== null) {
        throw new Error('parseMusicXml: <chord> not supported in v1');
      }

      // Duration: prefer the explicit integer <duration>/divisions path
      // (most common in exported scores), fall back to <type>+<time>.
      // Computed first because BOTH pitched notes and rests need it:
      // rests consume time even though they emit no ExpectedNote.
      const durationStr = note.querySelector('duration')?.textContent?.trim();
      const typeStr = note.querySelector('type')?.textContent?.trim();

      let durationBeats: number;
      if (durationStr !== undefined && durationStr !== '') {
        const duration = Number.parseInt(durationStr, 10);
        durationBeats = duration / divisions;
      } else if (typeStr && TYPE_TO_QUARTERS[typeStr] !== undefined) {
        // Re-read <time> per measure in case it changes mid-piece.
        const mTimeEl = measure.querySelector('attributes > time');
        const mBeatType = mTimeEl
          ? Number.parseInt(mTimeEl.querySelector('beat-type')?.textContent ?? '4', 10)
          : 4;
        // A quarter note is always 1/4 of a whole, and 1 beat is always
        // 1/<beatType> of a whole. So a quarter = (1/4) / (1/beatType)
        // = beatType/4 beats. Examples: 4/4 quarter = 1, 6/8 quarter = 2,
        // 6/8 whole = 8.
        durationBeats = TYPE_TO_QUARTERS[typeStr] * (mBeatType / 4);
      } else {
        throw new Error('parseMusicXml: note has no <duration> and unknown <type>');
      }

      // Rests advance the beat counter but emit no ExpectedNote.
      if (note.querySelector('rest') !== null) {
        currentBeat += durationBeats;
        continue;
      }

      const step = note.querySelector('pitch > step')?.textContent?.trim();
      const alterStr = note.querySelector('pitch > alter')?.textContent?.trim();
      const octaveStr = note.querySelector('pitch > octave')?.textContent?.trim();

      if (!step || !octaveStr) {
        throw new Error('parseMusicXml: missing <step> or <octave> in note');
      }
      const pcForStep = STEP_TO_PC[step];
      if (pcForStep === undefined) {
        throw new Error(`parseMusicXml: invalid step "${step}"`);
      }

      const alter = alterStr ? Number.parseInt(alterStr, 10) : 0;
      const octave = Number.parseInt(octaveStr, 10);
      const pc = pcForStep + alter;
      const midi = (octave + 1) * 12 + pc;
      // FLAT_NAMES lookup handles sharps gracefully too: B# → C, E# → F.
      const noteName = FLAT_NAMES[((pc % 12) + 12) % 12] + octave;

      out.push({ noteName, midi, startBeat: currentBeat, durationBeats });
      currentBeat += durationBeats;
    }
  }

  return out;
}
