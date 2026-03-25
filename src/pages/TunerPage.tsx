import { useAudioContext } from '../audio/hooks/useAudioContext';
import { usePitchDetection } from '../audio/hooks/usePitchDetection';
import { PitchDisplay } from '../components/PitchDisplay';
import { CentsMeter } from '../components/CentsMeter';
import '../App.css';

export function TunerPage() {
    const { isStarted, startAudio, stopAudio, audioContext } = useAudioContext();
    const pitchData = usePitchDetection(audioContext);

    return (
        <div className="TunerPage">
            <header>
                <h1>Tuner</h1>
                <p>Turn on your microphone</p>
            </header>

            <main>
                {!isStarted ? (
                    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                        <button
                            onClick={startAudio}
                            style={{ padding: '1rem 2rem', fontSize: '1.2rem', cursor: 'pointer' }}
                        >
                            Start Microphone
                        </button>
                    </div>
                ) : (
                    <div>
                        <PitchDisplay
                            noteName={pitchData?.noteName || null}
                            frequency={pitchData?.frequency || null}
                        />
                        <CentsMeter cents={pitchData?.cents ?? null} />

                        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                            <button onClick={stopAudio}>Stop Microphone</button>
                        </div>
                    </div>
                )}
            </main>

            <footer style={{ marginTop: '3rem', fontSize: '0.8rem', opacity: 0.6 }}>
                <p>Buffer: 2048 | Algorithm: YIN | Library: pitchy</p>
            </footer>
        </div>
    );
}
