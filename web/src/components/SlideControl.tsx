import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Box, Stack } from '@mui/material';
import type { PositionId } from '../trombone/positions';
import { POSITION_COUNT, clampPosition, detentPct, positionFromRatio } from './slidePositions';
import { useT } from '../i18n/I18nContext';
import { HAPTIC_VALVE_DOWN, haptic } from '../utils/haptics';
import { TromboneDisplay } from './TromboneDisplay';

export interface SlideControlProps {
  /** Current slide position (1–7). */
  value: PositionId;
  /** Called with the nearest detent whenever the drag crosses one, or on arrow keys. */
  onChange: (position: PositionId) => void;
  /** Max display height of the trombone image, in CSS pixels. */
  maxHeight?: number;
  /** Render the 7 large tap-detent buttons below the art (mobile primary input). Default false. */
  showTapDetents?: boolean;
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
export function SlideControl({ value, onChange, maxHeight = 480, showTapDetents = false }: SlideControlProps) {
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

  /** Snap to a new position from a pointer interaction, with a detent haptic. */
  const snapTo = (next: PositionId) => {
    if (next === value) return;
    haptic(HAPTIC_VALVE_DOWN);
    onChange(next);
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
    snapTo(positionFromPointer(event.clientX));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    snapTo(positionFromPointer(event.clientX));
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

      {/* Seven tap-detent buttons: the primary touch input on mobile. Sits as
          a SIBLING of the figure (never inside the drag surface) so taps here
          can't bubble into the drag handler or trip setPointerCapture. */}
      {showTapDetents && (
        <Box className="trombone-detents" role="group" aria-label={t('trombone.detents.aria')}>
          {([1, 2, 3, 4, 5, 6, 7] as const).map(p => {
            const down = p === value;
            return (
              <button
                key={p}
                type="button"
                className={`clay-chip drill-valve trombone-detent${down ? ' drill-valve--down' : ''}`}
                aria-pressed={down}
                aria-label={t('trombone.detent.aria').replace('{p}', String(p))}
                onClick={() => snapTo(p)}
                // A focused detent must not eat the drill's Space (submit) or
                // Enter — preventDefault stops the button's native activation
                // (Enter on keydown, Space on keyup) while still letting the
                // event bubble to the window handler, which stays the only
                // thing that submits.
                onKeyDown={event => {
                  if (event.key === ' ' || event.key === 'Enter') event.preventDefault();
                }}
                onKeyUp={event => {
                  if (event.key === ' ') event.preventDefault();
                }}
                onContextMenu={event => event.preventDefault()}
              >
                {p}
              </button>
            );
          })}
        </Box>
      )}
    </Stack>
  );
}
