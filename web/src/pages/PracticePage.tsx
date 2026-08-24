import { useState, useEffect, useRef, useMemo } from 'react';
import { useAudioContext } from '../audio/hooks/useAudioContext';
import { usePitchDetection, type PitchData } from '../audio/hooks/usePitchDetection';
import { NoteSegmenter } from '../audio/NoteSegmenter';
import type { DetectedNote } from '../audio/types';
import { DEFAULT_BPM, annotateNotes, msPerBeat } from '../audio/TimingEngine';
import type { BeatNote } from '../audio/TimingEngine';
import type { ExpectedNote } from '../score/types';
import { formatCents, formatBeats } from '../audio/utils/format';
import { runSegmenterHarness, type HarnessResult } from '../audio/NoteSegmenter.test-harness';
import { runTimingEngineHarness, type TimingResult } from '../audio/TimingEngine.test-harness';
import { runMusicXmlParserHarness, type MusicXmlResult } from '../score/MusicXmlParser.test-harness';
import { runMatcherHarness, type MatcherResult } from '../audio/Matcher.test-harness';
import { runScorerHarness, type ScorerResult } from '../audio/Scorer.test-harness';
import { ScorePicker } from '../components/ScorePicker';
import '../App.css';

const MAX_DETECTED_NOTES = 20; // Live log cap for segmented notes

export function PracticePage() {
    const { isStarted, startAudio, stopAudio, audioContext, audioStartPerfNow } = useAudioContext();
    const [detectedNotes, setDetectedNotes] = useState<DetectedNote[]>([]);
    const segmenterRef = useRef<NoteSegmenter | null>(null);
    const [showDevPanel, setShowDevPanel] = useState(false);
    const [harnessResult, setHarnessResult] = useState<HarnessResult | null>(null);
    const [timingResult, setTimingResult] = useState<TimingResult | null>(null);
    const [musicXmlResult, setMusicXmlResult] = useState<MusicXmlResult | null>(null);
    const [matcherResult, setMatcherResult] = useState<MatcherResult | null>(null);
    const [scorerResult, setScorerResult] = useState<ScorerResult | null>(null);

    // Score picker state
    const [bpm, setBpm] = useState<number>(DEFAULT_BPM);
    const [loadedScore, setLoadedScore] = useState<{
        expected: ExpectedNote[];
        bpm: number;
        source: { id: string; title: string; composer: string };
    } | null>(null);

    const beatNotes: BeatNote[] = useMemo(() => annotateNotes(detectedNotes, bpm), [detectedNotes, bpm]);

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

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: dev-only harness runs once on mount
        setHarnessResult(runSegmenterHarness());
        setTimingResult(runTimingEngineHarness());
        setMusicXmlResult(runMusicXmlParserHarness());
        setMatcherResult(runMatcherHarness());
        setScorerResult(runScorerHarness());
    }, []);

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

        // If we have an anchor and a real (non-null) frame, shift the timestamp
        // so the segmenter's startMs is "ms since AudioContext start". Null frames
        // are passed through unchanged — the segmenter's silence-gap branch uses
        // wall-clock time, which is unaffected by the offset.
        let frameToPush: PitchData | null = pitchData;
        if (frameToPush !== null && audioStartPerfNow !== null) {
            frameToPush = { ...frameToPush, timestamp: frameToPush.timestamp - audioStartPerfNow };
        }

        const finalized = segmenter.push(frameToPush);
        if (finalized.length > 0) {
            setDetectedNotes(prev => [...prev, ...finalized].slice(-MAX_DETECTED_NOTES));
        }
    }, [pitchData, audioStartPerfNow]);

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
                </div>

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
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
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

            <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                <button onClick={() => setShowDevPanel(s => !s)} style={{ padding: '0.25rem 0.75rem' }}>
                    {showDevPanel ? 'Hide' : 'Show'} dev panel
                </button>
                {showDevPanel && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        {harnessResult && (
                            <div>
                                <strong>Segmenter: {harnessResult.pass}/{harnessResult.pass + harnessResult.fail} pass</strong>
                                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                    {harnessResult.details.map((d, i) => (
                                        <li key={i} style={{ color: d.pass ? 'lightgreen' : 'salmon' }}>
                                            {d.pass ? '✓' : '✗'} {d.name}
                                            {d.diff && <div style={{ opacity: 0.7, fontSize: '0.8rem' }}>{d.diff}</div>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {timingResult && (
                            <div style={{ marginTop: '0.75rem' }}>
                                <strong>Timing Engine: {timingResult.pass}/{timingResult.pass + timingResult.fail} pass</strong>
                                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                    {timingResult.details.map((d, i) => (
                                        <li key={i} style={{ color: d.pass ? 'lightgreen' : 'salmon' }}>
                                            {d.pass ? '✓' : '✗'} {d.name}
                                            {d.diff && <div style={{ opacity: 0.7, fontSize: '0.8rem' }}>{d.diff}</div>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {musicXmlResult && (
                            <div style={{ marginTop: '0.75rem' }}>
                                <strong>Score Parser: {musicXmlResult.pass}/{musicXmlResult.pass + musicXmlResult.fail} pass</strong>
                                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                    {musicXmlResult.details.map((d, i) => (
                                        <li key={i} style={{ color: d.pass ? 'lightgreen' : 'salmon' }}>
                                            {d.pass ? '✓' : '✗'} {d.name}
                                            {d.diff && <div style={{ opacity: 0.7, fontSize: '0.8rem' }}>{d.diff}</div>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {matcherResult && (
                            <div style={{ marginTop: '0.75rem' }}>
                                <strong>Matcher: {matcherResult.pass}/{matcherResult.pass + matcherResult.fail} pass</strong>
                                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                    {matcherResult.details.map((d, i) => (
                                        <li key={i} style={{ color: d.pass ? 'lightgreen' : 'salmon' }}>
                                            {d.pass ? '✓' : '✗'} {d.name}
                                            {d.diff && <div style={{ opacity: 0.7, fontSize: '0.8rem' }}>{d.diff}</div>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {scorerResult && (
                            <div style={{ marginTop: '0.75rem' }}>
                                <strong>Scorer: {scorerResult.pass}/{scorerResult.pass + scorerResult.fail} pass</strong>
                                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                    {scorerResult.details.map((d, i) => (
                                        <li key={i} style={{ color: d.pass ? 'lightgreen' : 'salmon' }}>
                                            {d.pass ? '✓' : '✗'} {d.name}
                                            {d.diff && <div style={{ opacity: 0.7, fontSize: '0.8rem' }}>{d.diff}</div>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
