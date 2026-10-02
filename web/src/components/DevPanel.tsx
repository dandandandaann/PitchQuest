/**
 * DevPanel — the shared "developer" card with the live pure-function harness
 * results. Mounted ONLY by PracticePage (see `web/src/pages/PracticePage.tsx`).
 * Deliberately not mounted on TrumpetDrillPage or TromboneDrillPage by manager
 * decision — do not re-add those mounts without asking.
 *
 * Owns the collapsed/expanded state and the rendering of the two result shapes
 * returned by useDevPanelHarnesses (see that hook for the shapes). Collapsed
 * by default and visually inert, so the card adds no layout noise.
 */

import { useState } from 'react';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import { useDevPanelHarnesses } from '../audio/hooks/useDevPanelHarnesses';
import { useT } from '../i18n/I18nContext';

/** Aggregate shape returned by the audio/score harnesses. */
interface AggregateResult {
  pass: number;
  fail: number;
  details: { name: string; pass: boolean; diff?: string }[];
}

/** Flat case-list shape returned by the trumpet/trombone harnesses. */
interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

export function DevPanel() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const harnesses = useDevPanelHarnesses();
  const { segmenter, timing, musicXml, matcher, scorer, incrementalMatcher, valvePress, fingerings, positions } =
    harnesses;

  function renderSection(label: string, result: AggregateResult | null) {
    if (!result) return null;
    const total = result.pass + result.fail;
    const allPass = result.fail === 0;
    return (
      <div className="dev-section">
        <p className="dev-section__head">
          <span className={`clay-badge ${allPass ? 'clay-badge--green' : 'clay-badge--peach'}`}>
            {allPass ? <CheckCircleRounded sx={{ fontSize: 14 }} /> : <ErrorOutlineRounded sx={{ fontSize: 14 }} />}
            {t('dev.pass').replace('{pass}', String(result.pass)).replace('{total}', String(total))}
          </span>
          <span className="dev-section__label">{label}</span>
        </p>
        <ul className="dev-section__list">
          {result.details.map((d, i) => (
            <li key={i} className={`dev-case${d.pass ? '' : ' dev-case--fail'}`}>
              <span className="dev-case__name">{d.name}</span>
              {d.diff && <span className="dev-case__diff">{d.diff}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /**
   * Same chrome as renderSection, for harnesses that return a flat case list
   * instead of an aggregate. `detail` plays the role of `diff`: the panel only
   * shows it when the case fails, so a green section stays one line per case.
   */
  function renderCaseSection(label: string, cases: CaseResult[] | null) {
    if (!cases) return null;
    const pass = cases.filter(c => c.pass).length;
    const fail = cases.length - pass;
    const allPass = fail === 0;
    return (
      <div className="dev-section">
        <p className="dev-section__head">
          <span className={`clay-badge ${allPass ? 'clay-badge--green' : 'clay-badge--peach'}`}>
            {allPass ? <CheckCircleRounded sx={{ fontSize: 14 }} /> : <ErrorOutlineRounded sx={{ fontSize: 14 }} />}
            {t('dev.pass').replace('{pass}', String(pass)).replace('{total}', String(cases.length))}
          </span>
          <span className="dev-section__label">{label}</span>
        </p>
        <ul className="dev-section__list">
          {cases.map((c, i) => (
            <li key={i} className={`dev-case${c.pass ? '' : ' dev-case--fail'}`}>
              <span className="dev-case__name">{c.name}</span>
              {!c.pass && <span className="dev-case__diff">{c.detail}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className="clay-card dev-panel" aria-labelledby="dev-panel-title">
      <h2 id="dev-panel-title" className="clay-eyebrow">
        {t('dev.title')}
      </h2>
      <p className="clay-text dev-panel__lede">{t('dev.lede')}</p>
      <button
        type="button"
        className="clay-btn clay-btn--sm clay-btn--ghost"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="dev-panel-content"
      >
        {open ? t('dev.toggle_hide') : t('dev.toggle_show')}
      </button>

      {open && (
        <div id="dev-panel-content">
          <div className="dev-grid">
            {renderSection(t('dev.section.segmenter'), segmenter)}
            {renderSection(t('dev.section.timing'), timing)}
            {renderSection(t('dev.section.parser'), musicXml)}
            {renderSection(t('dev.section.matcher'), matcher)}
            {renderSection(t('dev.section.scorer'), scorer)}
            {renderSection(t('dev.section.incremental'), incrementalMatcher)}
            {renderCaseSection(t('dev.section.fingerings'), fingerings)}
            {renderCaseSection(t('dev.section.valve_press'), valvePress)}
            {renderCaseSection(t('dev.section.positions'), positions)}
          </div>
        </div>
      )}
    </section>
  );
}
