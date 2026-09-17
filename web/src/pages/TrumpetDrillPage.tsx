import { useEffect, useMemo, useRef, useState } from 'react';
import { FormControlLabel, Switch, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Renderer, Stave, StaveNote, Accidental, Voice, Formatter } from 'vexflow';
import {
  KEY_TO_PISTON,
  type PistonKey,
  pistonsMatch,
  getRequiredPistons,
  randomNote,
  type NoteFilter,
} from '../trumpet/fingerings';
import { TrumpetDisplay } from '../components/TrumpetDisplay';

import KeyboardRounded from '@mui/icons-material/KeyboardRounded';
import MusicNoteRounded from '@mui/icons-material/MusicNoteRounded';
import GraphicEqRounded from '@mui/icons-material/GraphicEqRounded';

const FILTER_STORAGE_KEY = 'pq.trumpetDrill.filter';
const HIDE_NAME_STORAGE_KEY = 'pq.trumpetDrill.hideNoteName';
const VALID_FILTERS: readonly NoteFilter[] = ['all', 'sharps', 'flats', 'naturals'];

/** Ink colour, mirrored from styles/tokens.css (VexFlow needs a literal). */
const INK = '#33272A';

function loadFilter(): NoteFilter {
  if (typeof window === 'undefined') return 'all';
  const stored = window.localStorage.getItem(FILTER_STORAGE_KEY);
  return VALID_FILTERS.includes(stored as NoteFilter) ? (stored as NoteFilter) : 'all';
}

function saveFilter(filter: NoteFilter): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FILTER_STORAGE_KEY, filter);
}

function loadHideNoteName(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(HIDE_NAME_STORAGE_KEY) === 'true';
}

function saveHideNoteName(hide: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HIDE_NAME_STORAGE_KEY, hide ? 'true' : 'false');
}

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

    const WIDTH = 260;
    const HEIGHT = 170;

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(WIDTH, HEIGHT);
    const context = renderer.getContext();
    // Use a generic system font for any non-glyph text (VexFlow renders noteheads from its own font).
    context.setFont('Arial', 10);
    // Ink strokes/glyphs so the staff sits on the clay surface without a hard black.
    context.setStrokeStyle(INK);
    context.setFillStyle(INK);

    // Stave placed at x=10 y=30 (leaves room for the staff vertically in the container).
    const stave = new Stave(10, 30, WIDTH - 20);
    stave.addClef('treble');
    stave.setContext(context).draw();
    stave.setStyle({ strokeStyle: INK, fillStyle: INK });

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

  return <div ref={containerRef} className="drill-staff__svg" aria-hidden="true" />;
}

export function TrumpetDrillPage() {
  const [noteFilter, setNoteFilter] = useState<NoteFilter>(loadFilter);
  const filterRef = useRef(noteFilter);

  useEffect(() => {
    filterRef.current = noteFilter;
    saveFilter(noteFilter);
  }, [noteFilter]);

  const [currentNote, setCurrentNote] = useState<string>(() => randomNote(noteFilter).note);
  const [hideNoteName, setHideNoteName] = useState<boolean>(loadHideNoteName);

  useEffect(() => {
    saveHideNoteName(hideNoteName);
  }, [hideNoteName]);

  const [held, setHeld] = useState<ReadonlySet<PistonKey>>(() => new Set());

  // The display layer works in PistonId land (1/2/3) while keyboard logic stays in
  // PistonKey land (J/K/L) — convert only here, memoized on the held set.
  const heldPistonIds = useMemo(
    () => new Set([...held].map((k) => KEY_TO_PISTON[k])),
    [held],
  );

  // Latest-value refs so the key handlers below (mounted once, empty deps) never
  // read stale state when checking SPACE against the current note + held pistons.
  const currentNoteRef = useRef(currentNote);
  const heldRef = useRef(held);

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
          const nextNote = randomNote(filterRef.current).note; // repeats allowed
          currentNoteRef.current = nextNote;
          setCurrentNote(nextNote);
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
      }
      // No action for SPACE keyup.
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return (
    <div className="pq-page">
      {/* ═ HEADER BLOCK ════════════════════════════════════════════════════ */}
      <header className="pq-header">
        <div className="pq-header__text">
          <span className="clay-eyebrow">Drills</span>
          <h1 className="clay-title clay-title--h1">Trumpet fingering</h1>
          <p className="clay-lede">
            A note appears on the staff. Hold its valves with <strong>J</strong>, <strong>K</strong> and{' '}
            <strong>L</strong>, then tap <strong>Space</strong> to advance. Correct fingering only — the drill
            ignores anything else.
          </p>
        </div>
        <span className="clay-badge clay-badge--white">
          <KeyboardRounded sx={{ fontSize: 15 }} />
          Keyboard drill
        </span>
      </header>

      {/* ═ NOTE FILTER ════════════════════════════════════════════════════ */}
      <section className="clay-card drill-filter" aria-labelledby="drill-filter-title">
        <h2 id="drill-filter-title" className="clay-title clay-title--h3">
          Which accidentals?
        </h2>
        <ToggleButtonGroup
          value={noteFilter}
          exclusive
          onChange={(_event, next: NoteFilter | null) => {
            // MUI's exclusive group calls onChange with null if the user clicks the active button.
            // Ignore that — never go back to "no filter".
            if (next !== null) setNoteFilter(next);
          }}
          size="small"
          aria-label="Note filter"
        >
          <ToggleButton value="all" aria-label="All accidentals">
            All
          </ToggleButton>
          <ToggleButton value="sharps" aria-label="Sharps only">
            ♯ Sharps
          </ToggleButton>
          <ToggleButton value="flats" aria-label="Flats only">
            ♭ Flats
          </ToggleButton>
          <ToggleButton value="naturals" aria-label="Naturals only">
            ♮ Naturals
          </ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={
            <Switch
              checked={hideNoteName}
              onChange={event => setHideNoteName(event.target.checked)}
              size="small"
              inputProps={{ 'aria-label': 'Hide note names' }}
            />
          }
          label="Hide note names"
        />
      </section>

      {/* ═ THE DRILL ══════════════════════════════════════════════════════ */}
      <section className="clay-card clay-card--feature drill-stage" aria-labelledby="drill-stage-title">
        <h2 id="drill-stage-title" className="clay-visually-hidden">
          Current drill note
        </h2>

        <div className="drill-stage__grid">
          {/* Staff + note name */}
          <div className="drill-staff clay-well">
            <span className="clay-eyebrow">
              <MusicNoteRounded sx={{ fontSize: 15 }} />
              Play this note
            </span>
            <NoteStaff note={currentNote} />
            <p className="drill-staff__name" aria-live="polite">
              {hideNoteName ? <span className="clay-visually-hidden">{currentNote}</span> : currentNote}
            </p>
          </div>

          {/* Trumpet + held valves */}
          <div className="drill-side">
            <div className="clay-well drill-side__trumpet">
              <TrumpetDisplay held={heldPistonIds} maxHeight={240} />
            </div>

            <div className="drill-valves" aria-label="Valve state">
              {([1, 2, 3] as const).map(id => {
                const down = heldPistonIds.has(id);
                return (
                  <span
                    key={id}
                    className={`clay-chip drill-valve${down ? ' drill-valve--down' : ''}`}
                    aria-label={`Valve ${id} ${down ? 'held' : 'released'}`}
                  >
                    {id}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Keyboard legend */}
        <div className="drill-legend">
          <span className="drill-legend__item">
            <kbd className="kbd">J</kbd> valve 1
          </span>
          <span className="drill-legend__item">
            <kbd className="kbd">K</kbd> valve 2
          </span>
          <span className="drill-legend__item">
            <kbd className="kbd">L</kbd> valve 3
          </span>
          <span className="drill-legend__item">
            <kbd className="kbd">Space</kbd> check &amp; advance
          </span>
        </div>
      </section>

      {/* ══ TIP ════════════════════════════════════════════════════════════ */}
      <footer className="clay-card clay-card--sunk drill-foot">
        <span className="clay-eyebrow">
          <GraphicEqRounded sx={{ fontSize: 15 }} />
          Tip
        </span>
        <p className="clay-text">
          Nothing moves if the fingering is wrong — that silence is the feedback. Release a valve and try again: the
          same note stays on the staff.
        </p>
      </footer>
    </div>
  );
}