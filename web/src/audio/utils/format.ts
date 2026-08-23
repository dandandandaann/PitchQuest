export const formatCents = (c: number): string => `${c >= 0 ? '+' : ''}${c}¢`;

/** Format a beat value to 2 decimal places with a `b` suffix. */
export const formatBeats = (b: number): string => `${b.toFixed(2)}b`;
