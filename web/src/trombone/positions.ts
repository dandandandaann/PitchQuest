export type PositionId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SlidePosition {
  /** Concert/written pitch name in bass clef, e.g. "F#3" */
  note: string;
  /** Slide position (1 = shortest, 7 = longest) */
  position: PositionId;
}

/**
 * Standard tenor-trombone slide positions (first octave + partials), E2 → F4,
 * primary position only (no alternates). Conventional mixed spelling:
 * F#/C# sharp; Bb/Eb/Ab/Db flat.
 */
export const POSITIONS: readonly SlidePosition[] = [
  { note: 'E2',  position: 7 },
  { note: 'F2',  position: 6 },
  { note: 'F#2', position: 5 },
  { note: 'G2',  position: 4 },
  { note: 'Ab2', position: 3 },
  { note: 'A2',  position: 2 },
  { note: 'Bb2', position: 1 },
  { note: 'B2',  position: 7 },
  { note: 'C3',  position: 6 },
  { note: 'Db3', position: 5 },
  { note: 'D3',  position: 4 },
  { note: 'Eb3', position: 3 },
  { note: 'E3',  position: 2 },
  { note: 'F3',  position: 1 },
  { note: 'F#3', position: 5 },   // harmonic series — NOT position 1
  { note: 'G3',  position: 4 },
  { note: 'Ab3', position: 3 },
  { note: 'A3',  position: 2 },
  { note: 'Bb3', position: 1 },
  { note: 'B3',  position: 7 },
  { note: 'C4',  position: 6 },
  { note: 'Db4', position: 5 },
  { note: 'D4',  position: 4 },
  { note: 'Eb4', position: 3 },
  { note: 'E4',  position: 2 },
  { note: 'F4',  position: 1 },
];

export type NoteFilter = 'all' | 'sharps' | 'flats' | 'naturals';

/** Returns true iff the note name contains no sharp (#) and no flat (b). Safe because the letter is always A–G. */
export function isNatural(note: string): boolean {
  return !note.includes('#') && !note.includes('b');
}

/**
 * Returns the subset of POSITIONS matching the filter. Each branch
 * EXCLUDES the opposite accidental class rather than restricting to one
 * class, so the four filters overlap on natural notes by design:
 *   'all'      → full POSITIONS (same reference)
 *   'sharps'   → excludes flats   → {sharps, naturals}
 *   'flats'    → excludes sharps  → {flats,  naturals}
 *   'naturals' → excludes both    → {naturals only}   (see isNatural)
 *
 * Rationale: the drill UI presents these four filters as mutually exclusive
 * buttons (All / Sharps / Flats / Naturals), so each branch removes a single
 * accidental class instead of narrowing to one. This lets the user keep
 * natural notes visible while focusing on just one chromatic spelling.
 * (The trumpet module uses the same convention; its harness refers to this
 * as "trumpet semantics".)
 */
export function filterPositions(filter: NoteFilter): readonly SlidePosition[] {
  if (filter === 'sharps') return POSITIONS.filter(p => !p.note.includes('b'));
  if (filter === 'flats') return POSITIONS.filter(p => !p.note.includes('#'));
  if (filter === 'naturals') return POSITIONS.filter(p => !p.note.includes('#') && !p.note.includes('b'));

  return POSITIONS;
}

/** Returns the required slide position for a note, or null if not found. */
export function getRequiredPosition(note: string): PositionId | null {
  const p = POSITIONS.find(p => p.note === note);
  return p ? p.position : null;
}

/** Uniformly random entry from POSITIONS, optionally constrained by filter. Falls back to the full set if the filter matches zero notes (defensive — shouldn't happen with current data, but logs a warning). */
export function randomNote(filter: NoteFilter = 'all'): SlidePosition {
  const pool = filterPositions(filter);
  const source = pool.length > 0 ? pool : POSITIONS;
  if (pool.length === 0 && filter !== 'all') {
    console.warn(`randomNote: filter '${filter}' matched zero notes; falling back to full POSITIONS`);
  }
  return source[Math.floor(Math.random() * source.length)];
}

/**
 * Returns true iff the held slide position is exactly the required position.
 * Positions are mutually exclusive (unlike valve combinations), so this is a
 * strict equality check; a null held position never matches.
 */
export function positionMatches(held: PositionId | null, required: PositionId): boolean {
  return held === required;
}
