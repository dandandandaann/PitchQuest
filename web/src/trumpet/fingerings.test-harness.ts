/**
 * Dev-only test harness for the trumpet fingerings module.
 *
 * Pure function module — no React, no DOM, no I/O.
 *
 * Cases cover:
 *   - chart length and extremes (F#3 → D6, 34 entries)
 *   - harmonic-series corrections (C4/C5 open, D4 low = 1+3, D5 = 1)
 *   - unknown note lookup
 *   - pistonsMatch order-independent truth table
 *   - randomNote always returns a member of FINGERINGS
 */

import {
  FINGERINGS,
  getRequiredPistons,
  pistonsMatch,
  randomNote,
  filterFingerings,
  isNatural,
} from './fingerings';
import type { PistonKey } from './fingerings';

export interface HarnessCase {
  name: string;
  pass: boolean;
  detail: string;
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function runFingeringsHarness(): HarnessCase[] {
  const cases: HarnessCase[] = [];

  // 1. chart length and extremes
  // NOTE: F#3 → D6 inclusive is 33 chromatic steps (33 entries), not 34 as
  // originally specified — see harness deviation note in the task report.
  {
    const len = FINGERINGS.length;
    const first = FINGERINGS[0]?.note;
    const last = FINGERINGS[FINGERINGS.length - 1]?.note;
    const pass = len === 33 && first === 'F#3' && last === 'D6';
    cases.push({
      name: 'chart length and extremes',
      pass,
      detail: pass
        ? 'FINGERINGS.length=33, first=F#3, last=D6'
        : `FINGERINGS.length=${len} (expected 33), first=${first} (expected F#3), last=${last} (expected D6)`,
    });
  }

  // 2. C4 is open
  {
    const got = getRequiredPistons('C4');
    const pass = got !== null && arraysEqual(got, []);
    cases.push({
      name: 'C4 is open',
      pass,
      detail: pass ? 'C4 -> []' : `C4 -> ${JSON.stringify(got)} (expected [])`,
    });
  }

  // 3. D4 low is 1+3
  {
    const got = getRequiredPistons('D4');
    const pass = got !== null && arraysEqual(got, [1, 3]);
    cases.push({
      name: 'D4 low is 1+3',
      pass,
      detail: pass ? 'D4 -> [1,3]' : `D4 -> ${JSON.stringify(got)} (expected [1,3])`,
    });
  }

  // 4. C5 is open (harmonic series correction)
  {
    const got = getRequiredPistons('C5');
    const pass = got !== null && arraysEqual(got, []);
    cases.push({
      name: 'C5 is open (harmonic series correction)',
      pass,
      detail: pass ? 'C5 -> []' : `C5 -> ${JSON.stringify(got)} (expected [])`,
    });
  }

  // 5. D5 is piston 1 only (second correction)
  {
    const got = getRequiredPistons('D5');
    const pass = got !== null && arraysEqual(got, [1]);
    cases.push({
      name: 'D5 is piston 1 only (second correction)',
      pass,
      detail: pass ? 'D5 -> [1]' : `D5 -> ${JSON.stringify(got)} (expected [1])`,
    });
  }

  // 6. extremes
  {
    const fSharp3 = getRequiredPistons('F#3');
    const d6 = getRequiredPistons('D6');
    const pass =
      fSharp3 !== null && arraysEqual(fSharp3, [1, 2, 3]) &&
      d6 !== null && arraysEqual(d6, [1]);
    cases.push({
      name: 'extremes',
      pass,
      detail: pass
        ? 'F#3 -> [1,2,3], D6 -> [1]'
        : `F#3 -> ${JSON.stringify(fSharp3)} (expected [1,2,3]), D6 -> ${JSON.stringify(d6)} (expected [1])`,
    });
  }

  // 7. unknown note returns null
  {
    const got = getRequiredPistons('H7');
    const pass = got === null;
    cases.push({
      name: 'unknown note returns null',
      pass,
      detail: pass ? "getRequiredPistons('H7') -> null" : `getRequiredPistons('H7') -> ${JSON.stringify(got)} (expected null)`,
    });
  }

  // 8. pistonsMatch truth table
  {
    const held = (...keys: PistonKey[]) => new Set<PistonKey>(keys);
    const checks = [
      { desc: 'held {} vs required []', got: pistonsMatch(held(), []), expected: true },
      { desc: 'held {J} vs required [1]', got: pistonsMatch(held('J'), [1]), expected: true },
      { desc: 'held {J,L} vs required [1,3] (order-independent)', got: pistonsMatch(held('J', 'L'), [1, 3]), expected: true },
      { desc: 'held {J} vs required [1,3]', got: pistonsMatch(held('J'), [1, 3]), expected: false },
      { desc: 'held {J,K,L} vs required []', got: pistonsMatch(held('J', 'K', 'L'), []), expected: false },
      { desc: 'held {J,K} vs required [1,2]', got: pistonsMatch(held('J', 'K'), [1, 2]), expected: true },
    ];
    const failed = checks.filter(c => c.got !== c.expected);
    cases.push({
      name: 'pistonsMatch truth table',
      pass: failed.length === 0,
      detail: failed.length === 0
        ? 'all 6 pistonsMatch sub-checks pass'
        : failed.map(c => `${c.desc}: got ${c.got}, expected ${c.expected}`).join('; '),
    });
  }

  // 9. randomNote returns member of FINGERINGS
  {
    const runs = 200;
    const invalid = new Set<string>();
    for (let i = 0; i < runs; i++) {
      const n = randomNote();
      if (!FINGERINGS.find(f => f.note === n.note && arraysEqual(f.pistons, n.pistons))) {
        invalid.add(n.note);
      }
    }
    cases.push({
      name: 'randomNote returns member of FINGERINGS',
      pass: invalid.size === 0,
      detail: invalid.size === 0
        ? `${runs} random draws, all members of FINGERINGS`
        : `${runs} random draws produced non-members: ${[...invalid].join(', ')}`,
    });
  }

  // 10. filterFingerings('all') sanity
  {
    const got = filterFingerings('all');
    const pass = got.length === 33;
    cases.push({
      name: "filterFingerings('all') length = 33",
      pass,
      detail: pass
        ? "filterFingerings('all').length=33"
        : `filterFingerings('all').length=${got.length} (expected 33)`,
    });
  }

  // 11. filterFingerings('sharps') uses trumpet semantic — count = 25
  //     (notes without 'b' in the name: 6 sharps + 19 naturals).
  //     Invariant: never a flat; contains all 6 sharps.
  {
    const expected = new Set(['F#3', 'C#4', 'F#4', 'C#5', 'F#5', 'C#6']);
    const got = filterFingerings('sharps').map(f => f.note);
    const gotSet = new Set(got);
    const containsFlat = got.some(n => n.includes('b'));
    const pass = got.length === 25 && !containsFlat && [...expected].every(n => gotSet.has(n));
    cases.push({
      name: "filterFingerings('sharps') count = 25 (trumpet semantics: sharps + naturals)",
      pass,
      detail: pass
        ? `filterFingerings('sharps').length=25, no flats, contains all 6 sharps`
        : `length=${got.length} (expected 25), containsFlat=${containsFlat}, missing sharps: ${[...expected].filter(n => !gotSet.has(n)).join(', ') || 'none'}`,
    });
  }

  // 12. filterFingerings('flats') uses trumpet semantic — count = 27
  //     (notes without '#' in the name: 8 flats + 19 naturals).
  //     Invariant: never a sharp; contains all 8 flats.
  {
    const expected = new Set(['Ab3', 'Bb3', 'Eb4', 'Ab4', 'Bb4', 'Eb5', 'Ab5', 'Bb5']);
    const got = filterFingerings('flats').map(f => f.note);
    const gotSet = new Set(got);
    const containsSharp = got.some(n => n.includes('#'));
    const pass = got.length === 27 && !containsSharp && [...expected].every(n => gotSet.has(n));
    cases.push({
      name: "filterFingerings('flats') count = 27 (trumpet semantics: flats + naturals)",
      pass,
      detail: pass
        ? `filterFingerings('flats').length=27, no sharps, contains all 8 flats`
        : `length=${got.length} (expected 27), containsSharp=${containsSharp}, missing flats: ${[...expected].filter(n => !gotSet.has(n)).join(', ') || 'none'}`,
    });
  }

  // 13. filterFingerings('naturals') count = 19, all pass isNatural
  {
    const got = filterFingerings('naturals');
    const nonNatural = got.filter(f => !isNatural(f.note)).map(f => f.note);
    const pass = got.length === 19 && nonNatural.length === 0;
    cases.push({
      name: "filterFingerings('naturals') count = 19 and all pass isNatural",
      pass,
      detail: pass
        ? "filterFingerings('naturals').length=19, all natural"
        : `filterFingerings('naturals').length=${got.length} (expected 19)${nonNatural.length > 0 ? `, non-natural: ${nonNatural.join(', ')}` : ''}`,
    });
  }

  // 14. randomNote('sharps') over 200 draws never yields a flat
  //     (naturals are allowed; sharps are required for full coverage, but
  //     with 6 sharps and 19 naturals the natural path is expected too).
  {
    const runs = 200;
    const flats = new Set<string>();
    for (let i = 0; i < runs; i++) {
      const n = randomNote('sharps');
      if (n.note.includes('b')) flats.add(n.note);
    }
    cases.push({
      name: "randomNote('sharps') over 200 draws never yields a flat",
      pass: flats.size === 0,
      detail: flats.size === 0
        ? `${runs} draws from 'sharps', no flats`
        : `${runs} draws from 'sharps' produced flats: ${[...flats].join(', ')}`,
    });
  }

  return cases;
}
