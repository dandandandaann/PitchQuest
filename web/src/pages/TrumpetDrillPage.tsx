import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useT } from '../i18n/I18nContext';
import { useInstrumentSound } from '../sound/useInstrumentSound';
import KeyboardRounded from '@mui/icons-material/KeyboardRounded';
import MusicNoteRounded from '@mui/icons-material/MusicNoteRounded';
import GraphicEqRounded from '@mui/icons-material/GraphicEqRounded';

const FILTER_STORAGE_KEY = 'pq.trumpetDrill.filter';
const HIDE_NAME_STORAGE_KEY = 'pq.trumpetDrill.hideNoteName';
const HIDE_STATUS_STORAGE_KEY = 'pq.trumpetDrill.hideStatus';
const MUTE_STORAGE_KEY = 'pq.trumpetDrill.mute';
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

function loadMute(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
}

function saveMute(mute: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MUTE_STORAGE_KEY, mute ? 'true' : 'false');
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
 * Render the lede with the key tokens (J, K, L, Space/Espaço) bolded, matching
 * the original hardcoded markup. Splitting is safe in both locales as long as
 * the translated copy keeps those literal tokens. The PT (pt-BR) copy uses
 * "Espaço", so both the EN and PT tokens are matched here.
 */
const LEDE_STRONG_TOKENS = new Set(['J', 'K', 'L', 'Space', 'Espaço']);

function LedeText({ text }: { text: string }) {
  const parts = text.split(/(J|K|L|Space|Espaço)/g);
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

    // Match .drill-staff__svg in pages.css (340 × 220).
    const WIDTH = 340;
    const HEIGHT = 220;

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

  // Instrument sound. The mute flag is persisted like the other view toggles;
  // `play` is referentially stable, so `submitAnswer` below keeps its identity
  // across mute flips and the keydown listener can still be registered once.
  const [muted, setMuted] = useState<boolean>(loadMute);
  useEffect(() => {
    saveMute(muted);
  }, [muted]);
  const { play: playNoteSound } = useInstrumentSound('trumpet', { enabled: !muted });

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

  /**
   * The ONE success path: Space and the future on-screen submit button both
   * call this, so both sound the note and advance. Reads every mutable input
   * from a ref, so it never reads stale state and stays stable.
   */
  const submitAnswer = useCallback((): void => {
    const required = getRequiredPistons(currentNoteRef.current);
    if (required && pistonsMatch(heldRef.current, required)) {
      if (startedAtRef.current === null) startedAtRef.current = performance.now();
      setSuccessCount(c => c + 1);
      // Capture BEFORE overwriting: the sound is for the note just answered.
      const answeredNote = currentNoteRef.current;
      const nextNote = randomNote(filterRef.current).note; // repeats allowed
      currentNoteRef.current = nextNote;
      setCurrentNote(nextNote);
      // WRITTEN note name — the Bb transposition lives in the sound module.
      playNoteSound(answeredNote);
    } else {
      // Failed check counts as a wrong note but never starts the timer.
      setWrongCount(c => c + 1);
    }
  }, [playNoteSound]);

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
        submitAnswer();
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
  }, [submitAnswer]);

  return (
    <div className="pq-page">
      {/* ═ HEADER BLOCK ════════════════════════════════════════════════════ */}
      <header className="pq-header">
        <div className="pq-header__text">
          <span className="clay-eyebrow">{t('trumpet.header.eyebrow')}</span>
          <h1 className="clay-title clay-title--h1">{t('trumpet.header.title')}</h1>
          <p className="clay-lede">
            <LedeText text={t('trumpet.header.lede')} />
          </p>
        </div>
        <span className="clay-badge clay-badge--white">
          <KeyboardRounded sx={{ fontSize: 15 }} />
          {t('trumpet.header.badge')}
        </span>
      </header>

      {/* ═ NOTE FILTER ════════════════════════════════════════════════════ */}
      <section className="clay-card drill-filter" aria-labelledby="drill-filter-title">
        <h2 id="drill-filter-title" className="clay-title clay-title--h3">
          {t('trumpet.filter.title')}
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
          aria-label={t('trumpet.filter.aria')}
        >
          <ToggleButton value="all" aria-label={t('trumpet.filter.all_aria')}>
            {t('trumpet.filter.all')}
          </ToggleButton>
          <ToggleButton value="sharps" aria-label={t('trumpet.filter.sharps_aria')}>
            {t('trumpet.filter.sharps')}
          </ToggleButton>
          <ToggleButton value="flats" aria-label={t('trumpet.filter.flats_aria')}>
            {t('trumpet.filter.flats')}
          </ToggleButton>
          <ToggleButton value="naturals" aria-label={t('trumpet.filter.naturals_aria')}>
            {t('trumpet.filter.naturals')}
          </ToggleButton>
        </ToggleButtonGroup>
        <div className="drill-filter__toggles">
          <FormControlLabel
            control={
              <Switch
                checked={muted}
                onChange={event => setMuted(event.target.checked)}
                size="small"
                inputProps={{ 'aria-label': t('trumpet.filter.mute_aria') }}
              />
            }
            label={t('trumpet.filter.mute')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={hideNoteName}
                onChange={event => setHideNoteName(event.target.checked)}
                size="small"
                inputProps={{ 'aria-label': t('trumpet.filter.hide_names_aria') }}
              />
            }
            label={t('trumpet.filter.hide_names')}
          />
        </div>
      </section>

      {/* ═ THE DRILL ══════════════════════════════════════════════════════ */}
      <section className="clay-card clay-card--feature drill-stage" aria-labelledby="drill-stage-title">
        <h2 id="drill-stage-title" className="clay-visually-hidden">
          {t('trumpet.stage.title')}
        </h2>

        <div className="drill-stage__grid">
          {/* Staff + note name */}
          <div className="drill-staff clay-well">
            <span className="clay-eyebrow">
              <MusicNoteRounded sx={{ fontSize: 15 }} />
              {t('trumpet.stage.play_this')}
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

            <div className="drill-valves" aria-label={t('trumpet.valves.aria')}>
              {([1, 2, 3] as const).map(id => {
                const down = heldPistonIds.has(id);
                return (
                  <span
                    key={id}
                    className={`clay-chip drill-valve${down ? ' drill-valve--down' : ''}`}
                    aria-label={t(down ? 'trumpet.valve.held' : 'trumpet.valve.released').replace('{id}', String(id))}
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
            <kbd className="kbd">J</kbd> {t('trumpet.legend.valve1')}
          </span>
          <span className="drill-legend__item">
            <kbd className="kbd">K</kbd> {t('trumpet.legend.valve2')}
          </span>
          <span className="drill-legend__item">
            <kbd className="kbd">L</kbd> {t('trumpet.legend.valve3')}
          </span>
          <span className="drill-legend__item">
            <kbd className="kbd">Space</kbd>
            <span className="clay-visually-hidden">{t('trumpet.legend.space_key_name')}</span> {t('trumpet.legend.space')}
          </span>
        </div>
      </section>

      {/* ═ SESSION STATUS ═════════════════════════════════════════════════ */}
      <section className="clay-card drill-status" aria-labelledby="drill-status-title">
        <div className="drill-status__header">
          <h2 id="drill-status-title" className="clay-title clay-title--h3">
            {t('trumpet.status.title')}
          </h2>
          <FormControlLabel
            control={
              <Switch
                checked={hideStatus}
                onChange={event => setHideStatus(event.target.checked)}
                size="small"
                inputProps={{ 'aria-label': t('trumpet.status.hide_aria') }}
              />
            }
            label={t('trumpet.status.hide')}
          />
        </div>
        <div className="drill-status__metrics">
          <div className="clay-well drill-status__metric">
            <span className="drill-status__value">
              {hideStatus ? <span className="clay-visually-hidden">{formatMmSs(elapsedSec)}</span> : formatMmSs(elapsedSec)}
              {hideStatus && <span aria-hidden="true">—</span>}
            </span>
            <span className="drill-status__label">{t('trumpet.status.time')}</span>
          </div>
          <div className="clay-well drill-status__metric">
            <span className="drill-status__value">
              {hideStatus ? <span className="clay-visually-hidden">{notesPerMin(successCount, elapsedSec)}</span> : notesPerMin(successCount, elapsedSec)}
              {hideStatus && <span aria-hidden="true">—</span>}
            </span>
            <span className="drill-status__label">{t('trumpet.status.notes_per_min')}</span>
          </div>
          <div className="clay-well drill-status__metric">
            <span className="drill-status__value">
              {hideStatus ? <span className="clay-visually-hidden">{successCount}</span> : successCount}
              {hideStatus && <span aria-hidden="true">—</span>}
            </span>
            <span className="drill-status__label">{t('trumpet.status.success')}</span>
          </div>
          <div className="clay-well drill-status__metric">
            <span className="drill-status__value">
              {hideStatus ? <span className="clay-visually-hidden">{wrongCount}</span> : wrongCount}
              {hideStatus && <span aria-hidden="true">—</span>}
            </span>
            <span className="drill-status__label">{t('trumpet.status.wrong')}</span>
          </div>
        </div>
      </section>

      {/* ══ TIP ════════════════════════════════════════════════════════════ */}
      <footer className="clay-card drill-foot">
        <span className="clay-eyebrow">
          <GraphicEqRounded sx={{ fontSize: 15 }} />
          {t('trumpet.tip.eyebrow')}
        </span>
        <p className="clay-text">{t('trumpet.tip.body')}</p>
      </footer>
    </div>
  );
}