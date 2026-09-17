import { useState, useEffect, useRef } from 'react';
import MicRounded from '@mui/icons-material/MicRounded';
import MicOffRounded from '@mui/icons-material/MicOffRounded';
import GraphicEqRounded from '@mui/icons-material/GraphicEqRounded';
import { useAudioContext } from '../audio/hooks/useAudioContext';
import { usePitchDetection } from '../audio/hooks/usePitchDetection';
import type { PitchData } from '../audio/hooks/usePitchDetection';
import { PitchDisplay } from '../components/PitchDisplay';
import { CentsMeter } from '../components/CentsMeter';
import { NoteHistory } from '../components/NoteHistory';
import { useT } from '../i18n/I18nContext';

// Note to semitone offset mapping for transposition
const NOTE_OFFSETS: Record<string, number> = {
    'C': 0,
    'C#': 10,
    'Db': 10,
    'D': 9,
    'D#': 8,
    'Eb': 8,
    'E': 7,
    'F': 6,
    'F#': 6,
    'Gb': 6,
    'G': 5,
    'G#': 4,
    'Ab': 4,
    'A': 3,
    'A#': 2,
    'Bb': 2,
    'B': 1,
};

const TRANSPOSITION_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const HOLD_MS = 500; // Visual hold duration for the cents meter/note display

export function TunerPage() {
    const t = useT();
    const { isStarted, startAudio, stopAudio, audioContext } = useAudioContext();
    const [transposeNote, setTransposeNote] = useState<string>('C');

    // Calculate transpose offset: if instrument plays C but we want to hear Bb, offset is -2 (down 2 semitones)
    const transposeOffset = NOTE_OFFSETS[transposeNote];

    const pitchData = usePitchDetection({
        audioContext,
        transposeOffset: transposeOffset ?? 0
    });

    // Visual hold state: mirrors pitchData but keeps the last value on screen for HOLD_MS after silence.
    const [displayedPitchData, setDisplayedPitchData] = useState<PitchData | null>(null);
    const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Rolling history of the last few stable note names (for the clay chip strip).
    const [history, setHistory] = useState<string[]>([]);
    const lastLoggedNoteRef = useRef<string | null>(null);

    useEffect(() => {
        if (pitchData) {
            if (holdTimeoutRef.current) {
                clearTimeout(holdTimeoutRef.current);
                holdTimeoutRef.current = null;
            }
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: mirror hook output into display state with a hold timer
            setDisplayedPitchData(pitchData);

            // Log a note only when it *changes* — avoids one chip per frame.
            if (pitchData.noteName !== lastLoggedNoteRef.current) {
                lastLoggedNoteRef.current = pitchData.noteName;
                setHistory(prev => [...prev, pitchData.noteName].slice(-16));
            }
        } else {
            if (holdTimeoutRef.current) {
                clearTimeout(holdTimeoutRef.current);
            }
            holdTimeoutRef.current = setTimeout(() => {
                setDisplayedPitchData(null);
                holdTimeoutRef.current = null;
            }, HOLD_MS);
        }
        return () => {
            if (holdTimeoutRef.current) {
                clearTimeout(holdTimeoutRef.current);
                holdTimeoutRef.current = null;
            }
        };
    }, [pitchData]);

    const handleStop = () => {
        stopAudio();
        lastLoggedNoteRef.current = null;
    };

    return (
        <div className="pq-page">
            {/* ═ HEADER BLOCK ════════════════════════════════════════════════ */}
            <header className="pq-header">
                <div className="pq-header__text">
                    <span className="clay-eyebrow">{t('section.ear_training')}</span>
                    <h1 className="clay-title clay-title--h1">{t('tuner.header.title')}</h1>
                    <p className="clay-lede">{t('tuner.header.lede')}</p>
                </div>
                <span className={`clay-badge ${isStarted ? 'clay-badge--green' : 'clay-badge--white'}`}>
                    <GraphicEqRounded sx={{ fontSize: 15 }} />
                    {isStarted ? t('common.mic.listening') : t('common.mic.off')}
                </span>
            </header>

            {/* ══ MIC GATE ════════════════════════════════════════════════════ */}
            {!isStarted ? (
                <section className="clay-card clay-card--feature tuner-gate" aria-labelledby="tuner-gate-title">
                    <span className="clay-iconplate clay-iconplate--peach">
                        <MicRounded />
                    </span>
                    <h2 id="tuner-gate-title" className="clay-title clay-title--h2">
                        {t('tuner.gate.title')}
                    </h2>
                    <p className="clay-lede" style={{ textAlign: 'center' }}>
                        {t('tuner.gate.body')}
                    </p>
                    <button type="button" className="clay-btn clay-btn--primary clay-btn--lg" onClick={startAudio}>
                        <MicRounded sx={{ fontSize: 22 }} />
                        {t('common.mic.start')}
                    </button>
                    <p className="clay-text tuner-gate__hint">{t('tuner.gate.hint')}</p>
                </section>
            ) : (
                <>
                    {/* ═ CONTROLS ═══════════════════════════════════════════ */}
                    <section className="clay-card tuner-controls" aria-label={t('tuner.controls.aria')}>
                        <div className="tuner-controls__field">
                            <label className="clay-label" htmlFor="transpose-select">
                                {t('tuner.controls.instrument_key')}
                            </label>
                            <select
                                id="transpose-select"
                                className="clay-field"
                                value={transposeNote}
                                onChange={(e) => setTransposeNote(e.target.value)}
                            >
                                {TRANSPOSITION_NOTES.map(note => (
                                    <option key={note} value={note}>{note}</option>
                                ))}
                            </select>
                            <p className="clay-text tuner-controls__help">{t('tuner.controls.help')}</p>
                        </div>

                        <button type="button" className="clay-btn clay-btn--ghost" onClick={handleStop}>
                            <MicOffRounded sx={{ fontSize: 20 }} />
                            {t('common.mic.stop')}
                        </button>
                    </section>

                    {/* ═ READOUT ════════════════════════════════════════════ */}
                    <section className="clay-card clay-card--feature tuner-readout" aria-label={t('tuner.readout.aria')}>
                        <PitchDisplay
                            noteName={displayedPitchData?.noteName || null}
                            frequency={displayedPitchData?.frequency || null}
                        />
                        <CentsMeter cents={displayedPitchData?.cents ?? null} />
                    </section>

                    {/* ══ HISTORY ════════════════════════════════════════════ */}
                    <NoteHistory history={history} />
                </>
            )}

            {/* ═ TECH NOTE ═══════════════════════════════════════════════════ */}
            <footer className="clay-card tuner-foot">
                <span className="clay-eyebrow">{t('tuner.tech.eyebrow')}</span>
                <p className="clay-text">{t('tuner.tech.body')}</p>
            </footer>
        </div>
    );
}