/**
 * Dev-only test harness for SlideControl's pure helpers.
 *
 * No React, no DOM — just exercises `clampPosition`, `positionFromRatio`
 * and `detentPct` from `slidePositions.ts` against hand-traced expectations.
 */

import { clampPosition, detentPct, positionFromRatio } from './slidePositions';

interface SlideControlCase {
  name: string;
  actual: number;
  expected: number;
}

/** Count backwards steps of positionFromRatio over a uniform 0..1 sweep. */
function countNonMonotonicSteps(): number {
  let violations = 0;
  let prev = positionFromRatio(0);
  for (let i = 1; i <= 100; i += 1) {
    const next = positionFromRatio(i / 100);
    if (next < prev) violations += 1;
    prev = next;
  }
  return violations;
}

/** 1 when two calls with the same argument agree (pure), 0 otherwise. */
function repeatCallStable(call: () => number): number {
  return call() === call() ? 1 : 0;
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
  // Endpoint boundaries: values just inside/outside the [0, 1] domain.
  { name: 'positionFromRatio(-0.001) === 1 (clamped)', actual: positionFromRatio(-0.001), expected: 1 },
  { name: 'positionFromRatio(0.999) === 7', actual: positionFromRatio(0.999), expected: 7 },
  { name: 'positionFromRatio(1.001) === 7 (clamped)', actual: positionFromRatio(1.001), expected: 7 },
  // Interior detents: the detentPct-derived ratio for each position 2..6 lands
  // exactly on that position.
  { name: 'positionFromRatio(detentPct(2)/100) === 2', actual: positionFromRatio(detentPct(2) / 100), expected: 2 },
  { name: 'positionFromRatio(detentPct(3)/100) === 3', actual: positionFromRatio(detentPct(3) / 100), expected: 3 },
  { name: 'positionFromRatio(detentPct(4)/100) === 4', actual: positionFromRatio(detentPct(4) / 100), expected: 4 },
  { name: 'positionFromRatio(detentPct(5)/100) === 5', actual: positionFromRatio(detentPct(5) / 100), expected: 5 },
  { name: 'positionFromRatio(detentPct(6)/100) === 6', actual: positionFromRatio(detentPct(6) / 100), expected: 6 },
  // Round-trip: every position's detent percentage maps back to itself.
  { name: 'round-trip detentPct(1)/100 → 1', actual: positionFromRatio(detentPct(1) / 100), expected: 1 },
  { name: 'round-trip detentPct(2)/100 → 2', actual: positionFromRatio(detentPct(2) / 100), expected: 2 },
  { name: 'round-trip detentPct(3)/100 → 3', actual: positionFromRatio(detentPct(3) / 100), expected: 3 },
  { name: 'round-trip detentPct(4)/100 → 4', actual: positionFromRatio(detentPct(4) / 100), expected: 4 },
  { name: 'round-trip detentPct(5)/100 → 5', actual: positionFromRatio(detentPct(5) / 100), expected: 5 },
  { name: 'round-trip detentPct(6)/100 → 6', actual: positionFromRatio(detentPct(6) / 100), expected: 6 },
  { name: 'round-trip detentPct(7)/100 → 7', actual: positionFromRatio(detentPct(7) / 100), expected: 7 },
  // detentPct endpoints: position 1 sits at 0%, position 7 at 100% of the band.
  { name: 'detentPct(1) === 0', actual: detentPct(1), expected: 0 },
  { name: 'detentPct(7) === 100', actual: detentPct(7), expected: 100 },
  // Monotonicity: a 0..1 sweep never steps backwards.
  {
    name: 'positionFromRatio is non-decreasing across a 0..1 sweep (0 violations)',
    actual: countNonMonotonicSteps(),
    expected: 0,
  },
  // Purity: identical arguments yield identical results (no hidden state).
  {
    name: 'positionFromRatio(0.37) repeat call is identical (1 = stable)',
    actual: repeatCallStable(() => positionFromRatio(0.37)),
    expected: 1,
  },
  {
    name: 'clampPosition(3.49) repeat call is identical (1 = stable)',
    actual: repeatCallStable(() => clampPosition(3.49)),
    expected: 1,
  },
  {
    name: 'detentPct(5) repeat call is identical (1 = stable)',
    actual: repeatCallStable(() => detentPct(5)),
    expected: 1,
  },
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
