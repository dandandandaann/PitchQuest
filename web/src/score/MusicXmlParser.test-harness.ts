/**
 * Dev-only test harness for the MusicXmlParser.
 *
 * Pure function module — no React, no DOM, no I/O. Runs a battery of
 * hand-crafted MusicXML strings through `parseMusicXml` and compares the
 * emitted ExpectedNote[] against hand-traced expectations.
 *
 * The most important case here is the **rest bug regression** test: a score
 * with `[C4 quarter, rest quarter, D4 quarter]` must place D4 at startBeat=2
 * (because the rest ate one beat), not at startBeat=1.
 */

import { parseMusicXml } from './MusicXmlParser';
import type { ExpectedNote } from './types';

export interface MusicXmlCase {
  name: string;
  xml: string;
  /** BPM for the parseMusicXml options.bpm field. The parser doesn't use it
   *  yet, but it's part of the public API so we pass it through. */
  bpm: number;
  expected: ExpectedNote[];
}

export interface MusicXmlResult {
  pass: number;
  fail: number;
  details: { name: string; pass: boolean; diff?: string }[];
}

// ---------------------------------------------------------------------------
// Test fixtures. Each XML is a minimal, hand-traced score-partwise.
// ---------------------------------------------------------------------------

const cMajorScaleXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

const wholeNoteXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

// F#5 via <alter>1</alter>. FLAT_NAMES normalizes: pc=6+1=7 → "G", then
// we apply the alter to the spelling, so F#5 must come out as "Gb5".
// (G5 = midi 79; Gb5 = midi 78.)
const sharpToFlatXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

const emptyScoreXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
    </measure>
  </part>
</score-partwise>`;

// THE regression test: note + rest + note in a single measure. With the
// rest-advances-currentBeat fix, D4 must land at startBeat=2, not startBeat=1.
const restBugXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><rest/><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

// Quarter note in 6/8 time. A quarter is 2 eighths; with beat-type=8, each
// beat IS an eighth, so a quarter = 2 beats. (TYPE_TO_QUARTERS.quarter = 1,
// mBeatType = 8, so durationBeats = 1 * (8/4) = 2.)
const quarterIn68Xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>6</beats><beat-type>8</beat-type></time>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

// <duration> takes precedence over <type>. With divisions=2, a <duration>3
// note is 1.5 beats even though its <type> says half (which would normally
// mean 2 beats). Verifies the explicit-duration branch wins.
const durationWinsOverTypeXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>3</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

export const MUSIC_XML_CASES: MusicXmlCase[] = [
  {
    name: 'C-major scale ascending (8 quarters in 4/4)',
    xml: cMajorScaleXml,
    bpm: 80,
    expected: [
      { noteName: 'C4', midi: 60, startBeat: 0, durationBeats: 1 },
      { noteName: 'D4', midi: 62, startBeat: 1, durationBeats: 1 },
      { noteName: 'E4', midi: 64, startBeat: 2, durationBeats: 1 },
      { noteName: 'F4', midi: 65, startBeat: 3, durationBeats: 1 },
      { noteName: 'G4', midi: 67, startBeat: 4, durationBeats: 1 },
      { noteName: 'A4', midi: 69, startBeat: 5, durationBeats: 1 },
      { noteName: 'B4', midi: 71, startBeat: 6, durationBeats: 1 },
      { noteName: 'C5', midi: 72, startBeat: 7, durationBeats: 1 },
    ],
  },

  {
    name: 'single whole note (4/4, type only, no <duration>)',
    xml: wholeNoteXml,
    bpm: 60,
    expected: [{ noteName: 'C4', midi: 60, startBeat: 0, durationBeats: 4 }],
  },

  {
    name: 'F#5 sharp-to-flat normalization → Gb5',
    xml: sharpToFlatXml,
    bpm: 80,
    expected: [{ noteName: 'Gb5', midi: 78, startBeat: 0, durationBeats: 1 }],
  },

  {
    name: 'empty score (measure with no notes) → []',
    xml: emptyScoreXml,
    bpm: 80,
    expected: [],
  },

  // THE regression test for the rest-advances-currentBeat bug. Without the
  // fix, D4 ends up at startBeat=1 (currentBeat never advances past the rest).
  // With the fix, D4 is at startBeat=2. This case would FAIL on the old
  // parser; the dev panel MUST show it passing after the fix lands.
  {
    name: 'REST BUG REGRESSION: note + rest + note → D4 at beat 2, not 1',
    xml: restBugXml,
    bpm: 80,
    expected: [
      { noteName: 'C4', midi: 60, startBeat: 0, durationBeats: 1 },
      { noteName: 'D4', midi: 62, startBeat: 2, durationBeats: 1 },
    ],
  },

  {
    name: 'quarter in 6/8 time → 2 beats',
    xml: quarterIn68Xml,
    bpm: 80,
    expected: [{ noteName: 'C4', midi: 60, startBeat: 0, durationBeats: 2 }],
  },

  {
    name: '<duration> preferred over <type> (divisions=2, duration=3 → 1.5 beats)',
    xml: durationWinsOverTypeXml,
    bpm: 80,
    expected: [{ noteName: 'C4', midi: 60, startBeat: 0, durationBeats: 1.5 }],
  },
];

/** Allowed slack on `startBeat` / `durationBeats` to absorb float wobble. */
const BEAT_TOLERANCE = 0.005;

function diffCase(actual: ExpectedNote[], expected: ExpectedNote[]): string | undefined {
  if (actual.length !== expected.length) {
    return `expected length ${expected.length}, got ${actual.length}`;
  }
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];
    if (a.noteName !== e.noteName) {
      return `case[${i}].noteName: expected ${e.noteName}, got ${a.noteName}`;
    }
    if (a.midi !== e.midi) {
      return `case[${i}].midi: expected ${e.midi}, got ${a.midi}`;
    }
    if (Math.abs(a.startBeat - e.startBeat) > BEAT_TOLERANCE) {
      return `case[${i}].startBeat: expected ${e.startBeat}, got ${a.startBeat}`;
    }
    if (Math.abs(a.durationBeats - e.durationBeats) > BEAT_TOLERANCE) {
      return `case[${i}].durationBeats: expected ${e.durationBeats}, got ${a.durationBeats}`;
    }
  }
  return undefined;
}

export function runMusicXmlParserHarness(): MusicXmlResult {
  const details: MusicXmlResult['details'] = [];
  let pass = 0;
  let fail = 0;

  for (const c of MUSIC_XML_CASES) {
    let actual: ExpectedNote[];
    let parseError: string | undefined;
    try {
      actual = parseMusicXml(c.xml, { bpm: c.bpm });
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
      actual = [];
    }

    const diff = parseError !== undefined ? `parse threw: ${parseError}` : diffCase(actual, c.expected);
    if (diff === undefined) {
      pass += 1;
      details.push({ name: c.name, pass: true });
    } else {
      fail += 1;
      details.push({ name: c.name, pass: false, diff });
    }
  }

  return { pass, fail, details };
}
