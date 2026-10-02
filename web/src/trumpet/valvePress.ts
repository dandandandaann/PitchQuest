/**
 * valvePress.ts — pure bookkeeping for multi-pointer valve presses.
 *
 * A touchscreen can hold several valves at once, so the drill cannot model a
 * press as a single "currently down" id. Instead every active pointer is stored
 * under its own `pointerId` key, and the set of held pistons is *derived* from
 * the map. That keeps release exact: lifting one finger only ever releases the
 * valve that finger was holding.
 *
 * No DOM, no React, no globals — this module is importable from a test harness.
 */

import type { PistonId } from './fingerings';

/** Active pointer presses: `pointerId` → the piston that finger is holding. */
export type ValvePressMap = ReadonlyMap<number, PistonId>;

/**
 * Record a press. Returns a NEW map with `pointerId` bound to `pistonId`; the
 * input map is never mutated.
 *
 * The map is keyed by pointer id and deliberately NOT deduplicated by piston:
 * two fingers on the same valve are two entries, so each lifts independently.
 * The piston *set* collapses them (see {@link heldPistons}), which is what the
 * matcher and the trumpet graphic care about.
 */
export function pressValve(
  map: ValvePressMap,
  pointerId: number,
  pistonId: PistonId,
): ValvePressMap {
  const next = new Map(map);
  next.set(pointerId, pistonId);
  return next;
}

/**
 * Release one pointer. Returns a NEW map without `pointerId`; a no-op (still a
 * new map) when the pointer is not in the map.
 */
export function releaseValve(map: ValvePressMap, pointerId: number): ValvePressMap {
  const next = new Map(map);
  next.delete(pointerId);
  return next;
}

/** Union of the pistons currently held by at least one pointer. */
export function heldPistons(map: ValvePressMap): ReadonlySet<PistonId> {
  const held = new Set<PistonId>();
  for (const pistonId of map.values()) held.add(pistonId);
  return held;
}

/** A fresh, empty press map. Used for the "release everything" safety paths. */
export function releaseAll(): ValvePressMap {
  return new Map();
}
