/**
 * Pure slide-position helpers shared by <SlideControl>, its test harness,
 * and any other consumer that needs detent math. Kept out of the component
 * file so react-refresh sees only components there.
 */

import type { PositionId } from '../trombone/positions';

export const POSITION_COUNT = 7;

/** Percentage offset (0–100) of a position's detent along the travel band. */
export function detentPct(position: number): number {
  return ((position - 1) / (POSITION_COUNT - 1)) * 100;
}

/** Clamp a raw value into a valid PositionId (1–7). */
export function clampPosition(raw: number): PositionId {
  return Math.min(POSITION_COUNT, Math.max(1, Math.round(raw))) as PositionId;
}

/**
 * Map a travel-band ratio (0 = position 1, 1 = position 7) to a PositionId.
 * The ratio is clamped to [0, 1] before use.
 */
export function positionFromRatio(ratio: number): PositionId {
  const clamped = Math.min(1, Math.max(0, ratio));
  return clampPosition(clamped * (POSITION_COUNT - 1) + 1);
}
