/**
 * Dev-only test harness for the sound module (noteMath + envelope + sampleSets +
 * selectSample).
 *
 * Pure function module — no React, no DOM, no I/O.
 *
 * Cases cover:
 *   - parseNoteName valid mappings, field population, malformed input (null, no throw)
 *   - "Cb4" grammar edge case
 *   - noteNameToMidi throws a descriptive Error
 *   - midiToFrequency anchors + custom A4
 *   - INTEGRATION: every FINGERINGS / POSITIONS note parses
 *   - midiToNoteName flat/sharp spelling + round-trip 40..84
 *   - DEFAULT_ENVELOPE duration and SLICE_SEC bound
 *   - envelopeGainAt point values + attack/release monotonicity
 *   - selectSample tie-breaking and empty-list throw
 *   - transposition anchors for trumpet and trombone
 *   - exhaustive |cents| bound across both drill tables
 *   - choiceForWrittenNote invalid input
 *   - sample path sanity (relative, zero-padded, matches midi)
 */

import { FINGERINGS } from '../trumpet/fingerings';
import { POSITIONS } from '../trombone/positions';
import {
  parseNoteName,
  noteNameToMidi,
  midiToFrequency,
  midiToNoteName,
} from './noteMath';
import { DEFAULT_ENVELOPE, envelopeDuration, envelopeGainAt } from './envelope';
import { INSTRUMENT_SOUNDS, SLICE_SEC } from './sampleSets';
import type { InstrumentId, SoundSample } from './sampleSets';
import { selectSample, choiceForWrittenNote } from './selectSample';

export interface HarnessCase {
  name: string;
  pass: boolean;
  detail: string;
}

export function runSoundHarness(): HarnessCase[] {
  const cases: HarnessCase[] = [];

  // 1. parseNoteName valid mappings
  {
    const expected: Record<string, number> = {
      C4: 60, A4: 69, 'F#3': 54, Bb4: 70, Db3: 49, Eb5: 75, 'C#5': 73, Ab3: 56, E2: 40,
    };
    const mismatches: string[] = [];
    for (const [note, midi] of Object.entries(expected)) {
      const parsed = parseNoteName(note);
      if (parsed === null || parsed.midi !== midi) {
        mismatches.push(`${note} -> ${parsed === null ? 'null' : parsed.midi} (expected ${midi})`);
      }
    }
    cases.push({
      name: 'parseNoteName valid mappings (9 notes)',
      pass: mismatches.length === 0,
      detail: mismatches.length === 0
        ? 'all 9 note names resolve to the expected MIDI numbers'
        : mismatches.join('; '),
    });
  }

  // 2. parseNoteName populates letter / accidental / octave fields
  {
    const checks = [
      { note: 'F#3', letter: 'F', accidental: '#', octave: 3 },
      { note: 'Bb4', letter: 'B', accidental: 'b', octave: 4 },
      { note: 'C4', letter: 'C', accidental: null, octave: 4 },
      { note: 'Db3', letter: 'D', accidental: 'b', octave: 3 },
    ];
    const failed: string[] = [];
    for (const c of checks) {
      const parsed = parseNoteName(c.note);
      if (
        parsed === null ||
        parsed.letter !== c.letter ||
        parsed.accidental !== c.accidental ||
        parsed.octave !== c.octave
      ) {
        failed.push(`${c.note} -> ${JSON.stringify(parsed)} (expected letter=${c.letter}, accidental=${String(c.accidental)}, octave=${c.octave})`);
      }
    }
    cases.push({
      name: 'parseNoteName populates letter/accidental/octave fields',
      pass: failed.length === 0,
      detail: failed.length === 0
        ? 'all 4 field checks pass'
        : failed.join('; '),
    });
  }

  // 3. parseNoteName rejects malformed input with null and never throws
  {
    const invalidInputs = ['', 'H4', 'C', 'c4', 'C4.5', ' C4', 'C4 ', '#4'];
    const problems: string[] = [];
    for (const input of invalidInputs) {
      try {
        const got = parseNoteName(input);
        if (got !== null) {
          problems.push(`${JSON.stringify(input)} -> ${JSON.stringify(got)} (expected null)`);
        }
      } catch (err) {
        problems.push(`${JSON.stringify(input)} threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    cases.push({
      name: 'parseNoteName malformed input -> null, never throws (8 inputs)',
      pass: problems.length === 0,
      detail: problems.length === 0
        ? `all 8 malformed inputs returned null without throwing (${invalidInputs.map(i => JSON.stringify(i)).join(', ')})`
        : problems.join('; '),
    });
  }

  // 4. "Cb4" is grammatically valid -> enharmonic of B3 = MIDI 59
  {
    const parsed = parseNoteName('Cb4');
    const pass = parsed !== null && parsed.midi === 59 && parsed.letter === 'C' && parsed.accidental === 'b';
    cases.push({
      name: '"Cb4" is valid (documented edge case) -> MIDI 59',
      pass,
      detail: pass
        ? 'Cb4 -> MIDI 59 (enharmonic B3), letter=C, accidental=b'
        : `Cb4 -> ${JSON.stringify(parsed)} (expected MIDI 59)`,
    });
  }

  // 5. noteNameToMidi throws a descriptive Error on "H4"
  {
    let threw = false;
    let message = '';
    try {
      noteNameToMidi('H4');
    } catch (err) {
      threw = true;
      message = err instanceof Error ? err.message : String(err);
    }
    const pass = threw && message.includes('H4');
    cases.push({
      name: 'noteNameToMidi throws descriptive Error for "H4"',
      pass,
      detail: pass
        ? `threw: ${message}`
        : threw ? `threw but message lacked "H4": ${message}` : 'did not throw',
    });
  }

  // 6. midiToFrequency anchors + custom A4
  {
    const checks = [
      { desc: 'midi 69', got: midiToFrequency(69), expected: 440, tol: 0 },
      { desc: 'midi 60', got: midiToFrequency(60), expected: 261.6256, tol: 0.001 },
      { desc: 'midi 52', got: midiToFrequency(52), expected: 164.8138, tol: 0.001 },
      { desc: 'midi 84', got: midiToFrequency(84), expected: 1046.502, tol: 0.01 },
      { desc: 'midi 69 @ A4=442', got: midiToFrequency(69, 442), expected: 442, tol: 0 },
    ];
    const failed = checks.filter(c => Math.abs(c.got - c.expected) > c.tol);
    cases.push({
      name: 'midiToFrequency anchors (69, 60, 52, 84) + custom A4=442',
      pass: failed.length === 0,
      detail: failed.length === 0
        ? 'all 5 frequency anchors within tolerance'
        : failed.map(c => `${c.desc}: got ${c.got}, expected ${c.expected} (±${c.tol})`).join('; '),
    });
  }

  // 7. INTEGRATION: every drill-table note parses
  {
    const bad: string[] = [];
    for (const f of FINGERINGS) {
      if (parseNoteName(f.note) === null) bad.push(`trumpet:${f.note}`);
    }
    for (const p of POSITIONS) {
      if (parseNoteName(p.note) === null) bad.push(`trombone:${p.note}`);
    }
    const pass = bad.length === 0;
    cases.push({
      name: 'INTEGRATION: every FINGERINGS + POSITIONS note parses',
      pass,
      detail: pass
        ? `${FINGERINGS.length} trumpet + ${POSITIONS.length} trombone note names all parse non-null`
        : `unparseable: ${bad.join(', ')}`,
    });
  }

  // 8. midiToNoteName flat/sharp spelling + round-trip 40..84
  {
    const flat60 = midiToNoteName(60);
    const flat61 = midiToNoteName(61);
    const sharp61 = midiToNoteName(61, 'sharp');
    const spellingPass = flat60 === 'C4' && flat61 === 'Db4' && sharp61 === 'C#4';

    const roundTripFailures: string[] = [];
    for (let m = 40; m <= 84; m++) {
      if (noteNameToMidi(midiToNoteName(m)) !== m) {
        roundTripFailures.push(`${m} -> ${midiToNoteName(m)}`);
      }
    }
    const pass = spellingPass && roundTripFailures.length === 0;
    cases.push({
      name: 'midiToNoteName flat/sharp spelling + round-trip 40..84',
      pass,
      detail: pass
        ? "60->C4, 61->Db4 (flat), 61->C#4 (sharp); round-trip 40..84 exact"
        : `spelling ${spellingPass ? 'ok' : `failed (60->${flat60}, 61->${flat61}, 61 sharp->${sharp61})`}${roundTripFailures.length > 0 ? `; round-trip failures: ${roundTripFailures.join(', ')}` : ''}`,
    });
  }

  // 9. DEFAULT_ENVELOPE duration == 0.7 and <= SLICE_SEC
  {
    const duration = envelopeDuration(DEFAULT_ENVELOPE);
    const pass = Math.abs(duration - 0.7) <= 1e-9 && duration <= SLICE_SEC;
    cases.push({
      name: 'DEFAULT_ENVELOPE duration == 0.7 (±1e-9) and <= SLICE_SEC',
      pass,
      detail: pass
        ? `duration=${duration}, SLICE_SEC=${SLICE_SEC}`
        : `duration=${duration} (expected 0.7), SLICE_SEC=${SLICE_SEC}`,
    });
  }

  // 10. envelopeGainAt point values
  {
    const total = envelopeDuration(DEFAULT_ENVELOPE);
    const attackMid = DEFAULT_ENVELOPE.attackSec / 2;
    const holdMid = DEFAULT_ENVELOPE.attackSec + DEFAULT_ENVELOPE.holdSec / 2;
    const checks = [
      { desc: 't < 0', got: envelopeGainAt(-0.1, DEFAULT_ENVELOPE), expected: 0 },
      { desc: 't = 0', got: envelopeGainAt(0, DEFAULT_ENVELOPE), expected: 0 },
      { desc: 't = attack/2', got: envelopeGainAt(attackMid, DEFAULT_ENVELOPE), expected: 0.5 },
      { desc: 't inside hold', got: envelopeGainAt(holdMid, DEFAULT_ENVELOPE), expected: 1 },
      { desc: 't = total', got: envelopeGainAt(total, DEFAULT_ENVELOPE), expected: 0 },
      { desc: 't > total', got: envelopeGainAt(total + 1, DEFAULT_ENVELOPE), expected: 0 },
    ];
    const failed = checks.filter(c => Math.abs(c.got - c.expected) > 1e-9);
    cases.push({
      name: 'envelopeGainAt point values',
      pass: failed.length === 0,
      detail: failed.length === 0
        ? 'all 6 point checks pass (t<0, t=0, attack/2=0.5, hold=1, total=0, t>total=0)'
        : failed.map(c => `${c.desc}: got ${c.got}, expected ${c.expected}`).join('; '),
    });
  }

  // 11. envelopeGainAt non-decreasing across attack
  {
    const samples = 20;
    let monotonic = true;
    let prev = -Infinity;
    for (let i = 0; i <= samples; i++) {
      const t = (DEFAULT_ENVELOPE.attackSec * i) / samples;
      const g = envelopeGainAt(t, DEFAULT_ENVELOPE);
      if (g < prev - 1e-12) monotonic = false;
      prev = g;
    }
    cases.push({
      name: 'envelopeGainAt non-decreasing across attack (20 samples)',
      pass: monotonic,
      detail: monotonic
        ? `monotonic non-decreasing across [0, ${DEFAULT_ENVELOPE.attackSec}]`
        : 'attack ramp is not monotonic non-decreasing',
    });
  }

  // 12. envelopeGainAt non-increasing across release
  {
    const total = envelopeDuration(DEFAULT_ENVELOPE);
    const releaseStart = DEFAULT_ENVELOPE.attackSec + DEFAULT_ENVELOPE.holdSec;
    const samples = 20;
    let monotonic = true;
    let prev = Infinity;
    for (let i = 0; i <= samples; i++) {
      const t = releaseStart + ((total - releaseStart) * i) / samples;
      const g = envelopeGainAt(t, DEFAULT_ENVELOPE);
      if (g > prev + 1e-12) monotonic = false;
      prev = g;
    }
    cases.push({
      name: 'envelopeGainAt non-increasing across release (20 samples)',
      pass: monotonic,
      detail: monotonic
        ? `monotonic non-increasing across [${releaseStart}, ${total}]`
        : 'release ramp is not monotonic non-increasing',
    });
  }

  // 13. selectSample tie resolves to the lower sample.midi
  {
    const samples: readonly SoundSample[] = [
      { midi: 60, path: 'a' },
      { midi: 62, path: 'b' },
    ];
    const choice = selectSample(61, samples);
    const pass = choice.sample.midi === 60 && choice.cents === 100;
    cases.push({
      name: 'selectSample tie -> lower sample.midi',
      pass,
      detail: pass
        ? 'soundingMidi 61 with [60, 62] -> sample 60 (lower), cents +100'
        : `got sample ${choice.sample.midi}, cents ${choice.cents} (expected 60, +100)`,
    });
  }

  // 14. selectSample empty list throws
  {
    let threw = false;
    try {
      selectSample(60, []);
    } catch {
      threw = true;
    }
    cases.push({
      name: 'selectSample empty list throws',
      pass: threw,
      detail: threw ? 'threw as expected' : 'did not throw',
    });
  }

  // 15. transposition anchors
  {
    const anchors: { note: string; instrument: InstrumentId; sounding: number; sample: number; cents: number }[] = [
      { note: 'F#3', instrument: 'trumpet', sounding: 52, sample: 52, cents: 0 },
      { note: 'C4', instrument: 'trumpet', sounding: 58, sample: 57, cents: 100 },
      { note: 'Bb4', instrument: 'trumpet', sounding: 68, sample: 66, cents: 200 },
      { note: 'C5', instrument: 'trumpet', sounding: 70, sample: 70, cents: 0 },
      { note: 'D6', instrument: 'trumpet', sounding: 84, sample: 84, cents: 0 },
      { note: 'E2', instrument: 'trombone', sounding: 40, sample: 40, cents: 0 },
      { note: 'C4', instrument: 'trombone', sounding: 60, sample: 60, cents: 0 },
      { note: 'F4', instrument: 'trombone', sounding: 65, sample: 65, cents: 0 },
    ];
    const failed: string[] = [];
    for (const a of anchors) {
      const res = choiceForWrittenNote(a.note, a.instrument);
      if (
        res === null ||
        res.soundingMidi !== a.sounding ||
        res.choice.sample.midi !== a.sample ||
        res.choice.cents !== a.cents
      ) {
        failed.push(
          `${a.instrument} ${a.note} -> ${res === null ? 'null' : `{sounding ${res.soundingMidi}, sample ${res.choice.sample.midi}, cents ${res.choice.cents}}`} (expected {${a.sounding}, ${a.sample}, ${a.cents}})`,
        );
      }
    }
    cases.push({
      name: 'transposition anchors (8 exact cases)',
      pass: failed.length === 0,
      detail: failed.length === 0
        ? 'all 8 anchors exact (trumpet F#3/C4/Bb4/C5/D6, trombone E2/C4/F4)'
        : failed.join('; '),
    });
  }

  // 16. exhaustive |cents| bound across FINGERINGS (trumpet)
  {
    let maxAbs = 0;
    let worst = '';
    const over: string[] = [];
    for (const f of FINGERINGS) {
      const res = choiceForWrittenNote(f.note, 'trumpet');
      if (res === null) {
        over.push(`${f.note} -> null`);
        continue;
      }
      const abs = Math.abs(res.choice.cents);
      if (abs > maxAbs) {
        maxAbs = abs;
        worst = f.note;
      }
      if (abs > 200) over.push(`${f.note} -> ${res.choice.cents}¢`);
    }
    const pass = over.length === 0;
    cases.push({
      name: 'exhaustive bound: |cents| <= 200 for every FINGERINGS note (trumpet)',
      pass,
      detail: pass
        ? `${FINGERINGS.length} notes checked, max |cents| = ${maxAbs} (at ${worst})`
        : `violations: ${over.join(', ')}; max |cents| = ${maxAbs}`,
    });
  }

  // 17. exhaustive |cents| bound across POSITIONS (trombone)
  {
    let maxAbs = 0;
    let worst = '';
    const over: string[] = [];
    for (const p of POSITIONS) {
      const res = choiceForWrittenNote(p.note, 'trombone');
      if (res === null) {
        over.push(`${p.note} -> null`);
        continue;
      }
      const abs = Math.abs(res.choice.cents);
      if (abs > maxAbs) {
        maxAbs = abs;
        worst = p.note;
      }
      if (abs > 200) over.push(`${p.note} -> ${res.choice.cents}¢`);
    }
    const pass = over.length === 0;
    cases.push({
      name: 'exhaustive bound: |cents| <= 200 for every POSITIONS note (trombone)',
      pass,
      detail: pass
        ? `${POSITIONS.length} notes checked, max |cents| = ${maxAbs} (at ${worst})`
        : `violations: ${over.join(', ')}; max |cents| = ${maxAbs}`,
    });
  }

  // 18. choiceForWrittenNote invalid input -> null, no throw
  {
    let got: { soundingMidi: number } | null = null;
    let threw = false;
    try {
      got = choiceForWrittenNote('H4', 'trumpet');
    } catch {
      threw = true;
    }
    const pass = !threw && got === null;
    cases.push({
      name: 'choiceForWrittenNote("H4", trumpet) -> null, no throw',
      pass,
      detail: pass ? 'returned null without throwing' : threw ? 'threw' : `got ${JSON.stringify(got)} (expected null)`,
    });
  }

  // 19. sample path sanity
  {
    const pathRe = /^sounds\/(trumpet|trombone)\/[a-z]+-\d{3}\.mp3$/;
    const problems: string[] = [];
    const instruments: readonly InstrumentId[] = ['trumpet', 'trombone'];
    for (const id of instruments) {
      for (const s of INSTRUMENT_SOUNDS[id].samples) {
        if (!pathRe.test(s.path)) {
          problems.push(`${id}: bad path "${s.path}"`);
          continue;
        }
        if (s.path.startsWith('/')) problems.push(`${id}: absolute path "${s.path}"`);
        const padded = String(s.midi).padStart(3, '0');
        if (!s.path.includes(`-${padded}.mp3`)) {
          problems.push(`${id}: path "${s.path}" does not encode midi ${s.midi}`);
        }
      }
    }
    const pass = problems.length === 0;
    cases.push({
      name: 'sample path sanity (relative, zero-padded, matches midi)',
      pass,
      detail: pass
        ? 'all 14 paths relative, well-formed, and encode their midi'
        : problems.join('; '),
    });
  }

  return cases;
}
