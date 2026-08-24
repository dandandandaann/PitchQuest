/**
 * useScoreSession — Stage 6 Task 4.
 *
 * Owns the per-session state machine for Guitar Hero mode:
 *   - the expected note list
 *   - an IncrementalMatcher cursor (held in a useRef, survives re-renders)
 *   - live scored notes (hit, forced-miss, or auto-miss)
 *   - the active tier (live, updates as the user plays)
 *   - a rAF ticker that auto-forces 'miss' after the grace period
 *
 * The rAF loop intentionally reads `performance.now() - audioStartPerfNow`
 * (not `audioContext.currentTime`) for the beat clock. `performance.now()`
 * is monotonic, already running, and avoids depending on the
 * `audioContextRef.current` quirk documented in useAudioContext.ts.
 * See plan §6.10.
 *
 * React StrictMode double-mount guard:
 *   StrictMode mounts → effect → cleanup → effect again in development.
 *   The `cancelled` flag captured in the cleanup closure prevents the
 *   first rAF from racing with the second. `cancelAnimationFrame` in the
 *   cleanup handles the synchronous case (cleanup runs before any rAF fires).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { IncrementalMatcher } from '../IncrementalMatcher';
import { scoreMatch, DEFAULT_SCORING_THRESHOLDS } from '../Scorer';
import type { ScoreTier, ScoredNote, ScoringThresholds } from '../Scorer';
import { msPerBeat } from '../TimingEngine';
import type { BeatNote } from '../TimingEngine';
import type { ExpectedNote } from '../../score/types';
import { LANE_CONFIG } from '../laneConfig';

// ---------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/**
 * Playback mode for the session:
 * - 'wait'        — cursor auto-advances after GRACE_BEATS of silence (default, existing behaviour).
 * - 'strict-wait' — cursor advances only on a successful consume() match; no auto-miss.
 */
export type PlayMode = 'wait' | 'strict-wait';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScoreSession {
    /** Ordered list of expected notes for the current session. */
    expected: ExpectedNote[];
    /**
     * Load (or reload) a score.
     *
     * Also resets the matcher — clears liveScored, resets currentIndex to 0,
     * and recreates the IncrementalMatcher instance. Safe to call with the
     * same notes again (resets the session).
     *
     * @param next  The new expected note list from MusicXML / ScorePicker.
     * @param bpm   Optional BPM override. Currently unused by the matcher
     *              itself (beat positions are already in beats), but kept in
     *              the signature so callers can sync UI state if needed.
     */
    setExpected: (next: ExpectedNote[], bpm?: number) => void;
    /**
     * Index of the currently-active expected note within `expected`.
     * Equals `expected.length` when all notes have been consumed (score done).
     */
    currentIndex: number;
    /**
     * The tier of the active (current) expected note.
     * `null` when no score is loaded, the session is fully consumed,
     * or `audioRunning` is false.
     */
    activeTier: ScoreTier | null;
    /** Already-completed notes (hit or forced-miss) with their final tier. */
    liveScored: ScoredNote[];
    /**
     * Submit one finalized detected note for matching.
     *
     * Returns the ScoredNote if it matched the active window (cursor advanced),
     * `null` otherwise (out of window or audio not running).
     *
     * The caller MUST pass a `BeatNote` (annotated with `startBeat`/`durationBeats`,
     * not a raw `DetectedNote`). PracticePage already computes `annotateNotes()`
     * for this purpose.
     *
     * @returns A `ScoredNote` if matched, `null` otherwise.
     */
    consume: (detected: BeatNote) => ScoredNote | null;
    /** Reset to a fresh session: clears expected, currentIndex, liveScored. */
    reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScoreSession(opts: {
    /** When false, the rAF ticker does nothing and consume() returns null. */
    audioRunning: boolean;
    /** The beat-zero anchor captured in useAudioContext on Start Mic. */
    audioStartPerfNow: number | null;
    /** Current BPM — used to convert performance.now() → beats in the rAF tick. */
    bpm: number;
    /**
     * 'wait'  (default)  — cursor advances on hit OR after grace-period auto-miss.
     * 'strict-wait'       — cursor advances ONLY on consume() with an in-window detection.
     *                       No auto-miss; song stalls if the user stays silent.
     */
    playMode?: PlayMode;
    /** Scoring thresholds for pitch/time tolerance. Defaults to DEFAULT_SCORING_THRESHOLDS. */
    scoringThresholds?: ScoringThresholds;
}): ScoreSession {
    const { audioRunning, bpm, playMode = 'wait', scoringThresholds } = opts;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    const [expected, setExpectedState] = useState<ExpectedNote[]>([]);
    const [liveScored, setLiveScored] = useState<ScoredNote[]>([]);
    const [activeTier, setActiveTier] = useState<ScoreTier | null>(null);
    const [currentIndex, setCurrentIndex] = useState<number>(0);

    // -------------------------------------------------------------------------
    // Matcher ref — lives across renders; recreated on setExpected
    // -------------------------------------------------------------------------

    /**
     * IncrementalMatcher instance.
     *
     * Held in a useRef (not useState) so the rAF tick callback and the
     * consume() callback always see the same instance without causing
     * stale-closure issues or extra re-renders.
     *
     * Initialised to `null`; created lazily on first `setExpected` call.
     * Recreated whenever `expected` changes (via setExpected -> createMatcher).
     */
    const matcherRef = useRef<IncrementalMatcher | null>(null);

    // -------------------------------------------------------------------------
    // rAF handle ref — needed for cancelAnimationFrame in cleanup
    // -------------------------------------------------------------------------

    const rafRef = useRef<number | null>(null);

    // Ref so the rAF tick (a closure created once in useEffect) always sees
    // the current playMode without needing to be recreated on every prop change.
    const playModeRef = useRef<PlayMode>(playMode);

    /**
     * Per-score beat-zero anchor.
     *
     * Captured fresh in `setExpected` so that switching scores mid-session
     * resets the beat clock to 0 for the new piece, instead of using the
     * audioContext-level `audioStartPerfNow` which would be deep into the
     * song timeline.
     *
     * Null when no score is loaded.
     */
    const scoreStartPerfNowRef = useRef<number | null>(null);
    // Ref so the rAF tick and consume() always read the current thresholds
    // without causing stale closures or restarting the rAF loop.
    const scoringThresholdsRef = useRef<ScoringThresholds>(
        scoringThresholds ?? DEFAULT_SCORING_THRESHOLDS,
    );
    useEffect(() => {
        scoringThresholdsRef.current = scoringThresholds ?? DEFAULT_SCORING_THRESHOLDS;
    }, [scoringThresholds]);

    useEffect(() => {
        playModeRef.current = playMode;
    }, [playMode]);

    // -------------------------------------------------------------------------
    // setExpected — loads a score and resets session state
    // -------------------------------------------------------------------------

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _bpm is part of the public API (callers pass it) but v1 matcher doesn't consume it yet
    const setExpected = useCallback((next: ExpectedNote[], _bpm?: number) => {
        setExpectedState(next);
        setLiveScored([]);
        setCurrentIndex(0);
        setActiveTier(next.length > 0 ? null : null);
        // Recreate the matcher with the new expected list.
        matcherRef.current = next.length > 0 ? new IncrementalMatcher(next) : null;
        // Capture a fresh beat-zero anchor so the new score starts at beat 0.
        scoreStartPerfNowRef.current = next.length > 0 ? performance.now() : null;
    }, []);

    // -------------------------------------------------------------------------
    // reset — clear everything (Clear button)
    // -------------------------------------------------------------------------

    const reset = useCallback(() => {
        setExpectedState([]);
        setLiveScored([]);
        setCurrentIndex(0);
        setActiveTier(null);
        matcherRef.current = null;
        scoreStartPerfNowRef.current = null;
    }, []);

    // -------------------------------------------------------------------------
    // consume — submit a BeatNote to the matcher
    // -------------------------------------------------------------------------

    /**
     * Submit one finalized detected note (already annotated to BeatNote) for
     * matching against the currently-active expected note.
     *
     * Guard: returns null immediately if audio is not running or the matcher
     * has not been initialized. The caller (PracticePage) is responsible for
     * passing annotated notes only when audio is active.
     *
     * The `audioRunning` dep on useCallback is intentional — consume must stop
     * accepting notes the moment the mic is stopped, even if the rAF loop
     * hasn't cleaned up yet. matcherRef.current is stable (the ref object
     * never changes) so we don't list it as a dep.
     */
    const consume = useCallback((detected: BeatNote): ScoredNote | null => {
        const matcher = matcherRef.current;
        if (!audioRunning || matcher === null) return null;

        const match = matcher.push(detected);
        if (match === null) return null; // out of window — user keeps trying

        // Score the single new match (scoreMatch is the per-note tier function).
        const tier = scoreMatch(match, scoringThresholdsRef.current);
        const scored: ScoredNote = { match, tier };

        // In strict-wait mode, a 'miss' (wrong pitch or off-time) means the user
        // attempted but failed. Don't advance the cursor — give them another try
        // on the same expected note. Still record the miss in liveScored so the
        // UI can show "you tried the wrong note" feedback if it wants to.
        if (tier === 'miss' && playModeRef.current === 'strict-wait') {
            matcher.rewind();
            // Don't bump currentIndex, don't change activeTier — the active note
            // is still whatever it was. Still append to liveScored for feedback.
            setLiveScored(prev => [...prev, scored]);
            return scored;
        }

        setLiveScored(prev => [...prev, scored]);
        setCurrentIndex(matcher.consumedCount);
        // If all notes consumed, clear activeTier; otherwise keep the tier.
        setActiveTier(matcher.active === null ? null : tier);

        return scored;
    }, [audioRunning]);

    // -------------------------------------------------------------------------
    // rAF ticker — auto-force miss after grace period
    // -------------------------------------------------------------------------

    /**
     * rAF loop that monitors currentBeat and auto-advances (forces 'miss')
     * the active note once currentBeat exceeds its end + GRACE_BEATS.
     *
     * Self-terminates when `matcher.active === null` (all notes consumed).
     *
     * StrictMode guard:
     *   React StrictMode runs: mount → cleanup → mount again.
     *   The `cancelled` boolean captured in the cleanup closure prevents the
     *   first tick from doing work after cleanup has fired. The cleanup also
     *   calls `cancelAnimationFrame` synchronously, so if the first tick's
     *   rAF fires before cleanup (edge case), the frame callback is cancelled.
     */
    useEffect(() => {
        if (!audioRunning) return;

        let cancelled = false;

        const tick = () => {
            // Self-terminate if the component unmounted or audio was stopped
            // between frames.
            if (cancelled) return;

            const matcher = matcherRef.current;
            if (matcher === null) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }

            // When consumedCount === expected.length the score is fully
            // consumed — rAF self-terminates. The check on matcher.active
            // (which is null when cursor === length) already covers this
            // naturally, but we return explicitly here so the loop stops
            // scheduling itself the moment the song ends.
            if (matcher.active === null) {
                return;
            }

            // Guard: no score loaded yet — keep the loop alive but bail.
            const scoreStart = scoreStartPerfNowRef.current;
            if (scoreStart === null) {
                rafRef.current = requestAnimationFrame(tick);
                return;
            }

            const currentBeat = (performance.now() - scoreStart) / msPerBeat(bpm);
            const active = matcher.active;
            const deadline = active.startBeat + active.durationBeats + LANE_CONFIG.GRACE_BEATS;

            if (currentBeat > deadline) {
                if (playModeRef.current === 'wait') {
                    const match = matcher.forceMissActive();
                    const tier = scoreMatch(match, scoringThresholdsRef.current); // 'miss'
                    const scored: ScoredNote = { match, tier };

                    setLiveScored(prev => [...prev, scored]);
                    setCurrentIndex(matcher.consumedCount);
                    // activeTier goes to null when the session is fully consumed,
                    // otherwise stays 'miss' for any remaining notes.
                    setActiveTier(matcher.active === null ? null : 'miss');
                }
                // 'strict-wait': do nothing — song waits for the user to hit the note.
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            cancelled = true;
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [audioRunning, bpm, playMode]);

    // -------------------------------------------------------------------------
    // Return public interface
    // -------------------------------------------------------------------------

    return {
        expected,
        setExpected,
        currentIndex,
        activeTier,
        liveScored,
        consume,
        reset,
    };
}
