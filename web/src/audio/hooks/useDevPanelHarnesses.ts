/**
 * useDevPanelHarnesses — Stage 6 Task 6.
 *
 * Extracts the 6-section dev-panel rendering (currently inline in PracticePage)
 * into a dedicated hook. Owns:
 *   - 6 `useState` calls (one per harness result)
 *   - A mount-effect that runs all 6 harness `run*()` functions
 *   - Returns the raw result objects for consumption by the caller
 *
 * This hook is intentionally dev-only (no prod behaviour changes).
 * It keeps PracticePage clean and allows the dev panel to grow further
 * (e.g. Stage 7 results-screen harness) without bloating the page component.
 *
 * API choice: returns a plain object `{ segmenter, timing, musicXml, matcher,
 * scorer, incrementalMatcher }` of harness result objects. The caller
 * (PracticePage) handles rendering. This keeps the hook focused on
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

export interface DevPanelHarnesses {
    segmenter: SegmenterResult | null;
    timing: TimingResult | null;
    musicXml: MusicXmlResult | null;
    matcher: MatcherResult | null;
    scorer: ScorerResult | null;
    incrementalMatcher: IncrementalMatcherResult | null;
}

/**
 * Mount all 6 dev harnesses and return their results.
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

    useEffect(() => {
        setSegmenter(runSegmenterHarness());
        setTiming(runTimingEngineHarness());
        setMusicXml(runMusicXmlParserHarness());
        setMatcher(runMatcherHarness());
        setScorer(runScorerHarness());
        setIncrementalMatcher(runIncrementalMatcherHarness());
    }, []);

    return { segmenter, timing, musicXml, matcher, scorer, incrementalMatcher };
}
/* eslint-enable react-hooks/set-state-in-effect */
