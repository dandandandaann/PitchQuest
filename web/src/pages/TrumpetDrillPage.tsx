import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import {
  KEY_TO_PISTON,
  type PistonId,
  type PistonKey,
  pistonsMatch,
  getRequiredPistons,
  randomNote,
} from '../trumpet/fingerings';

const ADVANCE_DELAY_MS = 200;

interface PistonIndicatorProps {
  id: 1 | 2 | 3;
  keyHint: PistonKey;
  pressed: boolean;
}

function PistonIndicator({ id, keyHint, pressed }: PistonIndicatorProps) {
  return (
    <Box
      sx={{
        width: 72,
        height: 96,
        borderRadius: 2,
        border: '2px solid',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.1s ease',
        ...(pressed
          ? {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              transform: 'translateY(6px)',
              boxShadow: 'none',
            }
          : {
              bgcolor: 'background.paper',
              color: 'text.primary',
              boxShadow: 3,
            }),
      }}
    >
      <Typography variant="h4" component="div">
        {id}
      </Typography>
      <Typography variant="caption">{keyHint}</Typography>
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

      <Typography variant="h1" component="div" sx={{ fontWeight: 'bold', my: 6 }}>
        {currentNote}
      </Typography>

      <Box sx={{ display: 'flex', gap: 2 }}>
        {(Object.entries(KEY_TO_PISTON) as [PistonKey, 1 | 2 | 3][]).map(([k, id]) => (
          <PistonIndicator key={id} id={id} keyHint={k} pressed={held.has(k)} />
        ))}
      </Box>
    </Box>
  );
}
