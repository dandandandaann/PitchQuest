import type { ComponentProps } from 'react';
import type { PositionId } from '../trombone/positions';
import { useT } from '../i18n/I18nContext';

export interface TromboneDisplayProps extends ComponentProps<'img'> {
  /** Current slide position (1 = shortest, 7 = longest). Falls back to 1 when null. */
  position: PositionId | null;
  /** Max display height in CSS pixels. The component preserves aspect ratio (~2.02:1). */
  maxHeight?: number;
  /** Optional alt text override for the img. */
  alt?: string;
}

/**
 * Show the trombone diagram matching the current slide position.
 * All seven variants share an identical 2742×1356 crop, so swapping src never
 * shifts layout. The images are wider than the trumpet's, so callers should
 * pass a smaller `maxHeight` to keep the stage column balanced.
 *
 * A passthrough: `position`, `maxHeight`, and `alt` are the explicit props;
 * every other prop (e.g. `ref`, slider ARIA attributes, pointer handlers,
 * `draggable`) is spread onto the `<img>`.
 */
export function TromboneDisplay({ position, maxHeight = 320, alt, ...imgProps }: TromboneDisplayProps) {
  const t = useT();
  // Vite serves /public/* at the base path. Since the app is hosted at /PitchQuest/,
  // use `import.meta.env.BASE_URL` ("/PitchQuest/" in production, "/" in dev) so the
  // path is correct in both.
  const n = position ?? 1;
  const src = `${import.meta.env.BASE_URL}trombone/trombone-pos-${n}.webp`;

  return (
    <img
      className="trombone-display"
      src={src}
      alt={alt ?? t('components.trombone_display.alt').replace('{position}', String(n))}
      style={{ maxHeight, maxWidth: '100%' }}
      // Native HTML5 image drag hijacks pointer events — never let the img drag.
      draggable={false}
      {...imgProps}
    />
  );
}
