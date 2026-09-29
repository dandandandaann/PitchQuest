import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { PositionId } from '../trombone/positions';
import { useT } from '../i18n/I18nContext';

const POSITION_COUNT = 7;

export interface SlideControlProps {
  /** Current slide position (1–7). */
  value: PositionId;
  /** Called with the nearest detent whenever the drag crosses one, or on arrow keys. */
  onChange: (position: PositionId) => void;
}

/** Percentage offset (0–100) of a position's detent along the track. */
function detentPct(position: PositionId): number {
  return ((position - 1) / (POSITION_COUNT - 1)) * 100;
}

/** Clamp a raw value into a valid PositionId. */
function clampPosition(raw: number): PositionId {
  return Math.min(POSITION_COUNT, Math.max(1, Math.round(raw))) as PositionId;
}

/**
 * Horizontal 7-detent slide-position control (trombone slide).
 *
 * Pointer Events only (works for mouse + touch via pointer capture); the track
 * has `touch-action: none` so touch drags don't scroll the page. Dragging maps
 * the pointer to the nearest detent and snaps the handle there. Keyboard users
 * get a standard slider contract (arrows/Home/End) on the focusable handle.
 */
export function SlideControl({ value, onChange }: SlideControlProps) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  /** Map a pointer x-coordinate to the nearest detent and report it. */
  const positionFromPointer = (clientX: number): PositionId => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return value;
    const ratio = (clientX - rect.left) / rect.width;
    return clampPosition(ratio * (POSITION_COUNT - 1) + 1);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
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

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
    <Stack spacing={0.5} sx={{ width: '100%', maxWidth: 420, alignItems: 'stretch' }}>
      <Box
        ref={trackRef}
        className="slide-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Rail the handle travels along */}
        <Box className="slide-track__rail" aria-hidden="true" />
        {/* Detent marks 1..7 */}
        {([1, 2, 3, 4, 5, 6, 7] as const).map(p => (
          <Box
            key={p}
            className="slide-track__detent"
            aria-hidden="true"
            sx={{ left: `${detentPct(p)}%` }}
          >
            <Typography component="span" className="slide-track__detent-label">
              {p}
            </Typography>
          </Box>
        ))}
        {/* Draggable handle — also the keyboard slider */}
        <Box
          className="slide-track__handle"
          role="slider"
          tabIndex={0}
          aria-label={t('trombone.slide.aria')}
          aria-valuemin={1}
          aria-valuemax={POSITION_COUNT}
          aria-valuenow={value}
          sx={{ left: `${detentPct(value)}%` }}
          onKeyDown={onKeyDown}
        />
      </Box>
    </Stack>
  );
}
