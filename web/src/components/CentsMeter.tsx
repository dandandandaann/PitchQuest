import React from 'react';

interface CentsMeterProps {
    cents: number | null;
}

export const CentsMeter: React.FC<CentsMeterProps> = ({ cents }) => {
    const isPlaying = cents !== null;
    const rotation = isPlaying ? (cents * 1.8) : 0; // -50 to +50 cents maps to -90 to +90 degrees

    return (
        <div style={{ width: '300px', margin: '0 auto', position: 'relative' }}>
            <div style={{
                height: '150px',
                overflow: 'hidden',
                borderBottom: '2px solid #ccc',
                position: 'relative'
            }}>
                {/* Scale */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    width: '4px',
                    height: '20px',
                    backgroundColor: '#4caf50',
                    transform: 'translateX(-50%)'
                }} />

                {/* Needle */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    width: '2px',
                    height: '140px',
                    backgroundColor: isPlaying ? '#f44336' : '#ccc',
                    transformOrigin: 'bottom center',
                    transform: `translateX(-50%) rotate(${rotation}deg)`,
                    transition: 'transform 0.05s ease-out'
                }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '0.8rem', color: '#888' }}>
                <span>Flat (-50)</span>
                <span>In Tune</span>
                <span>Sharp (+50)</span>
            </div>
            <div style={{height: '1em'}}>
                {isPlaying && (
                    <div style={{ textAlign: 'center', fontWeight: 'bold', color: Math.abs(cents) < 10 ? '#4caf50' : '#f44336' }}>
                        {cents > 0 ? '+' : ''}{cents} cents
                    </div>
                )}
            </div>
        </div>
    );
};
