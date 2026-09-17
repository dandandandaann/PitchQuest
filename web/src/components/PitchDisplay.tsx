import { useT } from '../i18n/I18nContext';

interface PitchDisplayProps {
    noteName: string | null;
    frequency: number | null;
}

/**
 * PitchDisplay — the big note readout above the cent meter.
 *
 * Deliberately NOT an aria-live region: it updates many times per second while
 * a note is held, and a live region would flood a screen reader with noise.
 * The CentsMeter below carries the same information in a slower, labelled form.
 */
export function PitchDisplay({ noteName, frequency }: PitchDisplayProps) {
    const t = useT();
    const isLive = noteName !== null;

    return (
        <div className={`pitch-display${isLive ? ' is-live' : ''}`}>
            <span className="clay-eyebrow">{t('components.pitch_display.eyebrow')}</span>

            <div className="pitch-display__note" aria-hidden={!isLive}>
                <span className="pitch-display__glyph">{noteName ?? '–'}</span>
            </div>

            <p className="pitch-display__freq">
                {frequency ? `${frequency.toFixed(1)} Hz` : t('components.pitch_display.no_sound')}
            </p>
        </div>
    );
}