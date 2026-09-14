/**
 * CentsMeter — a clay tuning gauge.
 *
 * Rendering: a single inline SVG.
 *   • Three arc zones — flat (peach), in tune (green), sharp (peach).
 *   • Ticks every 10 cents, emphasised at 0 / ±25 / ±50.
 *   • A rounded clay needle that rotates between −90° (50¢ flat) and +90°
 *     (50¢ sharp).
 *
 * Colour: the needle is INK, not red. Ink is 8.1:1 on peach and 5.7:1 on the
 * green zone, so the needle stays equally visible wherever it points, and the
 * palette stays at four hues (see src/styles/tokens.css).
 *
 * Reduced motion: `prefers-reduced-motion` shortens the needle transition to
 * ~0ms via the global rule in index.css, so the needle snaps instead of easing.
 */

interface CentsMeterProps {
    cents: number | null;
}

/* ── Geometry ─────────────────────────────────────────────────────────────
   A semicircle from 180° (flat end) to 0° (sharp end).
   Radius chosen so the ±90° sweep fits inside the viewBox with room for the
   tick labels and stroke widths.                                             */
const CX = 160;
const CY = 150;
const R = 122;
const STROKE = 22;
const MAX_CENTS = 50;

/** clamp a cents value into the drawable ±50 range. */
function clampCents(c: number): number {
    return Math.max(-MAX_CENTS, Math.min(MAX_CENTS, c));
}

/** cents → degrees. −50¢ = −90°, 0¢ = 0°, +50¢ = +90°. */
function centsToDeg(c: number): number {
    return (clampCents(c) / MAX_CENTS) * 90;
}

/** Polar → cartesian on the gauge arc. 0° = straight up, negative = left. */
function polar(deg: number, radius: number): { x: number; y: number } {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

/** SVG path for an arc between two cents values at a given radius. */
function arcPath(fromCents: number, toCents: number, radius: number): string {
    const a = polar(centsToDeg(fromCents), radius);
    const b = polar(centsToDeg(toCents), radius);
    const largeArc = Math.abs(centsToDeg(toCents) - centsToDeg(fromCents)) > 180 ? 1 : 0;
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const TICKS = [-50, -40, -30, -25, -20, -10, 0, 10, 20, 25, 30, 40, 50];

export function CentsMeter({ cents }: CentsMeterProps) {
    const isLive = cents !== null;
    const c = cents ?? 0;
    const angle = isLive ? centsToDeg(c) : 0;

    const isInTune = isLive && Math.abs(c) <= 25;
    const isClose = isLive && Math.abs(c) > 25 && Math.abs(c) <= 40;

    /** Short human label for the readout under the gauge. */
    const verdict = !isLive
        ? 'Waiting for a note'
        : isInTune
          ? 'In tune'
          : c < 0
            ? 'Flat — go sharper'
            : 'Sharp — go flatter';

    const readoutTone = !isLive ? 'idle' : isInTune ? 'good' : isClose ? 'close' : 'off';

    return (
        <figure className={`cents-meter cents-meter--${readoutTone}`}>
            <svg
                className="cents-meter__gauge"
                viewBox="0 0 320 186"
                role="img"
                aria-label={
                    isLive
                        ? `Tuning gauge: ${Math.round(c)} cents ${c < 0 ? 'flat' : c > 0 ? 'sharp' : ''}, ${verdict}`
                        : 'Tuning gauge: no note detected'
                }
            >
                {/* Background arc — the unlit clay track */}
                <path
                    className="cents-meter__arc cents-meter__arc--track"
                    d={arcPath(-MAX_CENTS, MAX_CENTS, R)}
                    strokeWidth={STROKE}
                />

                {/* Zone arcs */}
                <path
                    className="cents-meter__arc cents-meter__arc--flat"
                    d={arcPath(-MAX_CENTS, -25, R)}
                    strokeWidth={STROKE}
                />
                <path
                    className="cents-meter__arc cents-meter__arc--sharp"
                    d={arcPath(25, MAX_CENTS, R)}
                    strokeWidth={STROKE}
                />
                {/* The green "in tune" band — ±25 cents, matching Scorer defaults */}
                <path
                    className="cents-meter__arc cents-meter__arc--intune"
                    d={arcPath(-25, 25, R)}
                    strokeWidth={STROKE}
                />

                {/* Ticks */}
                {TICKS.map(t => {
                    const major = t === 0 || t === -25 || t === 25 || Math.abs(t) === 50;
                    const outer = polar(centsToDeg(t), R - STROKE / 2 - 4);
                    const inner = polar(centsToDeg(t), R - STROKE / 2 - (major ? 16 : 10));
                    return (
                        <line
                            key={t}
                            className={`cents-meter__tick${major ? ' cents-meter__tick--major' : ''}`}
                            x1={inner.x}
                            y1={inner.y}
                            x2={outer.x}
                            y2={outer.y}
                        />
                    );
                })}

                {/* Needle + hub */}
                <g
                    className={`cents-meter__needle${isLive ? ' is-live' : ''}`}
                    style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}
                >
                    <rect
                        className="cents-meter__needle-bar"
                        x={CX - 5}
                        y={CY - R + STROKE / 2 + 2}
                        width={10}
                        height={R - STROKE / 2 - 6}
                        rx={5}
                    />
                </g>
                <circle className="cents-meter__hub" cx={CX} cy={CY} r={20} />
                <circle className="cents-meter__hub-dot" cx={CX} cy={CY} r={7} />
            </svg>

            <div className="cents-meter__legend" aria-hidden="true">
                <span>Flat</span>
                <span className="cents-meter__legend-mid">In tune</span>
                <span>Sharp</span>
            </div>

            <figcaption className="cents-meter__readout">
                <span className="clay-badge">{isLive ? `${c > 0 ? '+' : ''}${Math.round(c)} cents` : '— cents'}</span>
                <span className="cents-meter__verdict">{verdict}</span>
            </figcaption>
        </figure>
    );
}