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

export function usePitchDetection(audioContext: AudioContext | null) {
  const [pitchData, setPitchData] = useState<PitchData | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const medianFilter = useRef(new MedianFilter(5));
  const centsAverage = useRef(new MovingAverage(3));

  useEffect(() => {
    if (!audioContext) return;

    const setup = async () => {
      // Load the processor. We'll put it in public/ for now to ensure Vite serves it directly.
      await audioContext.audioWorklet.addModule('/pitch-processor.js');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const source = audioContext.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(audioContext, 'pitch-processor');
      nodeRef.current = node;

      const detector = PitchDetector.forFloat32Array(2048);
      
      node.port.onmessage = (event) => {
        const buffer = event.data;
        const [freq, clarity] = detector.findPitch(buffer, audioContext.sampleRate);
        
        if (clarity > 0.9 && freq > 80 && freq < 1500) {
          const filteredFreq = medianFilter.current.add(freq);
          const { noteName, cents } = frequencyToNote(filteredFreq);
          const smoothedCents = Math.round(centsAverage.current.add(cents));
          
          setPitchData({ 
            frequency: filteredFreq, 
            clarity, 
            noteName, 
            cents: smoothedCents 
          });
        } else {
          setPitchData(null);
        }
      };

      source.connect(node);
      node.connect(audioContext.destination);
    };

    setup();

    return () => {
      if (nodeRef.current) nodeRef.current.disconnect();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [audioContext]);

  return pitchData;
}
