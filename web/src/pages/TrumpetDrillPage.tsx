import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { Renderer, Stave, StaveNote, Accidental, Voice, Formatter } from 'vexflow';
import {
  KEY_TO_PISTON,
  type PistonId,
  type PistonKey,
  pistonsMatch,
  getRequiredPistons,
  randomNote,
} from '../trumpet/fingerings';

const ADVANCE_DELAY_MS = 200;

/**
 * Convert a written note name like "F#3" or "Bb4" or "C5" into a VexFlow key
 * string like "f#/3" or "bb/4" or "c/5".
 * VexFlow uses lowercase letters with # for sharp, b for flat, no suffix for natural.
 */
function noteToVexFlowKey(note: string): string {
  // Match: letter (A-G, possibly already uppercase), optional accidental (# or b), octave digit(s)
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(note);
  if (!m) throw new Error(`Unexpected note name: ${note}`);
  const [, letter, accidental, octave] = m;
  return `${letter.toLowerCase()}${accidental ?? ''}/${octave}`;
}

/** Map of accidentals for the explicit Accidental modifier (undefined = natural, no glyph needed). */
function accidentalFor(note: string): '#' | 'b' | undefined {
  if (note.includes('#')) return '#';
  if (note.includes('b')) return 'b';
  return undefined;
}

interface NoteStaffProps {
  note: string;
}

function NoteStaff({ note }: NoteStaffProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any prior SVG (re-renders on note change).
    container.innerHTML = '';

    const WIDTH = 240;
    const HEIGHT = 140;

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(WIDTH, HEIGHT);
    const context = renderer.getContext();
    // Use a generic system font for any non-glyph text (VexFlow renders noteheads from its own font).
    context.setFont('Arial', 10);

    // Stave placed at x=10 y=30 (leaves room for the staff vertically in the container).
    const stave = new Stave(10, 30, WIDTH - 20);
    stave.addClef('treble');
    stave.setContext(context).draw();

    // Whole note, no stem/flag clutter — single note, "one note at a time" semantics.
    const staveNote = new StaveNote({
      keys: [noteToVexFlowKey(note)],
      duration: 'w',
      clef: 'treble',
    });
    const acc = accidentalFor(note);
    if (acc) {
      staveNote.addModifier(new Accidental(acc), 0);
    }

    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.setStrict(false); // tolerate the single whole note
    voice.addTickables([staveNote]);

    new Formatter().joinVoices([voice]).format([voice], WIDTH - 80);
    voice.draw(context, stave);

    return () => {
      // Defensive: clear on cleanup so React 19 strict-mode double-invoke doesn't leak SVGs.
      if (container) container.innerHTML = '';
    };
  }, [note]);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: 240,
        height: 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
}

interface PistonIndicatorProps {
  keyHint: PistonKey;
  pressed: boolean;
}

function PistonIndicator({ keyHint, pressed }: PistonIndicatorProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      {/* Stacked button + casing */}
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Finger button — domed disc that depresses into the casing when pressed */}
        <Box
          sx={{
            width: 44,
            height: 18,
            borderRadius: '50%',
            background:
              'linear-gradient(180deg, #b0b0b0 0%, #e8e8e8 40%, #f8f8f8 60%, #c8c8c8 100%)',
            border: '1px solid rgba(0,0,0,0.35)',
            boxShadow: pressed ? '0 1px 2px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.3)',
            transform: pressed ? 'translateY(8px)' : 'translateY(0)',
            transition: 'transform 0.08s ease, box-shadow 0.08s ease',
            mb: '-2px', // slight overlap onto casing to read as one unit
          }}
        />
        {/* Casing — vertical metal cylinder (does not animate) */}
        <Box
          sx={{
            width: 60,
            height: 70,
            borderRadius: 2,
            background:
              'linear-gradient(180deg, #9a9a9a 0%, #d4d4d4 30%, #ededed 50%, #d4d4d4 70%, #8a8a8a 100%)',
            border: '1px solid rgba(0,0,0,0.25)',
            boxShadow:
              'inset 2px 0 4px rgba(0,0,0,0.15), inset -2px 0 4px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.3)',
          }}
        />
      </Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
        {keyHint}
      </Typography>
    </Box>
  );
}

export function TrumpetDrillPage() {
  const [currentNote, setCurrentNote] = useState<string>(() => randomNote().note);
  const [held, setHeld] = useState<ReadonlySet<PistonKey>>(() => new Set());

  // Latest-value refs so the key handlers below (mounted once, empty deps) never
  // read stale state when checking SPACE against the current note + held pistons.
  const currentNoteRef = useRef(currentNote);
  const heldRef = useRef(held);

  // Pending deferred note advance: timeout id + the required piston set captured
  // at SPACE press. Both are cleared if the held pistons stop matching mid-delay.
  const pendingAdvanceRef = useRef<number | null>(null);
  const pendingRequiredRef = useRef<readonly PistonId[] | null>(null);

  useEffect(() => {
    const isEditableTarget = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      return Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable),
      );
    };

    const setHeldKeys = (next: ReadonlySet<PistonKey>) => {
      heldRef.current = next;
      setHeld(next);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event)) return;
      if (event.repeat) return; // prevent SPACE auto-repeat from cycling notes

      const k = event.key.toUpperCase();

      if (k === 'J' || k === 'K' || k === 'L') {
        const next = new Set(heldRef.current);
        next.add(k);
        setHeldKeys(next);
        return;
      }

      if (k === ' ') {
        event.preventDefault(); // Space scrolls the page
        const required = getRequiredPistons(currentNoteRef.current);
        if (required && pistonsMatch(heldRef.current, required)) {
          // Already an advance pending? Ignore rapid manual SPACE re-presses.
          if (pendingAdvanceRef.current !== null) return;

          const nextNote = randomNote().note; // repeats allowed
          pendingRequiredRef.current = required;
          pendingAdvanceRef.current = window.setTimeout(() => {
            pendingAdvanceRef.current = null;
            pendingRequiredRef.current = null;
            currentNoteRef.current = nextNote;
            setCurrentNote(nextNote);
          }, ADVANCE_DELAY_MS);
        }
        // else: do nothing — no feedback, no state change
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isEditableTarget(event)) return;

      const k = event.key.toUpperCase();
      if (k === 'J' || k === 'K' || k === 'L') {
        const next = new Set(heldRef.current);
        next.delete(k);
        setHeldKeys(next);

        // If a deferred advance is pending and releasing this piston breaks the
        // required combination, cancel it — the note stays on screen.
        const pendingRequired = pendingRequiredRef.current;
        if (
          pendingAdvanceRef.current !== null &&
          pendingRequired &&
          !pistonsMatch(next, pendingRequired)
        ) {
          window.clearTimeout(pendingAdvanceRef.current);
          pendingAdvanceRef.current = null;
          pendingRequiredRef.current = null;
        }
      }
      // No action for SPACE keyup.
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (pendingAdvanceRef.current !== null) {
        window.clearTimeout(pendingAdvanceRef.current);
        pendingAdvanceRef.current = null;
        pendingRequiredRef.current = null;
      }
    };
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        gap: 4,
      }}
    >
      <Typography variant="h5">Trumpet Fingering Drill</Typography>
      <Typography color="text.secondary">
        Hold the correct pistons (J=1, K=2, L=3), then press SPACE to advance.
      </Typography>

      <Box sx={{ my: 6 }}>
        <NoteStaff note={currentNote} />
      </Box>

      <Box sx={{ display: 'flex', gap: 4 }}>
        {(Object.entries(KEY_TO_PISTON) as [PistonKey, 1 | 2 | 3][]).map(([k, id]) => (
          <PistonIndicator key={id} keyHint={k} pressed={held.has(k)} />
        ))}
      </Box>
    </Box>
  );
}
