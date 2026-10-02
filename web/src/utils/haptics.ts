/**
 * haptics.ts — tiny wrapper around the Vibration API for the drill controls.
 *
 * The Vibration API is Android-only (iOS Safari does not expose it), so every
 * call must be a silent no-op when `navigator.vibrate` is missing. It must also
 * never throw: a missing or blocked vibration must never interrupt a drill
 * interaction.
 */

/** Short tick — a valve was pressed. */
export const HAPTIC_VALVE_DOWN = 8;

/** Single confirmation tick — the submitted fingering was correct. */
export const HAPTIC_CORRECT = 12;

/** Double buzz — the submitted fingering was wrong. */
export const HAPTIC_WRONG: number[] = [20, 40, 20];

/**
 * Fire a vibration pattern if the device supports it. Silent no-op on iOS
 * Safari (no Vibration API) and if the call throws at runtime.
 */
export function haptic(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration blocked or unsupported at runtime — ignore.
  }
}
