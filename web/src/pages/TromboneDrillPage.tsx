import { useEffect, useRef, useState } from 'react';
import { FormControlLabel, Switch, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Renderer, Stave, StaveNote, Accidental, Voice, Formatter } from 'vexflow';
import {
  type PositionId,
  positionMatches,
  getRequiredPosition,
  randomNote,
  type NoteFilter,
} from '../trombone/positions';
import { TromboneDisplay } from '../components/TromboneDisplay';
import { SlideControl } from '../components/SlideControl';
import { useT } from '../i18n/I18nContext';
import SwipeRightRounded from '@mui/icons-material/SwipeRightRounded';
import MusicNoteRounded from '@mui/icons-material/MusicNoteRounded';
import GraphicEqRounded from '@mui/icons-material/GraphicEqRounded';

const FILTER_STORAGE_KEY = 'pq.tromboneDrill.filter';
const HIDE_NAME_STORAGE_KEY = 'pq.tromboneDrill.hideNoteName';
const HIDE_STATUS_STORAGE_KEY = 'pq.tromboneDrill.hideStatus';
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

function loadHideStatus(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(HIDE_STATUS_STORAGE_KEY) === 'true';
}

function saveHideStatus(hide: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HIDE_STATUS_STORAGE_KEY, hide ? 'true' : 'false');
}

/** Format seconds as m:ss (e.g. 0:07, 12:05). */
function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Cumulative notes-per-minute; guarded to 0.0 before the timer starts. */
function notesPerMin(successCount: number, elapsedSec: number): string {
  if (elapsedSec <= 0) return '0.0';
  return ((successCount / elapsedSec) * 60).toFixed(1);
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

/**
 * Render the lede with the key token (Space/Espaço) bolded, matching the
 * original hardcoded markup. Splitting is safe in both locales as long as the
 * translated copy keeps those literal tokens. The PT (pt-BR) copy uses
 * "Espaço", so both the EN and PT tokens are matched here.
 */
const LEDE_STRONG_TOKENS = new Set(['Space', 'Espaço']);

function LedeText({ text }: { text: string }) {
  const parts = text.split(/(Space|Espaço)/g);
  return (
    <>
      {parts.map((part, i) =>
        LEDE_STRONG_TOKENS.has(part) ? <strong key={i}>{part}</strong> : part,
      )}
    </>
  );
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
    stave.addClef('bass');
    stave.setContext(context).draw();
    stave.setStyle({ strokeStyle: INK, fillStyle: INK });

    // Whole note, no stem/flag clutter — single note, "one note at a time" semantics.
    const staveNote = new StaveNote({
      keys: [noteToVexFlowKey(note)],
      duration: 'w',
      clef: 'bass',
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

export function TromboneDrillPage() {
  const t = useT();
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

  // Session status: timer + counters start on the first successful note. All live in
  // component state only — no session persistence, reset on unmount/page leave.
  const [hideStatus, setHideStatus] = useState<boolean>(loadHideStatus);
  useEffect(() => {
    saveHideStatus(hideStatus);
  }, [hideStatus]);

  const [successCount, setSuccessCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  // 500ms ticker for smooth mm:ss rollover. Runs regardless of hideStatus so
  // counting continues while the values are hidden. No-op until first success.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedSec(Math.floor((performance.now() - startedAtRef.current) / 1000));
      }
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  // Held slide position (1–7). The slide is mutually exclusive — exactly one
  // position at a time, unlike the trumpet's valve combination set.
  const [heldPosition, setHeldPosition] = useState<PositionId>(1);

  // Latest-value refs so the key handler below (mounted once, empty deps) never
  // reads stale state when checking SPACE against the current note + held position.
  const currentNoteRef = useRef(currentNote);
  const heldPositionRef = useRef(heldPosition);

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

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event)) return;
      if (event.repeat) return; // prevent SPACE auto-repeat from cycling notes
      if (event.key !== ' ') return;

      event.preventDefault(); // Space scrolls the page
      const required = getRequiredPosition(currentNoteRef.current);
      if (required && positionMatches(heldPositionRef.current, required)) {
        if (startedAtRef.current === null) startedAtRef.current = performance.now();
        setSuccessCount(c => c + 1);
        const nextNote = randomNote(filterRef.current).note; // repeats allowed
        currentNoteRef.current = nextNote;
        setCurrentNote(nextNote);
      } else {
        // Failed check counts as a wrong note but never starts the timer.
        setWrongCount(c => c + 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="pq-page">
      {/* ═ HEADER BLOCK ═══════════════════════════════════════════════════ */}
      <header className="pq-header">
        <div className="pq-header__text">
          <span className="clay-eyebrow">{t('trombone.header.eyebrow')}</span>
          <h1 className="clay-title clay-title--h1">{t('trombone.header.title')}</h1>
          <p className="clay-lede">
            <LedeText text={t('trombone.header.lede')} />
          </p>
        </div>
        <span className="clay-badge clay-badge--white">
          <SwipeRightRounded sx={{ fontSize: 15 }} />
          {t('trombone.header.badge')}
        </span>
      </header>

      {/* ═ NOTE FILTER ════════════════════════════════════════════════════ */}
      <section className="clay-card drill-filter" aria-labelledby="drill-filter-title">
        <h2 id="drill-filter-title" className="clay-title clay-title--h3">
          {t('trombone.filter.title')}
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
          aria-label={t('trombone.filter.aria')}
        >
          <ToggleButton value="all" aria-label={t('trombone.filter.all_aria')}>
            {t('trombone.filter.all')}
          </ToggleButton>
          <ToggleButton value="sharps" aria-label={t('trombone.filter.sharps_aria')}>
            {t('trombone.filter.sharps')}
          </ToggleButton>
          <ToggleButton value="flats" aria-label={t('trombone.filter.flats_aria')}>
            {t('trombone.filter.flats')}
          </ToggleButton>
          <ToggleButton value="naturals" aria-label={t('trombone.filter.naturals_aria')}>
            {t('trombone.filter.naturals')}
          </ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={
            <Switch
              checked={hideNoteName}
              onChange={event => setHideNoteName(event.target.checked)}
              size="small"
              inputProps={{ 'aria-label': t('trombone.filter.hide_names_aria') }}
            />
          }
          label={t('trombone.filter.hide_names')}
        />
      </section>

      {/* ═ THE DRILL ══════════════════════════════════════════════════════ */}
      <section className="clay-card clay-card--feature drill-stage" aria-labelledby="drill-stage-title">
        <h2 id="drill-stage-title" className="clay-visually-hidden">
          {t('trombone.stage.title')}
        </h2>

        <div className="drill-stage__grid">
          {/* Staff + note name */}
          <div className="drill-staff clay-well">
            <span className="clay-eyebrow">
              <MusicNoteRounded sx={{ fontSize: 15 }} />
              {t('trombone.stage.play_this')}
            </span>
            <NoteStaff note={currentNote} />
            <p className="drill-staff__name" aria-live="polite">
              {hideNoteName ? <span className="clay-visually-hidden">{currentNote}</span> : currentNote}
            </p>
          </div>

          {/* Trombone + slide control + held position */}
          <div className="drill-side">
            <div className="clay-well drill-side__trumpet">
              <TromboneDisplay position={heldPosition} maxHeight={190} />
            </div>

            <SlideControl value={heldPosition} onChange={setHeldPosition} />

            <div className="drill-valves" aria-label={t('trombone.position.aria')}>
              {([1, 2, 3, 4, 5, 6, 7] as const).map(id => {
                const active = heldPosition === id;
                return (
                  <span
                    key={id}
                    className={`clay-chip drill-valve${active ? ' drill-valve--down' : ''}`}
                    aria-label={t('trombone.position.held').replace('{id}', String(id))}
                  >
                    {id}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Slide legend */}
        <div className="drill-legend">
          <span className="drill-legend__item">
            <SwipeRightRounded sx={{ fontSize: 18 }} />
            {t('trombone.legend.drag')}
          </span>
          <span className="drill-legend__item">
            <kbd className="kbd">
              <span className="clay-visually-hidden">{t('trombone.legend.space_key_name')}</span>
              ␣
            </kbd>
            {t('trombone.legend.space')}
          </span>
        </div>
      </section>

      {/* ═ SESSION STATUS ═════════════════════════════════════════════════ */}
      <section className="clay-card drill-status" aria-labelledby="drill-status-title">
        <div className="drill-status__header">
          <h2 id="drill-status-title" className="clay-title clay-title--h3">
            {t('trombone.status.title')}
          </h2>
          <FormControlLabel
            control={
              <Switch
                checked={hideStatus}
                onChange={event => setHideStatus(event.target.checked)}
                size="small"
                inputProps={{ 'aria-label': t('trombone.status.hide_aria') }}
              />
            }
            label={t('trombone.status.hide')}
          />
        </div>
        <div className="drill-status__metrics">
          <div className="clay-well drill-status__metric">
            <span className="drill-status__value">
              {hideStatus ? <span className="clay-visually-hidden">{formatMmSs(elapsedSec)}</span> : formatMmSs(elapsedSec)}
              {hideStatus && <span aria-hidden="true">—</span>}
            </span>
            <span className="drill-status__label">{t('trombone.status.time')}</span>
          </div>
          <div className="clay-well drill-status__metric">
            <span className="drill-status__value">
              {hideStatus ? <span className="clay-visually-hidden">{notesPerMin(successCount, elapsedSec)}</span> : notesPerMin(successCount, elapsedSec)}
              {hideStatus && <span aria-hidden="true">—</span>}
            </span>
            <span className="drill-status__label">{t('trombone.status.notes_per_min')}</span>
          </div>
          <div className="clay-well drill-status__metric">
            <span className="drill-status__value">
              {hideStatus ? <span className="clay-visually-hidden">{successCount}</span> : successCount}
              {hideStatus && <span aria-hidden="true">—</span>}
            </span>
            <span className="drill-status__label">{t('trombone.status.success')}</span>
          </div>
          <div className="clay-well drill-status__metric">
            <span className="drill-status__value">
              {hideStatus ? <span className="clay-visually-hidden">{wrongCount}</span> : wrongCount}
              {hideStatus && <span aria-hidden="true">—</span>}
            </span>
            <span className="drill-status__label">{t('trombone.status.wrong')}</span>
          </div>
        </div>
      </section>

      {/* ══ TIP ════════════════════════════════════════════════════════════ */}
      <footer className="clay-card drill-foot">
        <span className="clay-eyebrow">
          <GraphicEqRounded sx={{ fontSize: 15 }} />
          {t('trombone.tip.eyebrow')}
        </span>
        <p className="clay-text">{t('trombone.tip.body')}</p>
      </footer>
    </div>
  );
}
