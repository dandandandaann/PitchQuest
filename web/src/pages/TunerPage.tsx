import { useState, useEffect, useRef } from 'react';
import { useAudioContext } from '../audio/hooks/useAudioContext';
import { usePitchDetection } from '../audio/hooks/usePitchDetection';
import type { PitchData } from '../audio/hooks/usePitchDetection';
import { NoteSegmenter } from '../audio/NoteSegmenter';
import type { DetectedNote } from '../audio/types';
import { PitchDisplay } from '../components/PitchDisplay';
import { CentsMeter } from '../components/CentsMeter';
import '../App.css';

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
const MAX_DETECTED_NOTES = 20; // Live log cap for segmented notes

function formatCents(c: number): string {
    return `${c >= 0 ? '+' : ''}${c}¢`;
}

export function TunerPage() {
    const { isStarted, startAudio, stopAudio, audioContext } = useAudioContext();
    const [transposeNote, setTransposeNote] = useState<string>('C');
    const [detectedNotes, setDetectedNotes] = useState<DetectedNote[]>([]);
    const segmenterRef = useRef<NoteSegmenter | null>(null);

    // Calculate transpose offset: if instrument plays C but we want to hear Bb, offset is -2 (down 2 semitones)
    const transposeOffset = NOTE_OFFSETS[transposeNote];

    const pitchData = usePitchDetection({
        audioContext,
        transposeOffset: transposeOffset ?? 0
    });

    // Visual hold state: mirrors pitchData but keeps the last value on screen for HOLD_MS after silence.
    const [displayedPitchData, setDisplayedPitchData] = useState<PitchData | null>(null);
    const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (pitchData) {
            if (holdTimeoutRef.current) {
                clearTimeout(holdTimeoutRef.current);
                holdTimeoutRef.current = null;
            }
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: mirror hook output into display state with a hold timer
            setDisplayedPitchData(pitchData);
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

    // Manage segmenter lifecycle across mic on/off transitions:
    //  - isStarted false → true: create a fresh segmenter and clear the live log.
    //  - isStarted true  → false: flush any in-flight note into the log, drop the segmenter.
    const lastIsStartedRef = useRef<boolean>(false);
    useEffect(() => {
        if (isStarted && !lastIsStartedRef.current) {
            segmenterRef.current = new NoteSegmenter();
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: reset log at session start
            setDetectedNotes([]);
        } else if (!isStarted && lastIsStartedRef.current) {
            const flushed = segmenterRef.current?.flush() ?? [];
            if (flushed.length > 0) {
                setDetectedNotes(prev => [...prev, ...flushed].slice(-MAX_DETECTED_NOTES));
            }
            segmenterRef.current = null;
        }
        lastIsStartedRef.current = isStarted;
    }, [isStarted]);

    // Feed raw pitchData into the segmenter. Uses RAW (not displayedPitchData)
    // because segmentation depends on real silence gaps, not the visual hold.
    useEffect(() => {
        const segmenter = segmenterRef.current;
        if (segmenter === null) return;
        const finalized = segmenter.push(pitchData);
        if (finalized.length > 0) {
            setDetectedNotes(prev => [...prev, ...finalized].slice(-MAX_DETECTED_NOTES));
        }
    }, [pitchData]);

    return (
        <div className="TunerPage">
            <header>
                <h1>Tuner</h1>
                <p>Turn on your microphone</p>
            </header>

            <main>
                {!isStarted ? (
                    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                        <button
                            onClick={startAudio}
                            style={{ padding: '1rem 2rem', fontSize: '1.2rem', cursor: 'pointer' }}
                        >
                            Start Microphone
                        </button>
                    </div>
                ) : (
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                            <label htmlFor="transpose-select" style={{ marginRight: '0.5rem' }}>Instrument Key:</label>
                            <select
                                id="transpose-select"
                                value={transposeNote}
                                onChange={(e) => setTransposeNote(e.target.value)}
                                style={{ padding: '0.5rem', fontSize: '1rem' }}
                            >
                                {TRANSPOSITION_NOTES.map(note => (
                                    <option key={note} value={note}>{note}</option>
                                ))}
                            </select>
                        </div>

                        <PitchDisplay
                            noteName={displayedPitchData?.noteName || null}
                            frequency={displayedPitchData?.frequency || null}
                        />
                        <CentsMeter cents={displayedPitchData?.cents ?? null} />

                        <section className="detected-notes">
                            <h3>Detected Notes (live)</h3>
                            {detectedNotes.length === 0 ? (
                                <p style={{ opacity: 0.6 }}>Sing or play a note to start...</p>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {detectedNotes.map((n, i) => (
                                        <li key={`${n.startMs}-${i}`} style={{ display: 'flex', gap: '1rem', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', minWidth: '4rem' }}>{n.noteName}</span>
                                            <span style={{ minWidth: '5rem' }}>{n.durationMs}ms</span>
                                            <span style={{ minWidth: '4rem' }}>{formatCents(n.avgCents)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                            <button onClick={stopAudio}>Stop Microphone</button>
                        </div>
                    </div>
                )}
            </main>

            <footer style={{ marginTop: '3rem', fontSize: '0.8rem', opacity: 0.6 }}>
                <p>Buffer: 2048 | Algorithm: YIN | Library: pitchy</p>
            </footer>
        </div>
    );
}
