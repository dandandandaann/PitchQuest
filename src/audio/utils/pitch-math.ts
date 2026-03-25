export const NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function frequencyToNote(frequency: number) {
  const midi = 12 * Math.log2(frequency / 440) + 69;
  const noteNum = Math.round(midi);
  const noteName = NOTES[noteNum % 12] + Math.floor(noteNum / 12 - 1);
  const cents = Math.floor(100 * (midi - noteNum));
  return { noteName, cents, midi };
}
