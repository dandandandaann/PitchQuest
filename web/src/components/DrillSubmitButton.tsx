import Button from '@mui/material/Button';

interface DrillSubmitButtonProps {
  /** Fired when the user confirms the current answer. */
  onPress: () => void;
  /** Visible button copy. */
  label: string;
  /** Accessible name (the visible label is often short/ambiguous). */
  ariaLabel: string;
}

/**
 * On-screen replacement for the drill's Space key.
 *
 * Uses `onClick` (never `pointerdown`) so a touch that starts a page scroll can
 * never fire a submit. Full-width and thumb-sized; the clay look comes from the
 * `.clay-btn` / `.clay-btn--primary` primitives plus the `.drill-submit` layout
 * rule in pages.css.
 */
export function DrillSubmitButton({ onPress, label, ariaLabel }: DrillSubmitButtonProps) {
  return (
    <Button
      type="button"
      variant="contained"
      onClick={onPress}
      aria-label={ariaLabel}
      className="clay-btn clay-btn--primary drill-submit"
    >
      {label}
    </Button>
  );
}
