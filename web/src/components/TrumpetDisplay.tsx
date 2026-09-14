import type { PistonId } from '../trumpet/fingerings';

export interface TrumpetDisplayProps {
  /** Set of pistons currently held down. Use a Set of literal `1 | 2 | 3` values. */
  held: ReadonlySet<PistonId>;
  /** Max display height in CSS pixels. The component preserves aspect ratio (~2.77:1). */
  maxHeight?: number;
  /** Optional alt text override for the img. */
  alt?: string;
}

/**
 * Pick the full-trumpet PNG variant matching the held pistons.
 * All variants share an identical 1319×476 crop, so swapping src never shifts layout.
 */
function variantFilename(held: ReadonlySet<PistonId>): string {
  const ids = [1, 2, 3].filter((n) => held.has(n as PistonId));
  if (ids.length === 0) return 'trumpet-released.png';
  return `trumpet-press-${ids.join('-')}.png`;
}

/** Screen-reader description of the current valve state. */
function describe(held: ReadonlySet<PistonId>): string {
  const ids = [1, 2, 3].filter((n) => held.has(n as PistonId));
  if (ids.length === 0) return 'Trumpet diagram with all valves released.';
  if (ids.length === 3) return 'Trumpet diagram with valves 1, 2 and 3 pressed.';
  const list = ids.length === 2 ? `${ids[0]} and ${ids[1]}` : String(ids[0]);
  return `Trumpet diagram with valve${ids.length === 2 ? 's' : ''} ${list} pressed.`;
}

export function TrumpetDisplay({ held, maxHeight = 320, alt }: TrumpetDisplayProps) {
  // Vite serves /public/* at the base path. Since the app is hosted at /PitchQuest/,
  // use `import.meta.env.BASE_URL` ("/PitchQuest/" in production, "/" in dev) so the
  // path is correct in both.
  const src = `${import.meta.env.BASE_URL}trumpet/${variantFilename(held)}`;

  return (
    <img
      className="trumpet-display"
      src={src}
      alt={alt ?? describe(held)}
      style={{ maxHeight, maxWidth: '100%' }}
    />
  );
}