import { useState, useEffect, useRef } from 'react';
import { useAudioContext } from '../audio/hooks/useAudioContext';
import { usePitchDetection } from '../audio/hooks/usePitchDetection';
import { PitchDisplay } from '../components/PitchDisplay';
import { CentsMeter } from '../components/CentsMeter';
import { NoteHistory } from '../components/NoteHistory';
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

export function TunerPage() {
    const { isStarted, startAudio, stopAudio, audioContext } = useAudioContext();
    const [transposeNote, setTransposeNote] = useState<string>('C');
    const [holdDuration, setHoldDuration] = useState<number>(500);
    const [noteHistory, setNoteHistory] = useState<string[]>([]);

    // Calculate transpose offset: if instrument plays C but we want to hear Bb, offset is -2 (down 2 semitones)
    const transposeOffset = NOTE_OFFSETS[transposeNote];

    const pitchData = usePitchDetection({
        audioContext,
        transposeOffset: transposeOffset ?? 0,
        holdDuration
    });

    // Refs for history deduplication - track last added time and note
    const lastHistoryTimeRef = useRef<number>(0);
    const lastHistoryNoteRef = useRef<string>('');

    // Track note history when a valid note is detected
    useEffect(() => {
        if (pitchData?.noteName && pitchData.cents !== null) {
            const shouldAdd = pitchData.noteName !== lastHistoryNoteRef.current ||
                              Date.now() - lastHistoryTimeRef.current >= 2000;
            if (shouldAdd) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: need to update history when pitch changes
                setNoteHistory(prev => {
                    const newHistory = [...prev, pitchData.noteName];
                    return newHistory.slice(-100); // Keep only the last 10 notes
                });
                lastHistoryTimeRef.current = Date.now();
                lastHistoryNoteRef.current = pitchData.noteName;
            }
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

                        <div style={{ textAlign: 'center', marginBottom: '1rem', marginTop: '1rem', visibility: 'visible' }}>
                            <label htmlFor="hold-duration" style={{ marginRight: '0.5rem' }}>Hold Duration (ms):</label>
                            <input
                                id="hold-duration"
                                type="number"
                                min={100}
                                max={2000}
                                step={100}
                                value={holdDuration}
                                onChange={(e) => setHoldDuration(Math.max(100, Math.min(2000, Number(e.target.value))))}
                                style={{ padding: '0.5rem', fontSize: '1rem', width: '80px' }}
                            />
                        </div>

                        <PitchDisplay
                            noteName={pitchData?.noteName || null}
                            frequency={pitchData?.frequency || null}
                        />
                        <CentsMeter cents={pitchData?.cents ?? null} />

                        <NoteHistory history={noteHistory} />

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
