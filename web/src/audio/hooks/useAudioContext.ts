import { useState, useCallback, useRef } from 'react';

export function useAudioContext() {
  const [isStarted, setIsStarted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioStartPerfNow, setAudioStartPerfNow] = useState<number | null>(null);

  const startAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    // Capture the offset once per session — the moment the AudioContext is
    // running. This is the "beat 0" anchor for the whole take.
    setAudioStartPerfNow(performance.now());
    setIsStarted(true);
    return audioContextRef.current;
  }, []);

  const stopAudio = useCallback(async () => {
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioStartPerfNow(null);
    setIsStarted(false);
  }, []);

  return { isStarted, startAudio, stopAudio, audioContext: audioContextRef.current, audioStartPerfNow }; // eslint-disable-line react-hooks/refs
}
