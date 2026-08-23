import { useState, useEffect, useRef } from 'react';
import { PitchDetector } from 'pitchy';
import { frequencyToNote } from '../utils/pitch-math';
import { MedianFilter, MovingAverage } from '../utils/smoothing';

export interface PitchData {
  frequency: number;
  clarity: number;
  noteName: string;
  cents: number;
  timestamp: number; // ms, monotonic, from performance.now()
}

interface UsePitchDetectionOptions {
  audioContext: AudioContext | null;
  transposeOffset?: number;
}

const FILTER_RESET_GAP_MS = 150;

export function usePitchDetection({ audioContext, transposeOffset = 0 }: UsePitchDetectionOptions) {
  const [pitchData, setPitchData] = useState<PitchData | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const medianFilter = useRef(new MedianFilter(5));
  const centsAverage = useRef(new MovingAverage(3));
  // Tracks the timestamp of the last emitted sound frame, so we can detect
  // a silence gap long enough (>150ms) to reset filters across note boundaries.
  const lastSoundTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioContext) return;

    let isMounted = true;

    const setup = async () => {
      // Load the processor. We'll put it in public/ for now to ensure Vite serves it directly.
      const baseUrl = import.meta.env.BASE_URL || '/';
      await audioContext.audioWorklet.addModule(`${baseUrl}pitch-processor.js`);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(audioContext, 'pitch-processor');
      nodeRef.current = node;

      const detector = PitchDetector.forFloat32Array(2048);

      const messageHandler = (event: MessageEvent) => {
        if (!isMounted) return;

        const buffer = event.data;
        const [freq, clarity] = detector.findPitch(buffer, audioContext.sampleRate);

        // Capture timestamp once per frame so every emitted value uses the same instant.
        const ts = performance.now();

        if (clarity > 0.9 && freq > 80 && freq < 1500) {
          // Sound frame: optionally reset filters if silence gap exceeded threshold.
          const lastSoundTs = lastSoundTimestampRef.current;
          const gapSinceLastSound = lastSoundTs === null ? 0 : ts - lastSoundTs;
          if (gapSinceLastSound > FILTER_RESET_GAP_MS) {
            medianFilter.current = new MedianFilter(5);
            centsAverage.current = new MovingAverage(3);
          }
          lastSoundTimestampRef.current = ts;

          const filteredFreq = medianFilter.current.add(freq);
          const { noteName, cents } = frequencyToNote(filteredFreq, transposeOffset);
          const smoothedCents = Math.round(centsAverage.current.add(cents));

          if (isMounted) {
            setPitchData({
              frequency: filteredFreq,
              clarity,
              noteName,
              cents: smoothedCents,
              timestamp: ts
            });
          }
        } else {
          // Silence frame: emit null immediately. lastSoundTimestampRef is intentionally
          // NOT updated here so the next sound frame can compute gapSinceLastSound.
          if (isMounted) {
            setPitchData(null);
          }
        }
      };

      node.port.onmessage = messageHandler;
      source.connect(node);
      node.connect(audioContext.destination);
    };

    setup();

    // Cleanup function to prevent memory leaks and handler accumulation
    return () => {
      isMounted = false;

      if (nodeRef.current) {
        try {
          nodeRef.current.port.onmessage = null;
          nodeRef.current.disconnect();
        } catch {
          // Node may already be disconnected
        }
        nodeRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };

  }, [audioContext, transposeOffset]);

  return pitchData;
}
