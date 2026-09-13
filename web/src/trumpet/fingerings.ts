export type PistonId = 1 | 2 | 3;
export type PistonKey = 'J' | 'K' | 'L';

export interface Fingering {
  /** Written (transposed to Bb trumpet) note name, e.g. "F#3", "C5" */
  note: string;
  /** Primary fingering; empty array = open (no pistons) */
  pistons: readonly PistonId[];
}

export const KEY_TO_PISTON: Readonly<Record<PistonKey, PistonId>> = {
  J: 1, K: 2, L: 3,
};

/** Standard Bb-trumpet written-pitch fingerings, F#3 → D6, primary only (no alternates). */
export const FINGERINGS: readonly Fingering[] = [
  { note: 'F#3', pistons: [1, 2, 3] },
  { note: 'G3',  pistons: [1, 3] },
  { note: 'Ab3', pistons: [2, 3] },
  { note: 'A3',  pistons: [1, 2] },
  { note: 'Bb3', pistons: [1] },
  { note: 'B3',  pistons: [2] },
  { note: 'C4',  pistons: [] },        // open
  { note: 'C#4', pistons: [1, 2, 3] },
  { note: 'D4',  pistons: [1, 3] },    // "low D"
  { note: 'Eb4', pistons: [2, 3] },
  { note: 'E4',  pistons: [1, 2] },
  { note: 'F4',  pistons: [1] },
  { note: 'F#4', pistons: [2] },
  { note: 'G4',  pistons: [] },        // open
  { note: 'Ab4', pistons: [2, 3] },
  { note: 'A4',  pistons: [1, 2] },
  { note: 'Bb4', pistons: [1] },
  { note: 'B4',  pistons: [2] },
  { note: 'C5',  pistons: [] },        // open — harmonic series, NOT piston 1
  { note: 'C#5', pistons: [1, 2] },
  { note: 'D5',  pistons: [1] },       // NOT 1+3 — second harmonic
  { note: 'Eb5', pistons: [2] },
  { note: 'E5',  pistons: [] },        // open
  { note: 'F5',  pistons: [1] },
  { note: 'F#5', pistons: [2] },
  { note: 'G5',  pistons: [] },        // open
  { note: 'Ab5', pistons: [2, 3] },
  { note: 'A5',  pistons: [1, 2] },
  { note: 'Bb5', pistons: [1] },
  { note: 'B5',  pistons: [2] },
  { note: 'C6',  pistons: [] },        // open
  { note: 'C#6', pistons: [1, 2] },
  { note: 'D6',  pistons: [1] },
];

export type NoteFilter = 'all' | 'sharps' | 'flats' | 'naturals';

/** Returns true iff the note name contains no sharp (#) and no flat (b). Safe because the letter is always A–G. */
export function isNatural(note: string): boolean {
  return !note.includes('#') && !note.includes('b');
}

/**
 * Returns the subset of FINGERINGS matching the filter:
 *   'all'      → full FINGERINGS (same reference)
 *   'sharps'   → notes containing '#'
 *   'flats'    → notes containing 'b'
 *   'naturals' → notes containing neither (see isNatural)
 */
export function filterFingerings(filter: NoteFilter): readonly Fingering[] {
  if (filter === 'all') return FINGERINGS;
  if (filter === 'sharps') return FINGERINGS.filter(f => f.note.includes('#'));
  if (filter === 'flats') return FINGERINGS.filter(f => f.note.includes('b'));
  // 'naturals'
  return FINGERINGS.filter(f => isNatural(f.note));
}

/** Returns the required pistons for a written note, or null if not found. */
export function getRequiredPistons(note: string): readonly PistonId[] | null {
  const f = FINGERINGS.find(f => f.note === note);
  return f ? f.pistons : null;
}

/** Uniformly random entry from FINGERINGS, optionally constrained by filter. Falls back to the full set if the filter matches zero notes (defensive — shouldn't happen with current data, but logs a warning). */
export function randomNote(filter: NoteFilter = 'all'): Fingering {
  const pool = filterFingerings(filter);
  const source = pool.length > 0 ? pool : FINGERINGS;
  if (pool.length === 0 && filter !== 'all') {
    console.warn(`randomNote: filter '${filter}' matched zero notes; falling back to full FINGERINGS`);
  }
  return source[Math.floor(Math.random() * source.length)];
}

/**
 * Returns true iff the held keyboard keys correspond exactly to the required pistons.
 * Order-independent (set comparison). Empty required matches empty held; non-empty
 * required does NOT match empty held.
 */
export function pistonsMatch(
  held: ReadonlySet<PistonKey>,
  required: readonly PistonId[],
): boolean {
  const heldPistons = new Set<PistonId>();
  for (const k of held) heldPistons.add(KEY_TO_PISTON[k]);
  if (heldPistons.size !== required.length) return false;
  for (const p of required) {
    if (!heldPistons.has(p)) return false;
  }
  return true;
}
