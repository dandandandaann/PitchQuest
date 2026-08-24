import { useState, useEffect, useRef, useMemo } from 'react';
import type { PlayMode } from '../audio/hooks/useScoreSession';
import { useAudioContext } from '../audio/hooks/useAudioContext';
import { usePitchDetection, type PitchData } from '../audio/hooks/usePitchDetection';
import { NoteSegmenter } from '../audio/NoteSegmenter';
import type { DetectedNote } from '../audio/types';
import { DEFAULT_BPM, annotateNotes, msPerBeat } from '../audio/TimingEngine';
import type { BeatNote } from '../audio/TimingEngine';
import type { ExpectedNote } from '../score/types';
import { formatCents, formatBeats } from '../audio/utils/format';
import { ScorePicker } from '../components/ScorePicker';
import { useScoreSession } from '../audio/hooks/useScoreSession';
import { useDevPanelHarnesses } from '../audio/hooks/useDevPanelHarnesses';
import { DEFAULT_SCORING_THRESHOLDS, type ScoringThresholds } from '../audio/Scorer';
import { NoteLane } from '../components/NoteLane';
import '../App.css';

const MAX_DETECTED_NOTES = 20; // Live log cap for segmented notes

export function PracticePage() {
    const { isStarted, startAudio, stopAudio, audioContext, audioStartPerfNow } = useAudioContext();
    const [detectedNotes, setDetectedNotes] = useState<DetectedNote[]>([]);
    const segmenterRef = useRef<NoteSegmenter | null>(null);
    const [showDevPanel, setShowDevPanel] = useState(false);

    // Score picker state
    const [bpm, setBpm] = useState<number>(DEFAULT_BPM);
    const [playMode, setPlayMode] = useState<PlayMode>('wait');
    const [scoringThresholds, setScoringThresholds] = useState<ScoringThresholds>(DEFAULT_SCORING_THRESHOLDS);
    const [loadedScore, setLoadedScore] = useState<{
        expected: ExpectedNote[];
        bpm: number;
        source: { id: string; title: string; composer: string };
    } | null>(null);

    const beatNotes: BeatNote[] = useMemo(() => annotateNotes(detectedNotes, bpm), [detectedNotes, bpm]);

    // Stage 6 Task 4: wire useScoreSession.
    const session = useScoreSession({
        audioRunning: isStarted,
        audioStartPerfNow,
        bpm,
        playMode,
        scoringThresholds,
    });

    // Sync loaded score into the session whenever ScorePicker lifts one.
    useEffect(() => {
        if (loadedScore) {
            session.setExpected(loadedScore.expected, loadedScore.bpm);
        }
        // Intentionally NOT resetting on score clear — leave the session state
        // in place so the user can still review what was played.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadedScore]);

    const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === '') return; // ignore empty; keep last valid
        const n = Number.parseInt(raw, 10);
        if (Number.isNaN(n)) return;
        const clamped = Math.max(30, Math.min(300, n));
        setBpm(clamped);
    };

    const handleScoreLoaded = (
        expected: ExpectedNote[],
        scoreBpm: number,
        source: { id: string; title: string; composer: string },
    ) => {
        setLoadedScore({ expected, bpm: scoreBpm, source });
        setBpm(scoreBpm); // sync BPM input to loaded score's tempo
    };

    const handleClearScore = () => {
        setLoadedScore(null);
        // Keep the current BPM (user may have tuned it); don't force back to DEFAULT_BPM
    };

    // Stage 6 Task 6: extract dev panel harnesses into a dedicated hook.
    const harnesses = useDevPanelHarnesses();

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
    // When a note is finalized, annotate it (incremental: single-element array) and
    // pass to session.consume() so the matcher scores it against the active expected note.
    useEffect(() => {
        const segmenter = segmenterRef.current;
        if (segmenter === null) return;

        // Shift the timestamp relative to the beat-zero anchor so the segmenter
        // works in performance.now() space (ms since session start).
        let frameToPush: PitchData | null = pitchData;
        if (frameToPush !== null && audioStartPerfNow !== null) {
            frameToPush = { ...frameToPush, timestamp: frameToPush.timestamp - audioStartPerfNow };
        }

        const finalized = segmenter.push(frameToPush);
        if (finalized.length > 0) {
            setDetectedNotes(prev => [...prev, ...finalized].slice(-MAX_DETECTED_NOTES));

            // Stage 6 Task 5: wire finalized notes into the session matcher.
            // We annotate one note at a time (not the whole array) — the
            // `annotateNotes([newNote], bpm)[0]` pattern is intentionally
            // incremental so the lane cursor advances as each note is confirmed.
            for (const note of finalized) {
                const annotated = annotateNotes([note], bpm)[0] as BeatNote;
                session.consume(annotated);
            }
        }
    }, [pitchData, audioStartPerfNow, bpm, session]);

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

                {/* Dev debug: show session cursor while a score is loaded */}
                {loadedScore && (
                    <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.25rem' }}>
                        session.currentIndex: {session.currentIndex} / {loadedScore.expected.length}
                        {session.activeTier !== null && (
                            <span style={{ marginLeft: '0.75rem' }}>active tier: <strong>{session.activeTier}</strong></span>
                        )}
                    </p>
                )}

                {/* Score picker — loads ExpectedNote[] into session state */}
                <ScorePicker
                    onScoreLoaded={handleScoreLoaded}
                    onClearScore={handleClearScore}
                    loadedScore={loadedScore?.source ?? null}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                    <label htmlFor="bpm-input">BPM:</label>
                    <input
                        id="bpm-input"
                        type="number"
                        min={30}
                        max={300}
                        step={1}
                        value={bpm}
                        onChange={handleBpmChange}
                        style={{ width: '5rem', padding: '0.25rem' }}
                    />
                    <span style={{ opacity: 0.7, fontSize: '0.9rem' }}>
                        1 beat = {msPerBeat(bpm).toFixed(0)}ms
                    </span>
                    <label style={{ marginLeft: '1rem' }}>
                        Mode:{' '}
                        <select
                            value={playMode}
                            onChange={e => setPlayMode(e.target.value as PlayMode)}
                            style={{ padding: '0.25rem' }}
                        >
                            <option value="wait">Wait (auto-advance)</option>
                            <option value="strict-wait">Strict wait (must hit each note)</option>
                        </select>
                    </label>
                </div>

                {/* Bug 4: user-configurable scoring thresholds */}
                <details style={{ margin: '0.5rem 0' }}>
                    <summary style={{ cursor: 'pointer', opacity: 0.8 }}>
                        Scoring thresholds (advanced)
                    </summary>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto',
                            gap: '0.5rem 1rem',
                            alignItems: 'center',
                            marginTop: '0.5rem',
                            fontSize: '0.85rem',
                        }}
                    >
                        <label htmlFor="th-pitch-perf">Pitch perfect (cents):</label>
                        <input
                            id="th-pitch-perf"
                            type="number"
                            min={1}
                            max={100}
                            step={1}
                            value={scoringThresholds.pitchCentsPerfect}
                            onChange={e =>
                                setScoringThresholds(t => {
                                    const v = Math.max(0, Number(e.target.value) || 0);
                                    return {
                                        ...t,
                                        pitchCentsPerfect: v,
                                        // Ensure ok >= perfect when perfect is lowered.
                                        pitchCentsOk: Math.max(v, t.pitchCentsOk),
                                    };
                                })
                            }
                        />
                        <span style={{ opacity: 0.6 }}>≤ abs pitch error → perfect</span>

                        <label htmlFor="th-pitch-ok">Pitch ok (cents):</label>
                        <input
                            id="th-pitch-ok"
                            type="number"
                            min={1}
                            max={200}
                            step={1}
                            value={scoringThresholds.pitchCentsOk}
                            onChange={e =>
                                setScoringThresholds(t => {
                                    const v = Math.max(0, Number(e.target.value) || 0);
                                    return {
                                        ...t,
                                        pitchCentsOk: Math.max(v, t.pitchCentsPerfect),
                                    };
                                })
                            }
                        />
                        <span style={{ opacity: 0.6 }}>≤ abs pitch error → ok (else miss)</span>

                        <label htmlFor="th-time-perf">Time perfect (beats):</label>
                        <input
                            id="th-time-perf"
                            type="number"
                            min={0.01}
                            max={2}
                            step={0.05}
                            value={scoringThresholds.timeBeatsPerfect}
                            onChange={e =>
                                setScoringThresholds(t => {
                                    const v = Math.max(0, Number(e.target.value) || 0);
                                    return {
                                        ...t,
                                        timeBeatsPerfect: v,
                                        // Ensure ok >= perfect when perfect is lowered.
                                        timeBeatsOk: Math.max(v, t.timeBeatsOk),
                                    };
                                })
                            }
                        />
                        <span style={{ opacity: 0.6 }}>≤ abs time error → perfect</span>

                        <label htmlFor="th-time-ok">Time ok (beats):</label>
                        <input
                            id="th-time-ok"
                            type="number"
                            min={0.01}
                            max={4}
                            step={0.05}
                            value={scoringThresholds.timeBeatsOk}
                            onChange={e =>
                                setScoringThresholds(t => {
                                    const v = Math.max(0, Number(e.target.value) || 0);
                                    return {
                                        ...t,
                                        timeBeatsOk: Math.max(v, t.timeBeatsPerfect),
                                    };
                                })
                            }
                        />
                        <span style={{ opacity: 0.6 }}>≤ abs time error → ok (else miss)</span>

                        <button
                            onClick={() => setScoringThresholds(DEFAULT_SCORING_THRESHOLDS)}
                            style={{ gridColumn: '1 / -1', padding: '0.25rem 0.5rem', marginTop: '0.5rem' }}
                        >
                            Reset to defaults
                        </button>
                    </div>
                </details>

                {/* Stage 6 Task 5: Guitar Hero lane */}
                {loadedScore && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <NoteLane
                            expected={loadedScore.expected}
                            currentIndex={session.currentIndex}
                            activeTier={session.activeTier}
                            liveScored={session.liveScored}
                            audioStartPerfNow={audioStartPerfNow}
                            bpm={bpm}
                            playMode={playMode}
                        />
                    </div>
                )}

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
                            <p style={{ opacity: 0.7, fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>
                                BPM: {bpm}  •  1 beat = {msPerBeat(bpm).toFixed(0)}ms
                            </p>
                            {detectedNotes.length === 0 ? (
                                <p style={{ opacity: 0.6 }}>Sing or play a note to start...</p>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '300px', overflowX: 'auto' }}>
                                    {beatNotes.map((n, i) => (
                                        <li key={`${n.startMs}-${i}`} style={{ display: 'flex', gap: '1rem', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', minWidth: '4rem' }}>{n.noteName}</span>
                                            <span style={{ minWidth: '8rem' }}>{n.durationMs}ms ({formatBeats(n.durationBeats)})</span>
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

            {/* Stage 6 Task 6: dev panel powered by useDevPanelHarnesses */}
            <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                <button onClick={() => setShowDevPanel(s => !s)} style={{ padding: '0.25rem 0.75rem' }}>
                    {showDevPanel ? 'Hide' : 'Show'} dev panel
                </button>
                {showDevPanel && (
                    <DevPanelContent harnesses={harnesses} />
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Dev panel content (consumes harness results from useDevPanelHarnesses)
// ---------------------------------------------------------------------------

interface DevPanelContentProps {
    harnesses: ReturnType<typeof useDevPanelHarnesses>;
}

function DevPanelContent({ harnesses }: DevPanelContentProps) {
    const { segmenter, timing, musicXml, matcher, scorer, incrementalMatcher } = harnesses;

    function renderSection(
        label: string,
        result: { pass: number; fail: number; details: { name: string; pass: boolean; diff?: string }[] } | null,
    ) {
        if (!result) return null;
        const total = result.pass + result.fail;
        return (
            <div style={{ marginTop: '0.75rem' }}>
                <strong>
                    {label}: {result.pass}/{total} pass
                </strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                    {result.details.map((d, i) => (
                        <li key={i} style={{ color: d.pass ? 'lightgreen' : 'salmon' }}>
                            {d.pass ? '✓' : '✗'} {d.name}
                            {d.diff && <div style={{ opacity: 0.7, fontSize: '0.8rem' }}>{d.diff}</div>}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            {renderSection('Segmenter', segmenter)}
            {renderSection('Timing Engine', timing)}
            {renderSection('Score Parser', musicXml)}
            {renderSection('Matcher', matcher)}
            {renderSection('Scorer', scorer)}
            {renderSection('Incremental Matcher', incrementalMatcher)}
        </div>
    );
}
