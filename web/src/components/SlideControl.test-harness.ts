/**
 * Dev-only test harness for SlideControl's pure helpers.
 *
 * No React, no DOM — just exercises `clampPosition` and `positionFromRatio`
 * from `slidePositions.ts` against hand-traced expectations.
 */

import { clampPosition, positionFromRatio } from './slidePositions';

interface SlideControlCase {
  name: string;
  actual: number;
  expected: number;
}

const cases: SlideControlCase[] = [
  // clampPosition: clamps to the 1..7 detent range, rounding halves.
  { name: 'clampPosition(0) === 1', actual: clampPosition(0), expected: 1 },
  { name: 'clampPosition(1) === 1', actual: clampPosition(1), expected: 1 },
  { name: 'clampPosition(4) === 4', actual: clampPosition(4), expected: 4 },
  { name: 'clampPosition(7) === 7', actual: clampPosition(7), expected: 7 },
  { name: 'clampPosition(8) === 7', actual: clampPosition(8), expected: 7 },
  { name: 'clampPosition(-3) === 1', actual: clampPosition(-3), expected: 1 },
  // positionFromRatio: 0..1 maps to positions 1..7; out-of-range ratios clamp first.
  { name: 'positionFromRatio(0) === 1', actual: positionFromRatio(0), expected: 1 },
  { name: 'positionFromRatio(0.5) === 4', actual: positionFromRatio(0.5), expected: 4 },
  { name: 'positionFromRatio(1) === 7', actual: positionFromRatio(1), expected: 7 },
  { name: 'positionFromRatio(-0.1) === 1 (clamped)', actual: positionFromRatio(-0.1), expected: 1 },
  { name: 'positionFromRatio(1.5) === 7 (clamped)', actual: positionFromRatio(1.5), expected: 7 },
];

export function runSlideControlHarness(): string {
  let pass = 0;
  const failures: string[] = [];

  for (const c of cases) {
    if (c.actual === c.expected) {
      pass += 1;
    } else {
      failures.push(`${c.name} — got ${c.actual}, expected ${c.expected}`);
    }
  }

  if (failures.length > 0) {
    console.error('SlideControl harness failures:');
    failures.forEach(f => console.error(`  ✗ ${f}`));
  }

  return `SlideControl harness: ${pass}/${cases.length} pass`;
}
