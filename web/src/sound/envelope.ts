/**
 * Pure amplitude-envelope math for the sound module.
 *
 * Framework-free: no Web Audio, no DOM, no React, no browser globals.
 * A note envelope is a piecewise-linear attack → hold → release shape applied
 * to a committed audio slice by the (future) SamplePlayer.
 */

export interface EnvelopeSpec {
  /** Seconds of linear fade-in (0 → 1). */
  attackSec: number;
  /** Seconds held at full gain (1). */
  holdSec: number;
  /** Seconds of linear fade-out (1 → 0). */
  releaseSec: number;
}

/** 5 ms attack, 445 ms hold, 250 ms release => 0.7 s total. */
export const DEFAULT_ENVELOPE: EnvelopeSpec = {
  attackSec: 0.005,
  holdSec: 0.445,
  releaseSec: 0.25,
};

/** Total duration of the envelope in seconds (attack + hold + release). */
export function envelopeDuration(spec: EnvelopeSpec): number {
  return spec.attackSec + spec.holdSec + spec.releaseSec;
}

/**
 * Piecewise-LINEAR gain at time `t` (seconds):
 *   0 for t <= 0
 *   0 → 1 across [0, attackSec]
 *   1 across [attackSec, attackSec + holdSec]
 *   1 → 0 across [attackSec + holdSec, total]
 *   0 for t >= total
 * Degenerate zero-length phases are handled without dividing by zero.
 */
export function envelopeGainAt(t: number, spec: EnvelopeSpec): number {
  const total = envelopeDuration(spec);
  if (t <= 0 || t >= total) return 0;

  if (t < spec.attackSec) {
    return spec.attackSec === 0 ? 1 : t / spec.attackSec;
  }

  const holdEnd = spec.attackSec + spec.holdSec;
  if (t < holdEnd) return 1;

  return spec.releaseSec === 0 ? 0 : (total - t) / spec.releaseSec;
}
