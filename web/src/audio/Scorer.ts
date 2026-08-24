import type { MatchedNote } from './Matcher';

/** Scoring tier for a single matched note. */
export type ScoreTier = 'perfect' | 'ok' | 'miss';

/** Configurable thresholds for the v1 scoring rubric. */
export interface ScoringThresholds {
  /** Maximum |pitchErrorCents| for a "perfect" pitch. Default 25. */
  pitchCentsPerfect: number;
  /** Maximum |pitchErrorCents| for an "ok" pitch. Must be >= pitchCentsPerfect. Default 60. */
  pitchCentsOk: number;
  /** Maximum |timeErrorBeats| for a "perfect" time. Default 0.15. */
  timeBeatsPerfect: number;
  /** Maximum |timeErrorBeats| for an "ok" time. Must be >= timeBeatsPerfect. Default 0.4. */
  timeBeatsOk: number;
}

/**
 * v1 starting-point thresholds. Tuned for casual singers/instrumentalists.
 *
 *  - ±25 cents perfect: roughly the limit of human pitch perception
 *    ("just noticeably out of tune").
 *  - ±60 cents ok: a full semitone — well beyond that perceptual limit
 *    but still distinguishable from a wrong note.
 *  - 0.15 beats perfect: about the smallest gap a person can reliably
 *    hit when starting a note from silence (~36ms at 120bpm).
 *  - 0.4 beats ok: ~96ms at 120bpm — the threshold where it starts to
 *    feel "off-time" rather than "in time".
 *
 * These are user-configurable in a follow-up (Bug 4); for now the
 * defaults are tuned to be playable by a non-professional.
 */
export const DEFAULT_SCORING_THRESHOLDS: ScoringThresholds = {
  pitchCentsPerfect: 25,
  pitchCentsOk: 60,
  timeBeatsPerfect: 0.15,
  timeBeatsOk: 0.4,
};

/** Per-note scoring result. */
export interface ScoredNote {
  match: MatchedNote;
  tier: ScoreTier;
}

/** Aggregate score across all matched notes. */
export interface ScoreSummary {
  total: number;
  perfect: number;
  ok: number;
  miss: number;
  /**
   * Weighted accuracy percentage: perfect = 1.0, ok = 0.5, miss = 0.0.
   * Vacuously perfect (100) when total === 0.
   */
  accuracyPct: number;
}

/** Full scoring result: per-note tiers + aggregate summary. */
export interface ScoreResult {
  perNote: ScoredNote[];
  summary: ScoreSummary;
}

/**
 * Scoring system (Roadmap Stage 5).
 *
 * v1 limitations:
 *  - Pitch class match is the gate. If the user plays the WRONG note at the
 *    right time, the result is automatically "miss" regardless of cents error.
 *    (This is the gap the Matcher's pitchErrorCents can't detect.)
 *  - Octave equivalence is intentionally NOT supported. C4 vs C5 scores as
 *    "miss" even though they're the same pitch class. v2 candidate.
 *  - Real-world tuning notes:
 *    - These are starting points based on casual-singer tolerance. Users
 *      who want tighter thresholds (e.g. for sight-reading practice) can
 *      pass a custom ScoringThresholds to scoreMatch/scoreMatches.
 *    - The octave-equivalence question (C4 vs C5) is a separate axis; see
 *      the "Octave equivalence" limitation above.
 *  - Extras (detected notes that didn't match any expected) are inherited
 *    from matcher's "silently ignored" policy and don't affect scoring. Add
 *    an extrasPenalty field in v2 if user data shows extras matter.
 *  - Empty matches (no expected notes) → accuracyPct = 100 (vacuously perfect).
 *  - Tiering is two-step (perfect/ok/miss) — no partial credit beyond the
 *    two-tier model. v2: continuous per-dimension scoring.
 */
export function scoreMatch(
  match: MatchedNote,
  thresholds: ScoringThresholds = DEFAULT_SCORING_THRESHOLDS,
): ScoreTier {
  validateThresholds(thresholds);

  // Miss: no detected note.
  if (match.detected === null) return 'miss';

  // Miss: wrong note played (pitch class mismatch).
  if (match.detected.midi !== match.expected.midi) return 'miss';

  // After the null + class-match guards, pitchErrorCents and timeErrorBeats
  // are guaranteed non-null (Matcher always populates them when detected is set).
  const absPitch = Math.abs(match.pitchErrorCents!);
  const absTime = Math.abs(match.timeErrorBeats!);

  const pitchPerfect = absPitch < thresholds.pitchCentsPerfect;
  const pitchOk = absPitch < thresholds.pitchCentsOk;
  const timePerfect = absTime < thresholds.timeBeatsPerfect;
  const timeOk = absTime < thresholds.timeBeatsOk;

  if (pitchPerfect && timePerfect) return 'perfect';
  if (pitchOk && timeOk) return 'ok';
  return 'miss';
}

/**
 * Score an array of MatchedNote[] and return per-note tiers + aggregate summary.
 */
export function scoreMatches(
  matches: MatchedNote[],
  thresholds: ScoringThresholds = DEFAULT_SCORING_THRESHOLDS,
): ScoreResult {
  validateThresholds(thresholds);

  const perNote: ScoredNote[] = matches.map(match => ({
    match,
    tier: scoreMatch(match, thresholds),
  }));

  let perfect = 0;
  let ok = 0;
  let miss = 0;
  for (const note of perNote) {
    if (note.tier === 'perfect') perfect++;
    else if (note.tier === 'ok') ok++;
    else miss++;
  }

  const total = perNote.length;
  const accuracyPct = total === 0
    ? 100
    : ((perfect * 1.0 + ok * 0.5 + miss * 0.0) / total) * 100;

  return {
    perNote,
    summary: { total, perfect, ok, miss, accuracyPct },
  };
}

function validateThresholds(thresholds: ScoringThresholds): void {
  const { pitchCentsPerfect, pitchCentsOk, timeBeatsPerfect, timeBeatsOk } = thresholds;
  if (!(pitchCentsPerfect >= 0) || Number.isNaN(pitchCentsPerfect)) {
    throw new RangeError(`Scorer: pitchCentsPerfect must be >= 0 and finite, got ${pitchCentsPerfect}`);
  }
  if (!(pitchCentsOk >= 0) || Number.isNaN(pitchCentsOk)) {
    throw new RangeError(`Scorer: pitchCentsOk must be >= 0 and finite, got ${pitchCentsOk}`);
  }
  if (!(timeBeatsPerfect >= 0) || Number.isNaN(timeBeatsPerfect)) {
    throw new RangeError(`Scorer: timeBeatsPerfect must be >= 0 and finite, got ${timeBeatsPerfect}`);
  }
  if (!(timeBeatsOk >= 0) || Number.isNaN(timeBeatsOk)) {
    throw new RangeError(`Scorer: timeBeatsOk must be >= 0 and finite, got ${timeBeatsOk}`);
  }
  if (pitchCentsOk < pitchCentsPerfect) {
    throw new RangeError(`Scorer: pitchCentsOk (${pitchCentsOk}) must be >= pitchCentsPerfect (${pitchCentsPerfect})`);
  }
  if (timeBeatsOk < timeBeatsPerfect) {
    throw new RangeError(`Scorer: timeBeatsOk (${timeBeatsOk}) must be >= timeBeatsPerfect (${timeBeatsPerfect})`);
  }
}