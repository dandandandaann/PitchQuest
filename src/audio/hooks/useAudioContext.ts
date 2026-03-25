import { useState, useCallback, useRef } from 'react';

export function useAudioContext() {
  const [isStarted, setIsStarted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    setIsStarted(true);
    return audioContextRef.current;
  }, []);

  const stopAudio = useCallback(async () => {
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
      setIsStarted(false);
    }
  }, []);

  return { isStarted, startAudio, stopAudio, audioContext: audioContextRef.current };
}
