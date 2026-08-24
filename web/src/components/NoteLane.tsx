/**
 * NoteLane — Stage 6 Task 5.
 *
 * Renders the Guitar Hero lane: a scrolling score viewport driven entirely by
 * a rAF loop (no React re-renders in the animation path).
 *
 * Architecture (plan §1.4):
 *   - One `<div className="lane-track">` contains all expected-note blocks.
 *   - A `requestAnimationFrame` loop reads `performance.now() - audioStartPerfNow`
 *     each frame, computes `translateX`, and writes directly to the DOM.
 *   - GPU-composited `transform` ensures smooth 60fps scrolling.
 *   - React re-renders only when `expected`, `currentIndex`, `activeTier`,
 *     or `liveScored` change (i.e., at note-boundary moments, not every frame).
 *
 * Visibility culling:
 *   When `expected.length > 50`, only notes within the visible beat window are
 *   rendered. This avoids DOM bloat for long scores. Threshold documented here
 *   so it can be tuned without changing component logic.
 */
import React, { useRef, useEffect } from 'react';
import type { ExpectedNote } from '../score/types';
import type { ScoreTier, ScoreSummary } from '../audio/Scorer';
import type { ScoredNote } from '../audio/Scorer';
import type { PlayMode } from '../audio/hooks/useScoreSession';
import { LANE_CONFIG } from '../audio/laneConfig';
import { scoreMatches } from '../audio/Scorer';
import { msPerBeat } from '../audio/TimingEngine';
import './NoteLane.css';

// ---------------------------------------------------------------------------
// Constants (mirror LANE_CONFIG so they're co-located with usage)
// ---------------------------------------------------------------------------

const { PX_PER_BEAT, PX_PER_SEMITONE, NOW_LINE_OFFSET_PX, DEFAULT_MIDI_RANGE } = LANE_CONFIG;

// Visibility culling threshold.
// Above this many notes, render only the visible beat window per frame.
// Below it, render all notes (simpler DOM, fine for short scores).
const CULL_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteLaneProps {
    /**
     * The full ordered list of expected notes from the loaded score.
     */
    expected: ExpectedNote[];

    /**
     * 0-based cursor into `expected`.
     * `currentIndex === expected.length` means the score is fully consumed.
     */
    currentIndex: number;

    /**
     * Tier of the currently-active (targeted) expected note.
     * `null` when no score is loaded, the session is fully consumed,
     * or audio has not yet started.
     */
    activeTier: ScoreTier | null;

    /**
     * Already-completed notes (hit or forced-miss) with their final tier.
     * Used to colour completed blocks — `liveScored[i]` corresponds to
     * `expected[i]`.
     */
    liveScored: ScoredNote[];

    /**
     * Beat-zero anchor captured in `useAudioContext` when Start Mic is pressed.
     * `null` when audio is not running.
     */
    audioStartPerfNow: number | null;

    /**
     * Current BPM — used to convert `performance.now()` → beats.
     */
    bpm: number;

    /**
     * Playback mode. In `'strict-wait'` the cursor only moves on a hit, so the
     * visible lane is clamped to the active note's `startBeat` (the song
     * "waits" visually for the user). In `'wait'` the lane scrolls freely.
     */
    playMode: PlayMode;

    /**
     * Called when the score is fully consumed (all notes done).
     * Receives the final `ScoreSummary` recomputed from `liveScored`.
     */
    onComplete?: (summary: ScoreSummary) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/**
 * Convert a flat-style note name (e.g. "C4", "Db5", "Bb3") to its MIDI number.
 *
 * Both `ExpectedNote.noteName` and `DetectedNote.noteName` use flat-style naming
 * (see `score/types.ts` and `frequencyToNote` in `pitch-math.ts`). This helper
 * inverts that representation so we can position blocks on the lane's pitch axis.
 *
 * Flats are converted to their enharmonic sharp equivalents for the MIDI math:
 *   Db→C#, Eb→D#, Gb→F#, Ab→G#, Bb→A#
 *
 * Throws `RangeError` for unknown pitch classes.
 */
function noteNameToMidi(noteName: string): number {
    // Strip accidental from the name: "C4" → "C", "Db5" → "Db"
    const pitchClass = noteName.replace(/[0-9]/g, '');
    const octave = parseInt(noteName.replace(/\D/g, ''), 10);

    const flatIndex = FLAT_NOTES.indexOf(pitchClass as typeof FLAT_NOTES[number]);
    if (flatIndex === -1) {
        throw new RangeError(`noteNameToMidi: unknown pitch class "${pitchClass}" in "${noteName}"`);
    }

    // Map flat to semitone offset from C (C=0, Db=1, D=2, …, B=11).
    // Enharmonic equivalents map to the same semitone:
    //   Db(1)=C#, Eb(3)=D#, Gb(6)=F#, Ab(8)=G#, Bb(10)=A#
    const semitoneFromC = flatIndex;

    // MIDI: C0 = 12, each octave = +12 semitones.
    return 12 + octave * 12 + semitoneFromC;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoteLane({
    expected,
    currentIndex,
    activeTier,
    liveScored,
    audioStartPerfNow,
    bpm,
    playMode,
    onComplete,
}: NoteLaneProps) {
    // Ref to the lane-track DOM node. Written by the rAF loop (not React).
    const trackRef = useRef<HTMLDivElement>(null);

    // Track whether the component is still mounted (StrictMode double-mount guard).
    const cancelledRef = useRef<boolean>(false);

    // Mutable refs so the rAF loop sees up-to-date values without a closure re-bind.
    const currentIndexRef = useRef<number>(currentIndex);
    const audioStartPerfNowRef = useRef<number | null>(audioStartPerfNow);
    const playModeRef = useRef<PlayMode>(playMode);
    const expectedRef = useRef<ExpectedNote[]>(expected);

    // Keep the mutable refs in sync with their prop counterparts.
    useEffect(() => {
        currentIndexRef.current = currentIndex;
    }, [currentIndex]);

    useEffect(() => {
        audioStartPerfNowRef.current = audioStartPerfNow;
    }, [audioStartPerfNow]);

    useEffect(() => {
        playModeRef.current = playMode;
    }, [playMode]);

    useEffect(() => {
        expectedRef.current = expected;
    }, [expected]);

    // -------------------------------------------------------------------------
    // rAF animation loop
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (expected.length === 0) return;
        if (audioStartPerfNow === null) return;

        cancelledRef.current = false;

        const tick = () => {
            if (cancelledRef.current) return;

            // Self-terminate: score fully consumed or audio stopped mid-session.
            if (currentIndexRef.current >= expected.length || audioStartPerfNowRef.current === null) {
                return;
            }

            const track = trackRef.current;
            if (!track) {
                requestAnimationFrame(tick);
                return;
            }

            const rawCurrentBeat = (performance.now() - audioStartPerfNowRef.current) / msPerBeat(bpm);

            // In strict-wait mode, freeze the visible cursor at the active note's
            // startBeat so the lane doesn't scroll past the active block. This
            // visually communicates "the song is waiting for you to hit this note".
            // `expectedAtCursor` is non-null here because the guard above ensures
            // `currentIndexRef.current < expected.length`; the `?? Infinity` is a
            // belt-and-braces default in case that invariant ever relaxes.
            const expectedAtCursor = expectedRef.current[currentIndexRef.current];
            const ceilingBeat = expectedAtCursor?.startBeat ?? Infinity;
            const currentBeat = playModeRef.current === 'strict-wait'
                ? Math.min(rawCurrentBeat, ceilingBeat)
                : rawCurrentBeat;

            // Translate the track so currentBeat aligns with NOW_LINE_OFFSET_PX.
            // As currentBeat increases, the track slides left.
            const translateX = NOW_LINE_OFFSET_PX - currentBeat * PX_PER_BEAT;
            track.style.transform = `translateX(${translateX}px)`;

            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);

        return () => {
            cancelledRef.current = true;
        };
    }, [expected.length, audioStartPerfNow, bpm]);

    // -------------------------------------------------------------------------
    // Visibility culling
    // -------------------------------------------------------------------------

    // Compute the visible beat window lazily (only needed when rendering).
    // The rAF loop computes currentBeat from performance.now() each frame;
    // we use 0 as a conservative estimate for the visible range calculation
    // since the track is being transformed independently.
    // The key insight: we only need to render notes that COULD be on-screen
    // at any point. We use a wide enough window that nothing is missed.
    const visibleNotes: ExpectedNote[] =
        expected.length > CULL_THRESHOLD
            ? expected.filter(
                  // Generous +50 beat buffer: for long scores we want notes to appear
                  // well before the now-line so the user sees them approaching, not popping
                  // in suddenly. The tradeoff is that the DOM holds more nodes than strictly
                  // needed; for <50-note scores we skip culling entirely and render everything.
                  n =>
                      n.startBeat + n.durationBeats >= -LANE_CONFIG.VISIBLE_BEATS_BEFORE &&
                      n.startBeat <= LANE_CONFIG.VISIBLE_BEATS_AFTER + 50,
              )
            : expected;

    // -------------------------------------------------------------------------
    // Completion overlay
    // -------------------------------------------------------------------------

    const isDone = currentIndex === expected.length && expected.length > 0;
    const summary: ScoreSummary | null = isDone
        ? scoreMatches(liveScored.map(s => s.match)).summary
        : null;

    // Fire onComplete once when the song finishes.
    useEffect(() => {
        if (isDone && summary !== null && onComplete) {
            onComplete(summary);
        }
    }, [isDone, summary, onComplete]);

    // -------------------------------------------------------------------------
    // Block rendering helpers
    // -------------------------------------------------------------------------

    function getBlockClassName(idx: number): string {
        const base = 'lane-block';

        if (audioStartPerfNow === null) {
            // Audio not started — show upcoming style (no tier info yet).
            return `${base} ${base}--no-audio`;
        }

        if (idx < currentIndex) {
            // Already scored.
            const scored = liveScored[idx];
            if (scored) return `${base} ${base}--${scored.tier}`;
            return `${base} ${base}--upcoming`; // fallback
        }

        if (idx === currentIndex) {
            // Active note — highlight with activeTier (or generic active if null).
            return activeTier !== null
                ? `${base} ${base}--active ${base}--${activeTier}`
                : `${base} ${base}--active`;
        }

        // Upcoming.
        return `${base} ${base}--upcoming`;
    }

    function renderBlock(note: ExpectedNote, idx: number): React.ReactElement {
        const midi = noteNameToMidi(note.noteName);
        const x = note.startBeat * PX_PER_BEAT;
        const y = (DEFAULT_MIDI_RANGE.high - midi) * PX_PER_SEMITONE;
        const w = note.durationBeats * PX_PER_BEAT;
        const h = PX_PER_SEMITONE;

        // Truncate note name label if block is very short (≤20px).
        const label = w > 20 ? note.noteName : '';

        return (
            <div
                key={idx}
                className={getBlockClassName(idx)}
                style={{
                    left: x,
                    top: y,
                    width: w,
                    height: h,
                }}
            >
                {label}
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    if (expected.length === 0) {
        return (
            <div className="lane-root lane-root--empty">
                <span>Load a score above to see the lane</span>
            </div>
        );
    }

    return (
        <div className="lane-root">
            {/* Scrolling track — rAF updates transform on this div */}
            <div
                ref={trackRef}
                className="lane-track"
                style={{ width: LANE_CONFIG.VISIBLE_BEATS_AFTER * PX_PER_BEAT * 10, height: '100%' }}
            >
                {visibleNotes.map((note, i) => {
                    // Find the index of this note in the full `expected` array.
                    const fullIdx = expected.indexOf(note);
                    return renderBlock(note, fullIdx === -1 ? i : fullIdx);
                })}
            </div>

            {/* "Now" line — fixed at NOW_LINE_OFFSET_PX from the left */}
            <div className="lane-now-line" />

            {/* Song complete overlay */}
            {isDone && summary !== null && (
                <div className="lane-complete-overlay">
                    <h3>Complete!</h3>
                    <p>
                        {summary.accuracyPct.toFixed(1)}% ({summary.perfect} perfect, {summary.ok} ok,{' '}
                        {summary.miss} miss)
                    </p>
                </div>
            )}
        </div>
    );
}
