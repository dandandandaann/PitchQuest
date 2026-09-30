import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Box, Stack } from '@mui/material';
import type { PositionId } from '../trombone/positions';
import { POSITION_COUNT, clampPosition, detentPct, positionFromRatio } from './slidePositions';
import { useT } from '../i18n/I18nContext';
import { TromboneDisplay } from './TromboneDisplay';

export interface SlideControlProps {
  /** Current slide position (1–7). */
  value: PositionId;
  /** Called with the nearest detent whenever the drag crosses one, or on arrow keys. */
  onChange: (position: PositionId) => void;
  /** Max display height of the trombone image, in CSS pixels. */
  maxHeight?: number;
}

/**
 * Drag-on-image slide-position control: the trombone diagram itself is the
 * slider. The image is the focusable `role="slider"` handle — pointer drag
 * maps the pointer x to a position via the ruler band sitting under the slide
 * brace's travel band, and keyboard users get the standard slider contract
 * (arrows/Home/End). `touch-action: none` on the surface keeps touch drags from
 * scrolling the page.
 *
 * Pointer handlers live on a wrapper surface rather than on the `<img>`:
 * native image drag hijacks the pointer even with `draggable={false}`, and
 * `preventDefault()` on the surface's `pointerdown` suppresses it.
 */
export function SlideControl({ value, onChange, maxHeight = 360 }: SlideControlProps) {
  const t = useT();
  const numbersRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  // Preload all seven variants so position swaps never flash an empty image.
  useEffect(() => {
    const urls = Array.from(
      { length: POSITION_COUNT },
      (_, i) => `${import.meta.env.BASE_URL}trombone/trombone-pos-${i + 1}.webp`,
    );
    urls.forEach(u => {
      const im = new Image();
      im.src = u;
    });
  }, []);

  /** Map a pointer x-coordinate to the nearest detent and report it. */
  const positionFromPointer = (clientX: number): PositionId => {
    // Read the ruler band (the travel band), not the img rect — the band is
    // exactly where the slide brace moves.
    const band = numbersRef.current;
    if (!band) return value;
    const rect = band.getBoundingClientRect();
    if (rect.width === 0) return value;
    const ratio = (clientX - rect.left) / rect.width;
    return positionFromRatio(ratio);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Suppresses the browser's native image drag, which otherwise hijacks the
    // pointer and swallows the rest of the drag. Also moves focus off the
    // default mousedown target, so focus the slider handle explicitly.
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget
      .querySelector<HTMLImageElement>('.trombone-dragwell__image')
      ?.focus();
    const next = positionFromPointer(event.clientX);
    if (next !== value) onChange(next);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const next = positionFromPointer(event.clientX);
    if (next !== value) onChange(next);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    // Release capture if we still own it (pointerup); pointercancel releases implicitly.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLImageElement>) => {
    let next: PositionId | null = null;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = clampPosition(value - 1);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = clampPosition(value + 1);
        break;
      case 'Home':
        next = 1;
        break;
      case 'End':
        next = POSITION_COUNT as PositionId;
        break;
      default:
        return; // unhandled keys fall through (no preventDefault)
    }
    event.preventDefault();
    if (next !== value) onChange(next);
  };

  return (
    <Stack spacing={1} sx={{ width: '100%', alignItems: 'stretch' }}>
      <Box className="trombone-dragwell__figure">
        {/* Surface owns the drag: the img underneath stays a pure slider
            handle (role, aria, keyboard) and never sees a pointer event. */}
        <Box
          ref={surfaceRef}
          className="trombone-dragwell__surface"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <TromboneDisplay
            position={value}
            maxHeight={maxHeight}
            className="trombone-dragwell__image"
            role="slider"
            tabIndex={0}
            aria-label={t('trombone.slide.aria')}
            aria-orientation="horizontal"
            aria-valuemin={1}
            aria-valuemax={POSITION_COUNT}
            aria-valuenow={value}
            draggable={false}
            onDragStart={e => e.preventDefault()}
            onKeyDown={onKeyDown}
          />
          {/* Ruler under the trombone, aligned to the brace travel band —
              pointer-events: none so it never intercepts the drag. */}
          <Box ref={numbersRef} className="trombone-dragwell__ruler" aria-hidden="true">
            <Box className="trombone-dragwell__ruler-rail" />
            {([1, 2, 3, 4, 5, 6, 7] as const).map(p => (
              <span
                key={p}
                className={`trombone-dragwell__ruler-tick ${p === value ? 'trombone-dragwell__ruler-tick--active' : ''}`}
                style={{ left: `${detentPct(p)}%` }}
              >
                <Box component="span" className="trombone-dragwell__ruler-tick-mark" />
                <Box component="span" className="trombone-dragwell__ruler-tick-label">
                  {p}
                </Box>
              </span>
            ))}
          </Box>
        </Box>
      </Box>
    </Stack>
  );
}
