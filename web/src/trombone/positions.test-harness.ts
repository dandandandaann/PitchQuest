/**
 * Dev-only test harness for the trombone slide-position module.
 *
 * Pure function module — no React, no DOM, no I/O.
 *
 * Cases cover:
 *   - table length and extremes (E2 → F4, 26 entries)
 *   - spot lookups across all partials (F3→1, F#3→5, B3→7, C4→6, E2→7, F4→1, Db4→5)
 *   - unknown note lookup
 *   - positionMatches strict-equality truth table
 *   - filter counts (all=26, naturals=16, sharps=18, flats=24)
 *   - randomNote always returns a member of POSITIONS
 *   - isNatural truth table
 */

import {
  POSITIONS,
  getRequiredPosition,
  positionMatches,
  randomNote,
  filterPositions,
  isNatural,
} from './positions';
import type { PositionId } from './positions';

export interface HarnessCase {
  name: string;
  pass: boolean;
  detail: string;
}

export function runPositionsHarness(): HarnessCase[] {
  const cases: HarnessCase[] = [];

  // 1. table length and extremes
  {
    const len = POSITIONS.length;
    const first = POSITIONS[0]?.note;
    const last = POSITIONS[POSITIONS.length - 1]?.note;
    const pass = len === 26 && first === 'E2' && last === 'F4';
    cases.push({
      name: 'table length and extremes',
      pass,
      detail: pass
        ? 'POSITIONS.length=26, first=E2, last=F4'
        : `POSITIONS.length=${len} (expected 26), first=${first} (expected E2), last=${last} (expected F4)`,
    });
  }

  // 2. spot lookups
  {
    const expected: Record<string, PositionId> = {
      F3: 1, 'F#3': 5, B3: 7, C4: 6, E2: 7, F4: 1, Db4: 5,
    };
    const mismatches: string[] = [];
    for (const [note, pos] of Object.entries(expected)) {
      const got = getRequiredPosition(note);
      if (got !== pos) mismatches.push(`${note} -> ${got} (expected ${pos})`);
    }
    cases.push({
      name: 'spot lookups (F3=1, F#3=5, B3=7, C4=6, E2=7, F4=1, Db4=5)',
      pass: mismatches.length === 0,
      detail: mismatches.length === 0
        ? 'all 7 spot lookups correct'
        : mismatches.join('; '),
    });
  }

  // 3. F#3 is position 5, not 1 (harmonic-series correction)
  {
    const got = getRequiredPosition('F#3');
    const pass = got === 5;
    cases.push({
      name: 'F#3 is position 5 (harmonic series correction)',
      pass,
      detail: pass ? "F#3 -> 5" : `F#3 -> ${got} (expected 5)`,
    });
  }

  // 4. unknown note returns null
  {
    const got = getRequiredPosition('X4');
    const pass = got === null;
    cases.push({
      name: 'unknown note returns null',
      pass,
      detail: pass ? "getRequiredPosition('X4') -> null" : `getRequiredPosition('X4') -> ${got} (expected null)`,
    });
  }

  // 5. positionMatches truth table
  {
    const checks = [
      { desc: 'held 4 vs required 4', got: positionMatches(4, 4), expected: true },
      { desc: 'held 4 vs required 5', got: positionMatches(4, 5), expected: false },
      { desc: 'held null vs required 1', got: positionMatches(null, 1), expected: false },
      { desc: 'held 7 vs required 7', got: positionMatches(7, 7), expected: true },
      { desc: 'held 1 vs required 7', got: positionMatches(1, 7), expected: false },
    ];
    const failed = checks.filter(c => c.got !== c.expected);
    cases.push({
      name: 'positionMatches truth table',
      pass: failed.length === 0,
      detail: failed.length === 0
        ? 'all 5 positionMatches sub-checks pass'
        : failed.map(c => `${c.desc}: got ${c.got}, expected ${c.expected}`).join('; '),
    });
  }

  // 6. randomNote returns member of POSITIONS
  {
    const runs = 200;
    const invalid = new Set<string>();
    for (let i = 0; i < runs; i++) {
      const n = randomNote();
      const found = POSITIONS.find(p => p.note === n.note && p.position === n.position);
      if (!found) invalid.add(n.note);
    }
    cases.push({
      name: 'randomNote returns member of POSITIONS',
      pass: invalid.size === 0,
      detail: invalid.size === 0
        ? `${runs} random draws, all members of POSITIONS`
        : `${runs} random draws produced non-members: ${[...invalid].join(', ')}`,
    });
  }

  // 7. filterPositions('all') length = 26
  {
    const got = filterPositions('all');
    const pass = got.length === 26;
    cases.push({
      name: "filterPositions('all') length = 26",
      pass,
      detail: pass
        ? "filterPositions('all').length=26"
        : `filterPositions('all').length=${got.length} (expected 26)`,
    });
  }

  // 8. filterPositions('naturals') count = 16, all pass isNatural
  {
    const got = filterPositions('naturals');
    const nonNatural = got.filter(p => !isNatural(p.note)).map(p => p.note);
    const pass = got.length === 16 && nonNatural.length === 0;
    cases.push({
      name: "filterPositions('naturals') count = 16 and all pass isNatural",
      pass,
      detail: pass
        ? "filterPositions('naturals').length=16, all natural"
        : `filterPositions('naturals').length=${got.length} (expected 16)${nonNatural.length > 0 ? `, non-natural: ${nonNatural.join(', ')}` : ''}`,
    });
  }

  // 9. filterPositions('sharps') count = 18 (trumpet semantics: notes without 'b' in the name)
  {
    const got = filterPositions('sharps');
    const pass = got.length === 18;
    cases.push({
      name: "filterPositions('sharps') count = 18",
      pass,
      detail: pass
        ? `filterPositions('sharps').length=18 (${got.map(p => p.note).join(', ')})`
        : `filterPositions('sharps').length=${got.length} (expected 18): ${got.map(p => p.note).join(', ')}`,
    });
  }

  // 10. filterPositions('flats') count = 24 (everything except the two F# notes)
  {
    const got = filterPositions('flats');
    const pass = got.length === 24;
    cases.push({
      name: "filterPositions('flats') count = 24",
      pass,
      detail: pass
        ? "filterPositions('flats').length=24"
        : `filterPositions('flats').length=${got.length} (expected 24)`,
    });
  }

  // 11. randomNote('flats') over 200 draws always yields a note without '#'
  {
    const runs = 200;
    const invalid = new Set<string>();
    for (let i = 0; i < runs; i++) {
      const n = randomNote('flats');
      if (n.note.includes('#')) invalid.add(n.note);
    }
    cases.push({
      name: "randomNote('flats') over 200 draws always yields a note without '#'",
      pass: invalid.size === 0,
      detail: invalid.size === 0
        ? `${runs} draws from 'flats', none contain #`
        : `${runs} draws from 'flats' produced notes with #: ${[...invalid].join(', ')}`,
    });
  }

  // 12. isNatural truth table
  {
    const checks = [
      { note: 'E2', expected: true },
      { note: 'F#3', expected: false },
      { note: 'Bb2', expected: false },
      { note: 'Db4', expected: false },
      { note: 'C4', expected: true },
    ];
    const failed = checks.filter(c => isNatural(c.note) !== c.expected);
    cases.push({
      name: 'isNatural truth table',
      pass: failed.length === 0,
      detail: failed.length === 0
        ? 'all 5 isNatural sub-checks pass'
        : failed.map(c => `isNatural(${c.note}) expected ${c.expected}`).join('; '),
    });
  }

  return cases;
}
