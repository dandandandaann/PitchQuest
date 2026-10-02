import { useRef } from 'react';
import Button from '@mui/material/Button';

interface DrillSubmitButtonProps {
  /** Fired when the user confirms the current answer. */
  onPress: () => void;
  /** Visible button copy. */
  label: string;
  /** Accessible name (the visible label is often short/ambiguous). */
  ariaLabel: string;
}

/** Drop a capture only if it is still held — releasing an already-released
 *  pointerId throws NotFoundError in Blink, which would blow up the handler. */
function releaseCaptureIfHeld(element: HTMLElement, pointerId: number): void {
  if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
}

/**
 * On-screen replacement for the drill's Space key.
 *
 * Fires from `pointerup`, never from `click`: Blink only synthesises a `click`
 * for a tap that BEGINS with no other touch point down, so a player holding
 * 1–3 valves with one hand and tapping submit with a finger of the other — the
 * whole reason this button exists — got no submit at all from an `onClick`
 * button. Per-pointer capture + `pointerup` is the one path that works in that
 * state, and it mirrors the valve chips.
 *
 * `onClick` is deliberately NOT kept as a fallback. Once `pointerup` owns real
 * input, a click handler can only be a double-fire hazard (the browser still
 * emits a click for every tap it *does* synthesize), and it cannot rescue any
 * browser we support: Pointer Events are baseline since 2016 and MUI 7 targets
 * nothing older. Keyboard activation is covered explicitly below, so nothing
 * that worked with `onClick` is lost:
 *   • Space — the drill's window handler submits, and the `preventDefault`
 *     here cancels the button's own (double) activation.
 *   • Enter  — a focused button still activates, handled here.
 */
export function DrillSubmitButton({ onPress, label, ariaLabel }: DrillSubmitButtonProps) {
  /** The pointer that began on this button; an up from any other is ignored. */
  const pressedPointerId = useRef<number | null>(null);

  return (
    <Button
      type="button"
      variant="contained"
      aria-label={ariaLabel}
      className="clay-btn clay-btn--primary drill-submit"
      // `manipulation` = keep pan/pinch, drop double-tap-zoom, so a quick tap
      // is never swallowed waiting to see whether a second one follows.
      // Mirrored in pages.css (.drill-submit) as the plain-CSS source of truth.
      sx={{ touchAction: 'manipulation' }}
      onPointerDown={event => {
        // Capture keeps this button the event target until the finger lifts, so
        // a tap that slides off still completes — and so no other finger's
        // release can ever land here.
        event.currentTarget.setPointerCapture(event.pointerId);
        pressedPointerId.current = event.pointerId;
      }}
      onPointerUp={event => {
        if (pressedPointerId.current === event.pointerId) {
          pressedPointerId.current = null;
          onPress();
        }
        releaseCaptureIfHeld(event.currentTarget, event.pointerId);
      }}
      onPointerCancel={event => {
        // Cancelled (browser took over the gesture): never submit, just unwire.
        pressedPointerId.current = null;
        releaseCaptureIfHeld(event.currentTarget, event.pointerId);
      }}
      onLostPointerCapture={() => {
        // Same stuck-input safety net as the valve chips: a pointer we no
        // longer own must never be able to fire a press later.
        pressedPointerId.current = null;
      }}
      onKeyDown={event => {
        // Space stays the page's window handler (see above).
        if (event.key === ' ') event.preventDefault();
        if (event.key === 'Enter' && !event.repeat) {
          event.preventDefault();
          onPress();
        }
      }}
      // Kill the iOS/Android long-press callout, as the valve chips do.
      onContextMenu={event => event.preventDefault()}
    >
      {label}
    </Button>
  );
}
