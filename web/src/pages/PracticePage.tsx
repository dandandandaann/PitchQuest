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

import MicRounded from '@mui/icons-material/MicRounded';
import MicOffRounded from '@mui/icons-material/MicOffRounded';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import SpeedRounded from '@mui/icons-material/SpeedRounded';
import TimerRounded from '@mui/icons-material/TimerRounded';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import GraphicEqRounded from '@mui/icons-material/GraphicEqRounded';

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

    const doneCount = session.currentIndex;
    const totalCount = loadedScore?.expected.length ?? 0;

    return (
        <div className="pq-page">
            {/* ═ HEADER BLOCK ════════════════════════════════════════════════ */}
            <header className="pq-header">
                <div className="pq-header__text">
                    <span className="clay-eyebrow">Practice</span>
                    <h1 className="clay-title clay-title--h1">Score practice</h1>
                    <p className="clay-lede">
                        Load a piece, start the mic, and play. Every note is matched against the score and coloured
                        as it lands — green for perfect, blue for close, grey for missed.
                    </p>
                </div>
                <span className={`clay-badge ${isStarted ? 'clay-badge--green' : 'clay-badge--white'}`}>
                    <GraphicEqRounded sx={{ fontSize: 15 }} />
                    {isStarted ? 'Listening' : 'Mic off'}
                </span>
            </header>

            {/* ═ SCORE PICKER ════════════════════════════════════════════════ */}
            <ScorePicker
                onScoreLoaded={handleScoreLoaded}
                onClearScore={handleClearScore}
                loadedScore={loadedScore?.source ?? null}
            />

            {/* ══ SESSION SETTINGS ═══════════════════════════════════════════ */}
            <section className="clay-card practice-settings" aria-labelledby="practice-settings-title">
                <header className="practice-settings__head">
                    <span className="clay-iconplate clay-iconplate--peach">
                        <TuneRounded />
                    </span>
                    <div>
                        <h2 id="practice-settings-title" className="clay-title clay-title--h2">
                            Session settings
                        </h2>
                        <p className="clay-text">Tempo and how strictly the lane waits for you.</p>
                    </div>
                </header>

                <div className="practice-settings__grid">
                    <div className="practice-field">
                        <label className="clay-label" htmlFor="bpm-input">
                            <SpeedRounded sx={{ fontSize: 16, verticalAlign: '-3px', marginRight: '6px' }} />
                            Tempo (BPM)
                        </label>
                        <input
                            id="bpm-input"
                            className="clay-field"
                            type="number"
                            min={30}
                            max={300}
                            step={1}
                            value={bpm}
                            onChange={handleBpmChange}
                        />
                        <p className="clay-text practice-field__help">
                            <TimerRounded sx={{ fontSize: 14, verticalAlign: '-2px', marginRight: '4px' }} />1 beat ≈{' '}
                            {msPerBeat(bpm).toFixed(0)} ms
                        </p>
                    </div>

                    <div className="practice-field">
                        <label className="clay-label" htmlFor="mode-select">
                            Advance mode
                        </label>
                        <select
                            id="mode-select"
                            className="clay-field"
                            value={playMode}
                            onChange={e => setPlayMode(e.target.value as PlayMode)}
                        >
                            <option value="wait">Wait — auto-advance after the grace window</option>
                            <option value="strict-wait">Strict — hold until you hit the note</option>
                        </select>
                        <p className="clay-text practice-field__help">
                            {playMode === 'wait'
                                ? 'The lane moves on by itself, marking missed notes.'
                                : 'The lane freezes on the active note until you play it correctly.'}
                        </p>
                    </div>
                </div>

                {/* ── Advanced thresholds ──────────────────────────────────── */}
                <details className="practice-advanced">
                    <summary className="practice-advanced__summary">
                        <InsightsRounded sx={{ fontSize: 18 }} />
                        Scoring thresholds
                        <span className="practice-advanced__hint">pitch ±{scoringThresholds.pitchCentsPerfect}¢ perfect</span>
                    </summary>

                    <div className="practice-advanced__body">
                        <div className="practice-advanced__grid">
                            <label htmlFor="th-pitch-perf">Pitch — perfect (cents)</label>
                            <input
                                id="th-pitch-perf"
                                className="clay-field"
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
                            <p className="practice-advanced__desc">within this error → perfect</p>

                            <label htmlFor="th-pitch-ok">Pitch — ok (cents)</label>
                            <input
                                id="th-pitch-ok"
                                className="clay-field"
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
                            <p className="practice-advanced__desc">within this error → ok, beyond → miss</p>

                            <label htmlFor="th-time-perf">Timing — perfect (beats)</label>
                            <input
                                id="th-time-perf"
                                className="clay-field"
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
                            <p className="practice-advanced__desc">within this error → perfect</p>

                            <label htmlFor="th-time-ok">Timing — ok (beats)</label>
                            <input
                                id="th-time-ok"
                                className="clay-field"
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
                            <p className="practice-advanced__desc">within this error → ok, beyond → miss</p>
                        </div>

                        <button
                            type="button"
                            className="clay-btn clay-btn--sm clay-btn--ghost"
                            onClick={() => setScoringThresholds(DEFAULT_SCORING_THRESHOLDS)}
                        >
                            <ReplayRounded sx={{ fontSize: 18 }} />
                            Reset to defaults
                        </button>
                    </div>
                </details>
            </section>

            {/* ══ LANE ════════════════════════════════════════════════════════ */}
            {loadedScore && (
                <section className="clay-card clay-card--feature practice-lane" aria-labelledby="practice-lane-title">
                    <header className="practice-lane__head">
                        <span className="clay-iconplate clay-iconplate--green">
                            <SchoolRounded />
                        </span>
                        <div className="practice-lane__title-wrap">
                            <h2 id="practice-lane-title" className="clay-title clay-title--h2">
                                {loadedScore.source.title}
                            </h2>
                            <p className="clay-text">
                                {loadedScore.source.composer} · {bpm} BPM ·{' '}
                                {playMode === 'wait' ? 'auto-advance' : 'strict wait'}
                            </p>
                        </div>
                        <div className="practice-lane__score">
                            <span className="clay-badge clay-badge--white">
                                {doneCount} / {totalCount} notes
                            </span>
                            {session.activeTier !== null && (
                                <span className={`clay-badge clay-badge--${session.activeTier}`}>
                                    last: {session.activeTier}
                                </span>
                            )}
                        </div>
                    </header>

                    <NoteLane
                        expected={loadedScore.expected}
                        currentIndex={session.currentIndex}
                        activeTier={session.activeTier}
                        liveScored={session.liveScored}
                        audioStartPerfNow={audioStartPerfNow}
                        bpm={bpm}
                        playMode={playMode}
                    />

                    {!isStarted && (
                        <p className="clay-text practice-lane__note">
                            Start the microphone below to begin the run — the lane waits at the first note.
                        </p>
                    )}
                </section>
            )}

            {/* ══ MIC + LIVE NOTES ════════════════════════════════════════════ */}
            {!isStarted ? (
                <section className="clay-card clay-card--feature practice-gate" aria-labelledby="practice-gate-title">
                    <span className="clay-iconplate clay-iconplate--peach">
                        <MicRounded />
                    </span>
                    <h2 id="practice-gate-title" className="clay-title clay-title--h2">
                        Start the microphone
                    </h2>
                    <p className="clay-lede" style={{ textAlign: 'center' }}>
                        PitchQuest listens for single held notes. Play one note at a time and hold it — chords and
                        fast runs are out of scope for now.
                    </p>
                    <button type="button" className="clay-btn clay-btn--primary clay-btn--lg" onClick={startAudio}>
                        <MicRounded sx={{ fontSize: 22 }} />
                        Start microphone
                    </button>
                </section>
            ) : (
                <section className="clay-card practice-detected" aria-labelledby="practice-detected-title">
                    <header className="practice-detected__head">
                        <div>
                            <h2 id="practice-detected-title" className="clay-title clay-title--h2">
                                Detected notes
                            </h2>
                            <p className="clay-text">
                                Each row is one held pitch after segmentation · 1 beat ≈ {msPerBeat(bpm).toFixed(0)} ms
                            </p>
                        </div>
                        <button type="button" className="clay-btn clay-btn--ghost" onClick={stopAudio}>
                            <MicOffRounded sx={{ fontSize: 20 }} />
                            Stop microphone
                        </button>
                    </header>

                    {detectedNotes.length === 0 ? (
                        <p className="clay-notice" role="status">
                            <GraphicEqRounded sx={{ fontSize: 20, flex: '0 0 auto' }} />
                            <span>Listening… sing or play a note to start.</span>
                        </p>
                    ) : (
                        <ul className="detected-list">
                            {beatNotes.map((n, i) => (
                                <li key={`${n.startMs}-${i}`} className="detected-row">
                                    <span className="detected-row__note">{n.noteName}</span>
                                    <span className="detected-row__dur">
                                        {n.durationMs} ms
                                        <span className="detected-row__beats">({formatBeats(n.durationBeats)})</span>
                                    </span>
                                    <span
                                        className={`clay-badge ${
                                            Math.abs(n.avgCents) <= 25 ? 'clay-badge--green' : 'clay-badge--blue'
                                        } detected-row__cents`}
                                    >
                                        {formatCents(n.avgCents)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {/* ══ DEV PANEL ═══════════════════════════════════════════════════ */}
            <section className="clay-card clay-card--sunk dev-panel" aria-labelledby="dev-panel-title">
                <h2 id="dev-panel-title" className="clay-eyebrow">
                    Developer
                </h2>
                <p className="clay-text dev-panel__lede">
                    Pure-function test harnesses (segmenter, timing, parser, matcher, scorer) run live in the browser.
                </p>
                <button
                    type="button"
                    className="clay-btn clay-btn--sm clay-btn--ghost"
                    onClick={() => setShowDevPanel(s => !s)}
                    aria-expanded={showDevPanel}
                    aria-controls="dev-panel-content"
                >
                    {showDevPanel ? 'Hide' : 'Show'} test harnesses
                </button>

                {showDevPanel && (
                    <div id="dev-panel-content">
                        <DevPanelContent harnesses={harnesses} />
                    </div>
                )}
            </section>
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
        const allPass = result.fail === 0;
        return (
            <div className="dev-section">
                <p className="dev-section__head">
                    <span className={`clay-badge ${allPass ? 'clay-badge--green' : 'clay-badge--peach'}`}>
                        {allPass ? <CheckCircleRounded sx={{ fontSize: 14 }} /> : <ErrorOutlineRounded sx={{ fontSize: 14 }} />}
                        {result.pass}/{total} pass
                    </span>
                    <span className="dev-section__label">{label}</span>
                </p>
                <ul className="dev-section__list">
                    {result.details.map((d, i) => (
                        <li key={i} className={`dev-case${d.pass ? '' : ' dev-case--fail'}`}>
                            <span className="dev-case__name">{d.name}</span>
                            {d.diff && <span className="dev-case__diff">{d.diff}</span>}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <div className="dev-grid">
            {renderSection('Segmenter', segmenter)}
            {renderSection('Timing engine', timing)}
            {renderSection('Score parser', musicXml)}
            {renderSection('Matcher', matcher)}
            {renderSection('Scorer', scorer)}
            {renderSection('Incremental matcher', incrementalMatcher)}
        </div>
    );
}