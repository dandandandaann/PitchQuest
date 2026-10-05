/**
 * useDevPanelHarnesses — Stage 6 Task 6.
 *
 * Extracts the dev-panel rendering (currently inline in PracticePage, now
 * consumed by PracticePage's <DevPanel />) into a dedicated hook. Owns:
 *   - one `useState` call per harness result
 *   - A mount-effect that runs every harness `run*()` function
 *   - Returns the raw result objects for consumption by the caller
 *
 * Two result shapes come back, and DevPanel renders both:
 *   - AGGREGATE (audio/score harnesses): `{ pass, fail, details[{name, pass,
 *     diff?}] }` — `diff` is set only on a failing case.
 *   - CASE LIST (trumpet/trombone harnesses): `HarnessCase[]` — flat
 *     `{ name, pass, detail }`, where `detail` describes the observation and is
 *     shown as the diff only when the case fails.
 *
 * This hook is intentionally dev-only (no prod behaviour changes).
 * It keeps the pages clean and allows the dev panel to grow further
 * (e.g. Stage 7 results-screen harness) without bloating a page component.
 *
 * API choice: returns a plain object of harness result objects. The caller
 * (DevPanel) handles rendering. This keeps the hook focused on
 * computation and avoids coupling rendering concerns into the hook.
 */
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from 'react';
import { runSegmenterHarness, type HarnessResult as SegmenterResult } from '../NoteSegmenter.test-harness';
import { runTimingEngineHarness, type TimingResult } from '../TimingEngine.test-harness';
import { runMusicXmlParserHarness, type MusicXmlResult } from '../../score/MusicXmlParser.test-harness';
import { runMatcherHarness, type MatcherResult } from '../Matcher.test-harness';
import { runScorerHarness, type ScorerResult } from '../Scorer.test-harness';
import { runIncrementalMatcherHarness, type HarnessResult as IncrementalMatcherResult } from '../IncrementalMatcher.test-harness';
import { runValvePressHarness, type HarnessCase as ValvePressCase } from '../../trumpet/valvePress.test-harness';
import { runFingeringsHarness, type HarnessCase as FingeringsCase } from '../../trumpet/fingerings.test-harness';
import { runPositionsHarness, type HarnessCase as PositionsCase } from '../../trombone/positions.test-harness';

export interface DevPanelHarnesses {
    segmenter: SegmenterResult | null;
    timing: TimingResult | null;
    musicXml: MusicXmlResult | null;
    matcher: MatcherResult | null;
    scorer: ScorerResult | null;
    incrementalMatcher: IncrementalMatcherResult | null;
    valvePress: ValvePressCase[] | null;
    fingerings: FingeringsCase[] | null;
    positions: PositionsCase[] | null;
}

/**
 * Mount every dev harness and return their results.
 *
 * Harnesses run once on mount (strict dev-only). No cleanup needed —
 * the harness functions are pure and side-effect-free.
 */
export function useDevPanelHarnesses(): DevPanelHarnesses {
    const [segmenter, setSegmenter] = useState<SegmenterResult | null>(null);
    const [timing, setTiming] = useState<TimingResult | null>(null);
    const [musicXml, setMusicXml] = useState<MusicXmlResult | null>(null);
    const [matcher, setMatcher] = useState<MatcherResult | null>(null);
    const [scorer, setScorer] = useState<ScorerResult | null>(null);
    const [incrementalMatcher, setIncrementalMatcher] = useState<IncrementalMatcherResult | null>(null);
    const [valvePress, setValvePress] = useState<ValvePressCase[] | null>(null);
    const [fingerings, setFingerings] = useState<FingeringsCase[] | null>(null);
    const [positions, setPositions] = useState<PositionsCase[] | null>(null);

    useEffect(() => {
        setSegmenter(runSegmenterHarness());
        setTiming(runTimingEngineHarness());
        setMusicXml(runMusicXmlParserHarness());
        setMatcher(runMatcherHarness());
        setScorer(runScorerHarness());
        setIncrementalMatcher(runIncrementalMatcherHarness());
        setValvePress(runValvePressHarness());
        setFingerings(runFingeringsHarness());
        setPositions(runPositionsHarness());
    }, []);

    return {
        segmenter,
        timing,
        musicXml,
        matcher,
        scorer,
        incrementalMatcher,
        valvePress,
        fingerings,
        positions,
    };
}
/* eslint-enable react-hooks/set-state-in-effect */
