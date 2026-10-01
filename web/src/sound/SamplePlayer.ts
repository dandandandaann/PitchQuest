/**
 * Web Audio playback of the committed sample slices.
 *
 * The only place in the app that touches Web Audio for instrument sounds, and
 * the only place that builds sample URLs: `sampleSets` paths are RELATIVE, so
 * the app base URL is prepended here (same pattern as TrumpetDisplay).
 *
 * Three contexts' worth of rules, condensed:
 *   - DECODING happens on a module-scoped OfflineAudioContext created lazily.
 *     Decoding needs no user gesture, logs no autoplay warning, and the
 *     resulting AudioBuffer is context-agnostic (the live context plays it).
 *   - The LIVE AudioContext is created lazily INSIDE play(), which the drill
 *     pages only call from a real keydown gesture, and is resumed when
 *     suspended. That is the autoplay unlock.
 *   - Loading is a monophonic, fire-and-forget pipeline: fetch -> decode ->
 *     cache by path. A missing file (the samples are rendered separately) warns
 *     once and turns into a silent no-op; it never throws into play().
 */

import { INSTRUMENT_SOUNDS } from './sampleSets';
import type { InstrumentId } from './sampleSets';
import { choiceForWrittenNote } from './selectSample';

export interface SamplePlayer {
  /** Fetch + decode every sample of `instrument`. Idempotent, never rejects. */
  preload(instrument: InstrumentId): Promise<void>;
  /**
   * Sound the nearest sample for a WRITTEN drill note, with the attack/hold/
   * release envelope. Returns false when the sample is not decoded yet or the
   * note name does not parse. Never throws.
   */
  play(instrument: InstrumentId, writtenNote: string): boolean;
  /** Steal (fade out) and stop the current voice, if any. */
  stopAll(): void;
  /** Stop everything, close the live context, drop the caches. Inert afterwards. */
  dispose(): void;
}

/** The one voice a player may be sounding at a time. */
interface ActiveVoice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

/** Scheduling headroom so the first ramp is never booked at "now" and clips. */
const START_DELAY_SEC = 0.005;
/** Fade length when stealing the voice, and the grace between fade and stop. */
const STEAL_FADE_SEC = 0.01;
const STEAL_STOP_SEC = 0.02;
/** Grace after the envelope's end before the source is torn down. */
const END_GRACE_SEC = 0.02;

/**
 * Module-scoped so every player shares one decode context. Created on the first
 * decode, not at import time: module evaluation can happen before any gesture
 * and the samples may never be needed.
 */
let decodeContext: OfflineAudioContext | null = null;

function getDecodeContext(): OfflineAudioContext {
  if (decodeContext === null) {
    decodeContext = new OfflineAudioContext(1, 1, 44100);
  }
  return decodeContext;
}

/** Builds an independent player. One per hook instance — never a module singleton. */
export function createSamplePlayer(): SamplePlayer {
  /** path -> in-flight or settled decode. Keyed by path so a repeat preload never re-fetches. */
  const loading = new Map<string, Promise<AudioBuffer | null>>();
  /** path -> decoded buffer (or null when it failed). Only written once settled. */
  const buffers = new Map<string, AudioBuffer | null>();

  let ctx: AudioContext | null = null;
  let voice: ActiveVoice | null = null;
  let disposed = false;

  /**
   * Fetch + decode one sample, memoised on its path. The returned promise never
   * rejects: a failure is warned once and cached as null, so a 404 can never
   * escape into play().
   */
  function loadSample(path: string): Promise<AudioBuffer | null> {
    const cached = loading.get(path);
    if (cached !== undefined) return cached;

    // Vite serves /public/* at the base URL. The app is hosted at /PitchQuest/,
    // so import.meta.env.BASE_URL keeps this correct in dev ("/") and prod.
    const url = `${import.meta.env.BASE_URL}${path}`;

    const pending = (async (): Promise<AudioBuffer | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const bytes = await response.arrayBuffer();
        return await getDecodeContext().decodeAudioData(bytes);
      } catch (err) {
        console.warn('sound: failed to load', url, err);
        return null;
      }
    })();

    pending.then((buffer) => {
      // Skip a late settle on a disposed player so its cleared caches stay clear.
      if (!disposed) buffers.set(path, buffer);
    });

    loading.set(path, pending);
    return pending;
  }

  async function preload(instrument: InstrumentId): Promise<void> {
    if (disposed) return;
    const samples = INSTRUMENT_SOUNDS[instrument].samples;
    try {
      await Promise.all(samples.map((sample) => loadSample(sample.path)));
    } catch {
      // loadSample swallows its own errors; this is belt-and-braces so that
      // preload() can never reject into a caller's effect.
    }
  }

  /**
   * Fade the current voice out over STEAL_FADE_SEC and stop it shortly after.
   * Mashing the submit key would otherwise stack slices into mush; the short
   * ramp keeps the cut click-free.
   */
  function stopAll(): void {
    const current = voice;
    if (current === null) return;
    voice = null;
    try {
      const now = current.gain.context.currentTime;
      current.gain.gain.cancelScheduledValues(now);
      current.gain.gain.setValueAtTime(current.gain.gain.value, now);
      current.gain.gain.linearRampToValueAtTime(0, now + STEAL_FADE_SEC);
      current.src.stop(now + STEAL_STOP_SEC);
    } catch {
      // Already ended or the context is closed: nothing left to fade out.
    }
  }

  function play(instrument: InstrumentId, writtenNote: string): boolean {
    if (disposed) return false;

    const selected = choiceForWrittenNote(writtenNote, instrument);
    if (selected === null) return false;
    const { choice } = selected;

    const path = choice.sample.path;
    const buffer = buffers.get(path);
    if (buffer === undefined) {
      // Not decoded yet (or missing entirely) — silent no-op, but start the
      // load so the next attempt is ready. loadSample never rejects.
      void loadSample(path);
      return false;
    }
    if (buffer === null) return false;

    // Created here, not at module scope: play() only runs from a keydown
    // gesture, which is what browsers require to unlock audio.
    if (ctx === null) {
      ctx = new AudioContext();
    }
    const live = ctx;
    if (live.state === 'suspended') {
      void live.resume();
    }

    const config = INSTRUMENT_SOUNDS[instrument];

    // Monophonic: one active voice, faded out before the next one starts.
    stopAll();

    const src = live.createBufferSource();
    const gain = live.createGain();
    src.buffer = buffer;
    // Pitch is the ONLY shift applied. The source's speed must stay at its
    // default: it multiplies with detune and would double-apply the shift.
    src.detune.value = choice.cents;
    src.connect(gain);
    gain.connect(live.destination);

    const envelope = config.envelope;
    const t0 = live.currentTime + START_DELAY_SEC;
    const t1 = t0 + envelope.attackSec;
    const t2 = t1 + envelope.holdSec;
    const t3 = t2 + envelope.releaseSec;

    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(config.gain, t1);
    gain.gain.setValueAtTime(config.gain, t2);
    gain.gain.linearRampToValueAtTime(0, t3);

    const started: ActiveVoice = { src, gain };
    voice = started;
    src.onended = () => {
      if (voice === started) voice = null;
      try {
        src.disconnect();
        gain.disconnect();
      } catch {
        // Disconnected already, or the context was closed underneath us.
      }
    };

    src.start(t0);
    src.stop(t3 + END_GRACE_SEC);
    return true;
  }

  function dispose(): void {
    if (disposed) return;
    stopAll();
    disposed = true;

    const live = ctx;
    ctx = null;
    if (live !== null) {
      // close() rejects if the context is already closed; swallow it. The
      // module-scoped decode context is untouched and stays reusable.
      void live.close().catch(() => {});
    }

    loading.clear();
    buffers.clear();
  }

  return { preload, play, stopAll, dispose };
}
