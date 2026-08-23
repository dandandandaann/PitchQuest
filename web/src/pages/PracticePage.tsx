import { useState, useEffect, useRef } from 'react';
import { useAudioContext } from '../audio/hooks/useAudioContext';
import { usePitchDetection } from '../audio/hooks/usePitchDetection';
import { NoteSegmenter } from '../audio/NoteSegmenter';
import type { DetectedNote } from '../audio/types';
import { formatCents } from '../audio/utils/format';
import '../App.css';

const MAX_DETECTED_NOTES = 20; // Live log cap for segmented notes

export function PracticePage() {
    const { isStarted, startAudio, stopAudio, audioContext } = useAudioContext();
    const [detectedNotes, setDetectedNotes] = useState<DetectedNote[]>([]);
    const segmenterRef = useRef<NoteSegmenter | null>(null);

    const pitchData = usePitchDetection({
        audioContext,
        transposeOffset: 0,
    });

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

    // Feed raw pitchData into the segmenter.
    useEffect(() => {
        const segmenter = segmenterRef.current;
        if (segmenter === null) return;
        const finalized = segmenter.push(pitchData);
        if (finalized.length > 0) {
            setDetectedNotes(prev => [...prev, ...finalized].slice(-MAX_DETECTED_NOTES));
        }
    }, [pitchData]);

    return (
        <div className="PracticePage">
            <header>
                <h1>Practice</h1>
                <p>Real-time note segmentation</p>
            </header>

            <main>
                <p style={{ opacity: 0.7 }}>
                    Stage 1: Note Segmentation (live)
                </p>
                <p>
                    Notes appear here when you sing or play. Each row is one held pitch (after segmentation heuristics).
                </p>

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
