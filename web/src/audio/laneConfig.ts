/**
 * Lane rendering constants for PitchQuest Stage 6 ("Guitar Hero" mode).
 *
 * These are pure numbers with no dependencies — easy to tune during playtest
 * without touching component logic. Tune here first; extract to URL params or
 * a settings panel in a later stage if needed.
 */

/**
 * Horizontal pixels per beat of music.
 *
 * Controls how fast the score scrolls leftward toward the "now" line.
 * Higher = faster scroll = more space between notes (good for slow pieces).
 * Lower = slower scroll = notes appear closer together.
 *
 * UX tip: at 120 px/beat + 80 BPM, 1 beat ≈ 500 ms. The user sees ~1 beat of
 * "lead time" before a note arrives at the now-line. Tune up for slow pieces
 * (30 BPM = 2 s/beat) or down for fast ones (180 BPM = 333 ms/beat).
 */
export const LANE_CONFIG = {
    /**
     * Horizontal pixels per beat (lane scroll speed).
     *
     * Higher = faster scroll = more space between notes.
     * Default 120 gives ~1 beat of lead time at 80 BPM.
     */
    PX_PER_BEAT: 120,

    /**
     * Vertical pixels per semitone on the lane's pitch axis.
     *
     * Higher = taller lane for the same pitch range (easier to see pitch).
     * Lower = more compact.
     * Default 8 is compact enough for a 29-semitone range (G3–C6 = 348px tall).
     */
    PX_PER_SEMITONE: 8,

    /**
     * Distance in pixels from the left edge of the lane viewport to the
     * "now" line (the vertical marker at which the user should be playing).
     *
     * Default 80 gives a visible lead-in zone so upcoming notes appear
     * ~2/3 of a beat before they need to be hit at 80 BPM.
     */
    NOW_LINE_OFFSET_PX: 80,

    /**
     * How many beats of already-played music to keep visible to the left
     * of the now line.
     *
     * Default 2 beats — gives the user a moment to see what they just played
     * before it scrolls off-screen.
     */
    VISIBLE_BEATS_BEFORE: 2,

    /**
     * How many beats of upcoming music to render to the right of the now line.
     *
     * Default 8 beats — enough lookahead to let the user anticipate the next
     * phrase without showing so much that the screen feels empty.
     */
    VISIBLE_BEATS_AFTER: 8,

    /**
     * Default MIDI range when no loaded score constrains the visible pitch span.
     *
     * G3 (MIDI 55) to C6 (MIDI 84) = 29 semitones.
     * Covers most popular melodies (piano vocal range) in a compact 232px lane.
     * The lane expands automatically if a loaded score extends beyond these
     * bounds (handled in NoteLane, not here).
     */
    DEFAULT_MIDI_RANGE: { low: 55, high: 84 },

    /**
     * After a note's expected end, how many more beats to wait before
     * auto-advancing (forcing a 'miss') for the active expected note.
     *
     * At 0 beats, the user is rushed immediately after a note ends.
     * At 2 beats (default), the user has roughly a half-bar at 80 BPM to
     * respond before the cursor moves on. Tunable in `laneConfig.ts` without
     * code changes elsewhere.
     */
    GRACE_BEATS: 2,
} as const;
