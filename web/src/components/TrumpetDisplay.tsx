import type { PistonId } from '../trumpet/fingerings';
import type { TranslationKey } from '../i18n/keys';
import { useT } from '../i18n/I18nContext';

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
function describe(held: ReadonlySet<PistonId>, t: (key: TranslationKey) => string): string {
  const ids = [1, 2, 3].filter((n) => held.has(n as PistonId));
  if (ids.length === 0) return t('components.trumpet_display.alt_released');
  if (ids.length === 3) return t('components.trumpet_display.alt_all_pressed');
  const list = ids.length === 2 ? `${ids[0]} ${t('common.and')} ${ids[1]}` : String(ids[0]);
  const key: TranslationKey =
    ids.length === 2
      ? 'components.trumpet_display.alt_valves_pressed'
      : 'components.trumpet_display.alt_valve_pressed';
  return t(key).replace('{list}', list);
}

export function TrumpetDisplay({ held, maxHeight = 320, alt }: TrumpetDisplayProps) {
  const t = useT();
  // Vite serves /public/* at the base path. Since the app is hosted at /PitchQuest/,
  // use `import.meta.env.BASE_URL` ("/PitchQuest/" in production, "/" in dev) so the
  // path is correct in both.
  const src = `${import.meta.env.BASE_URL}trumpet/${variantFilename(held)}`;

  return (
    <img
      className="trumpet-display"
      src={src}
      alt={alt ?? describe(held, t)}
      style={{ maxHeight, maxWidth: '100%' }}
    />
  );
}