/**
 * NoteSegmenter — consumes a stream of `PitchData | null` frames (as emitted by
 * `usePitchDetection`) and emits finalized `DetectedNote` objects.
 *
 * v1 limitations (intentional, will be revisited in later tasks):
 *  - Legato runs (smooth glides between notes without silence gaps) may be
 *    merged into a single note if the cents jump stays under `pitchJumpCents`.
 *  - Very short notes (below `minNoteMs`) are dropped on finalize.
 *  - All thresholds are tuned by ear for a generic singing / instrument input
 *    stream and have not been empirically validated yet.
 */

import type { PitchData } from './hooks/usePitchDetection';
import { frequencyToNote } from './utils/pitch-math';
import type { DetectedNote } from './types';

export interface NoteSegmenterOptions {
  /** Cents distance between consecutive frames that counts as a new note. Default 80. */
  pitchJumpCents?: number;
  /** Silence gap (ms) that finalizes the current note. Default 75. */
  silenceGapMs?: number;
  /** Frames within this many ms of a note's start are ignored for jump detection. Default 50. */
  attackIgnoreMs?: number;
  /** Notes shorter than this on finalize are dropped. Default 80. */
  minNoteMs?: number;
}

interface CurrentNote {
  noteName: string;
  midi: number;
  startMs: number;
  centsSum: number;
  centsCount: number;
  attackDeadlineMs: number;
}

export class NoteSegmenter {
  private currentNote: CurrentNote | null = null;
  private lastTimestampMs: number | null = null;
  private readonly opts: Required<NoteSegmenterOptions>;

  constructor(opts: NoteSegmenterOptions = {}) {
    this.opts = {
      pitchJumpCents: opts.pitchJumpCents ?? 80,
      silenceGapMs: opts.silenceGapMs ?? 75,
      attackIgnoreMs: opts.attackIgnoreMs ?? 50,
      minNoteMs: opts.minNoteMs ?? 80,
    };
  }

  /**
   * Feed one frame from the pitch stream. Returns 0..N notes that were
   * finalized as a direct consequence of this frame.
   */
  push(frame: PitchData | null): DetectedNote[] {
    if (frame === null) {
      // A null frame has no timestamp of its own. The spec treats it as arriving
      // immediately after the previous frame, so the "gap since last frame"
      // measured by frame timestamps would be 0. To still detect a real silence
      // stretch, fall back to wall-clock time since the last seen timestamp.
      const wallGap =
        this.lastTimestampMs === null ? 0 : performance.now() - this.lastTimestampMs;
      return this.maybeFinalizeOnSilence(wallGap);
    }

    this.lastTimestampMs = frame.timestamp;

    if (this.currentNote === null) {
      this.startNote(frame);
      return [];
    }

    // Attack-ignore window: don't react to the first frames of a new note.
    if (frame.timestamp < this.currentNote.attackDeadlineMs) {
      return [];
    }

    const frameMidi = Math.round(frequencyToNote(frame.frequency).midi);
    const centsDistance = 100 * (frameMidi - this.currentNote.midi);
    if (Math.abs(centsDistance) > this.opts.pitchJumpCents) {
      const finalized = this.finalizeCurrent(frame.timestamp);
      this.startNote(frame);
      return finalized;
    }

    // Same note — accumulate cents for averaging.
    this.currentNote.centsSum += frame.cents;
    this.currentNote.centsCount += 1;
    return [];
  }

  /**
   * Call when the stream stops (e.g. mic unmount) to flush any in-flight note.
   */
  flush(): DetectedNote[] {
    if (this.currentNote === null) return [];
    const endTs =
      this.lastTimestampMs !== null ? this.lastTimestampMs : performance.now();
    return this.finalizeCurrent(endTs);
  }

  private startNote(frame: PitchData): void {
    // Derive midi from the frequency rather than parsing `frame.noteName`'s
    // octave string — `frequencyToNote().midi` is the precise integer we need.
    const midi = Math.round(frequencyToNote(frame.frequency).midi);
    this.currentNote = {
      noteName: frame.noteName,
      midi,
      startMs: frame.timestamp,
      centsSum: frame.cents,
      centsCount: 1,
      attackDeadlineMs: frame.timestamp + this.opts.attackIgnoreMs,
    };
  }

  private finalizeCurrent(endMs: number): DetectedNote[] {
    const note = this.currentNote;
    if (note === null) return [];
    const durationMs = endMs - note.startMs;
    this.currentNote = null;
    if (durationMs < this.opts.minNoteMs) return [];
    const avgCents = Math.round(note.centsSum / note.centsCount);
    return [
      {
        noteName: note.noteName,
        midi: note.midi,
        startMs: note.startMs,
        durationMs,
        avgCents,
      },
    ];
  }

  private maybeFinalizeOnSilence(wallGapMs: number): DetectedNote[] {
    if (this.currentNote === null) return [];
    if (wallGapMs <= this.opts.silenceGapMs) return [];
    const endTs = this.lastTimestampMs ?? performance.now();
    return this.finalizeCurrent(endTs);
  }
}
