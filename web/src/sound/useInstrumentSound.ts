/**
 * React binding for {@link createSamplePlayer}.
 *
 * One player per hook instance, owned by the component that renders the drill:
 * the player is created in an effect and disposed on unmount, and `play` is
 * referentially stable so drill pages can register their keydown listener once
 * with `[]` deps.
 *
 * The instrument and the mute flag are read through refs, which is what lets
 * `play` stay stable while still honouring the latest props.
 */

import { useCallback, useEffect, useRef } from 'react';
import { createSamplePlayer } from './SamplePlayer';
import type { SamplePlayer } from './SamplePlayer';
import type { InstrumentId } from './sampleSets';

export interface UseInstrumentSoundResult {
  /**
   * Sound a WRITTEN drill note (e.g. "F#3"). Fire-and-forget: never throws and
   * is a no-op when muted or before the sample has finished decoding.
   */
  play(writtenNote: string): void;
}

export interface UseInstrumentSoundOptions {
  /** When false, play() is a no-op. Defaults to true. */
  enabled?: boolean;
}

export function useInstrumentSound(
  instrument: InstrumentId,
  options?: UseInstrumentSoundOptions,
): UseInstrumentSoundResult {
  const enabled = options?.enabled ?? true;

  // Stable across renders; updated in an effect so `play` can read the latest
  // values without depending on them.
  const instrumentRef = useRef(instrument);
  const enabledRef = useRef(enabled);
  const playerRef = useRef<SamplePlayer | null>(null);

  useEffect(() => {
    instrumentRef.current = instrument;
    enabledRef.current = enabled;
  }, [instrument, enabled]);

  useEffect(() => {
    const existing = playerRef.current;
    if (existing !== null) {
      void existing.preload(instrument);
      return;
    }
    // Created in an effect, never during render: a new AudioContext on render
    // would fire outside the user gesture that unlocks audio.
    const player = createSamplePlayer();
    playerRef.current = player;
    void player.preload(instrument);
  }, [instrument]);

  useEffect(() => {
    return () => {
      // Clearing the ref matters under React 19 StrictMode: the double-invoked
      // effect cleans up and re-runs, and the second run must build a fresh
      // player rather than hand back the disposed one.
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  const play = useCallback((writtenNote: string): void => {
    if (!enabledRef.current) return;
    playerRef.current?.play(instrumentRef.current, writtenNote);
  }, []);

  return { play };
}
