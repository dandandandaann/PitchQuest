import React from 'react';

interface PitchDisplayProps {
  noteName: string | null;
  frequency: number | null;
}

export const PitchDisplay: React.FC<PitchDisplayProps> = ({ noteName, frequency }) => {
  return (
    <div style={{ textAlign: 'center', margin: '2rem' }}>
      <h1 style={{ fontSize: '6rem', margin: 0, minHeight: '.6em' }}>
        {noteName || '--'}
      </h1>
      <p style={{ fontSize: '1.5rem', color: '#666' }}>
        {frequency ? `${frequency.toFixed(1)} Hz` : 'No sound detected'}
      </p>
    </div>
  );
};
