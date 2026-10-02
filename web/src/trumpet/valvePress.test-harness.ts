/**
 * Dev-only test harness for the multi-pointer valve-press bookkeeping module.
 *
 * Pure function module — no React, no DOM, no I/O.
 *
 * Cases cover:
 *   - pressValve: one press, three simultaneous presses (one per piston)
 *   - two pointers on the SAME piston — releasing one keeps the valve held
 *   - releaseValve: one-of-three release drops only that pointer
 *   - releaseValve on an unknown pointerId (no throw, no change)
 *   - releaseAll clears the map and pressing works again afterwards
 *   - immutability: the input map is never mutated by pressValve/releaseValve
 *   - a full press -> release -> releaseAll sequence stays clean
 *
 * RULE pinned by case 8 (pressValve doc): the map is keyed by pointerId and
 * is deliberately NOT deduplicated by piston — two fingers on one valve are two
 * entries so each lifts independently. Only heldPistons() collapses them.
 */

import { heldPistons, pressValve, releaseAll, releaseValve, type ValvePressMap } from './valvePress';

export interface HarnessCase {
  name: string;
  pass: boolean;
  detail: string;
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Sorted piston ids of a held set, e.g. "1,2" ("" for empty). */
function heldText(map: ValvePressMap): string {
  return [...heldPistons(map)].sort((a, b) => a - b).join(',');
}

/** Stable `pointerId->piston` dump, e.g. "10->1|11->2" — used to pin contents. */
function mapText(map: ValvePressMap): string {
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pointerId, pistonId]) => `${pointerId}->${pistonId}`)
    .join('|');
}

export function runValvePressHarness(): HarnessCase[] {
  const cases: HarnessCase[] = [];

  // 1. press one valve
  {
    const got = pressValve(releaseAll(), 10, 1);
    const held = [...heldPistons(got)].sort((a, b) => a - b);
    const pass = got.size === 1 && got.get(10) === 1 && arraysEqual(held, [1]);
    cases.push({
      name: 'press one valve -> heldPistons = {1}',
      pass,
      detail: pass
        ? 'press(10,1) -> map "10->1", held {1}'
        : `press(10,1) -> map "${mapText(got)}" (expected "10->1"), held {${heldText(got)}} (expected {1})`,
    });
  }

  // 2. three distinct pointerIds, one per piston
  {
    let got: ValvePressMap = releaseAll();
    got = pressValve(got, 1, 1);
    got = pressValve(got, 2, 2);
    got = pressValve(got, 3, 3);
    const held = [...heldPistons(got)].sort((a, b) => a - b);
    const pass = got.size === 3 && arraysEqual(held, [1, 2, 3]);
    cases.push({
      name: 'press three distinct pointerIds -> heldPistons = {1,2,3}',
      pass,
      detail: pass
        ? 'press(1,1)+press(2,2)+press(3,3) -> map "1->1|2->2|3->3", held {1,2,3}'
        : `three presses -> map "${mapText(got)}" (expected 3 entries), held {${heldText(got)}} (expected {1,2,3})`,
    });
  }

  // 3. two pointers on the SAME piston — no dedup by piston in the map, so
  //    releasing one finger leaves the valve held by the other.
  {
    const oneFinger = pressValve(releaseAll(), 10, 2);
    const twoFingers = pressValve(oneFinger, 11, 2);
    const afterRelease = releaseValve(twoFingers, 10);
    const pass =
      twoFingers.size === 2 &&
      afterRelease.size === 1 &&
      afterRelease.get(11) === 2 &&
      heldPistons(afterRelease).has(2) &&
      !afterRelease.has(10);
    cases.push({
      name: 'two pointers on one piston — releasing one keeps it held by the other',
      pass,
      detail: pass
        ? 'press(10,2)+press(11,2) -> 2 entries; release(10) -> map "11->2", held {2}'
        : `two presses -> "${mapText(twoFingers)}" (expected 2 entries), after release(10) -> "${mapText(afterRelease)}" (expected "11->2"), held {${heldText(afterRelease)}} (expected {2})`,
    });
  }

  // 4. release one of three — only that pointer drops, the others remain
  {
    let got: ValvePressMap = releaseAll();
    got = pressValve(got, 1, 1);
    got = pressValve(got, 2, 2);
    got = pressValve(got, 3, 3);
    const after = releaseValve(got, 2);
    const pass =
      after.size === 2 &&
      after.get(1) === 1 &&
      after.get(3) === 3 &&
      !after.has(2) &&
      heldText(after) === '1,3';
    cases.push({
      name: 'release one of three drops only that pointer',
      pass,
      detail: pass
        ? 'release(2) -> map "1->1|3->3", held {1,3}'
        : `release(2) -> map "${mapText(after)}" (expected "1->1|3->3"), held {${heldText(after)}} (expected {1,3})`,
    });
  }

  // 5. release an unknown pointerId — no throw, no change (empty map too)
  {
    const got = pressValve(releaseAll(), 10, 1);
    const empty = releaseAll();
    let threw = false;
    let after: ValvePressMap = got;
    let afterEmpty: ValvePressMap = empty;
    try {
      after = releaseValve(got, 999);
      afterEmpty = releaseValve(empty, 7);
    } catch {
      threw = true;
    }
    const pass =
      !threw &&
      after.size === 1 &&
      after.get(10) === 1 &&
      afterEmpty.size === 0 &&
      heldText(after) === '1';
    cases.push({
      name: 'release unknown pointerId is a no-op (no throw, no change)',
      pass,
      detail: pass
        ? 'release(999) on "10->1" -> "10->1"; release(7) on empty -> empty'
        : `threw=${threw}, release(999) -> "${mapText(after)}" (expected "10->1"), release(7) on empty -> "${mapText(afterEmpty)}" (expected empty)`,
    });
  }

  // 6. releaseAll empties the map and pressing works again afterwards
  {
    const got = pressValve(pressValve(releaseAll(), 10, 1), 11, 3);
    const cleared = releaseAll();
    const again = pressValve(cleared, 12, 2);
    const pass =
      got.size === 2 &&
      cleared.size === 0 &&
      heldPistons(cleared).size === 0 &&
      again.size === 1 &&
      again.get(12) === 2 &&
      heldText(again) === '2';
    cases.push({
      name: 'releaseAll empties the map; a later press works again',
      pass,
      detail: pass
        ? '"10->1|11->3" -> releaseAll() -> empty; press(12,2) -> "12->2", held {2}'
        : `before="${mapText(got)}" (expected 2 entries), after releaseAll="${mapText(cleared)}" (expected empty), re-press="${mapText(again)}" (expected "12->2")`,
    });
  }

  // 7. immutability — pressValve/releaseValve never touch the input map
  {
    const base = pressValve(releaseAll(), 10, 1);
    const baseBefore = mapText(base);
    const pressed = pressValve(base, 11, 2);
    const pressedWhileBaseStillOne = mapText(base);
    const released = releaseValve(pressed, 10);
    const pass =
      baseBefore === '10->1' &&
      base.size === 1 &&
      baseBefore === pressedWhileBaseStillOne &&
      !base.has(11) &&
      heldText(base) === '1' &&
      pressed.size === 2 &&
      released.size === 1 &&
      !released.has(10) &&
      released.get(11) === 2;
    cases.push({
      name: 'pressValve/releaseValve do not mutate the input map',
      pass,
      detail: pass
        ? `base stays "${baseBefore}" through press+release; press -> "${mapText(pressed)}", release -> "${mapText(released)}"`
        : `base before="${baseBefore}", after press="${pressedWhileBaseStillOne}" (expected "10->1"), base.size=${base.size} (expected 1), press -> "${mapText(pressed)}" (expected 2 entries), release -> "${mapText(released)}" (expected "11->2")`,
    });
  }

  // 8. full press -> release -> releaseAll sequence stays clean
  {
    let got: ValvePressMap = releaseAll();
    got = pressValve(got, 1, 1);
    got = pressValve(got, 2, 2);
    got = releaseValve(got, 1);
    const afterOne = got;
    got = releaseValve(got, 2);
    const afterBoth = got;
    got = releaseAll();
    const pass =
      mapText(afterOne) === '2->2' &&
      heldText(afterOne) === '2' &&
      afterBoth.size === 0 &&
      got.size === 0 &&
      heldPistons(got).size === 0;
    cases.push({
      name: 'press -> release -> releaseAll sequence is clean',
      pass,
      detail: pass
        ? '"1->1|2->2" -> release(1) -> "2->2" -> release(2) -> empty -> releaseAll() -> empty'
        : `after release(1)="${mapText(afterOne)}" (expected "2->2"), after release(2)="${mapText(afterBoth)}" (expected empty), after releaseAll="${mapText(got)}" (expected empty)`,
    });
  }

  return cases;
}
