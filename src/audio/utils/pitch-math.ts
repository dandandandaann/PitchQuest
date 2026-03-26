export const NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function frequencyToNote(frequency: number, transposeOffset: number = 0) {
  const midi = 12 * Math.log2(frequency / 440) + 69;
  const noteNum = Math.round(midi);
  
  // Apply transposition offset
  const transposedMidi = noteNum + transposeOffset;
  const octave = Math.floor(transposedMidi / 12 - 1);
  const noteIndex = ((transposedMidi % 12) + 12) % 12; // Handle negative values correctly
  
  const noteName = NOTES[noteIndex] + octave;
  const cents = Math.floor(100 * (midi - noteNum));
  return { noteName, cents, midi };
}
