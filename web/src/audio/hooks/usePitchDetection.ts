import { useState, useEffect, useRef } from 'react';
import { PitchDetector } from 'pitchy';
import { frequencyToNote } from '../utils/pitch-math';
import { MedianFilter, MovingAverage } from '../utils/smoothing';

export interface PitchData {
  frequency: number;
  clarity: number;
  noteName: string;
  cents: number;
}

interface UsePitchDetectionOptions {
  audioContext: AudioContext | null;
  transposeOffset?: number;
  holdDuration?: number; // ms, default 500
}

export function usePitchDetection({ audioContext, transposeOffset = 0, holdDuration = 500 }: UsePitchDetectionOptions) {
  const [pitchData, setPitchData] = useState<PitchData | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const medianFilter = useRef(new MedianFilter(5));
  const centsAverage = useRef(new MovingAverage(3));
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep ref in sync with holdDuration so messageHandler always uses current value
  const holdDurationRef = useRef(holdDuration);
  holdDurationRef.current = holdDuration;

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

        if (clarity > 0.9 && freq > 80 && freq < 1500) {
          if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
            holdTimeoutRef.current = null;
          }
          const filteredFreq = medianFilter.current.add(freq);
          const { noteName, cents } = frequencyToNote(filteredFreq, transposeOffset);
          const smoothedCents = Math.round(centsAverage.current.add(cents));

          if (isMounted) {
            setPitchData({
              frequency: filteredFreq,
              clarity,
              noteName,
              cents: smoothedCents
            });
          }
        } else {
          if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
          }
          holdTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              setPitchData(null);
            }
          }, holdDurationRef.current);
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

      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }

      if (nodeRef.current) {
        try {
          nodeRef.current.port.onmessage = null;
          nodeRef.current.disconnect();
        } catch (e) {
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
