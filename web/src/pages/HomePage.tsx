import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import GraphicEqRounded from '@mui/icons-material/GraphicEqRounded';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import MusicNoteRounded from '@mui/icons-material/MusicNoteRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { useT } from '../i18n/I18nContext';

/** Which `home.features.*` / `home.steps.*` translation group a card uses. */
type FeatureKey = 'tuner' | 'score' | 'drill';
type StepKey = 'pick' | 'mic' | 'play';

/** Static hero art: a miniature of the practice lane, in clay. */
function LanePreview() {
  const t = useT();
  return (
    <div className="pq-art" aria-hidden="true">
      <div className="pq-art__topline">
        <span className="clay-badge clay-badge--white">{t('home.lane_preview.song')}</span>
        <span className="clay-badge">{t('home.lane_preview.tempo').replace('{bpm}', '90')}</span>
      </div>

      <div className="pq-art__lane">
        <div className="pq-art__row pq-art__row--1">
          <span className="pq-art__block pq-art__block--perfect">E4</span>
          <span className="pq-art__block pq-art__block--perfect">E4</span>
          <span className="pq-art__block pq-art__block--ok">F4</span>
        </div>
        <div className="pq-art__row pq-art__row--2">
          <span className="pq-art__block pq-art__block--miss">G4</span>
          <span className="pq-art__block pq-art__block--active">G4</span>
        </div>
        <div className="pq-art__row pq-art__row--3">
          <span className="pq-art__block pq-art__block--upcoming">F4</span>
          <span className="pq-art__block pq-art__block--upcoming">E4</span>
          <span className="pq-art__block pq-art__block--upcoming">D4</span>
        </div>
        <span className="pq-art__nowline" />
      </div>

      <div className="pq-art__legend">
        <span className="pq-art__key">
          <i className="pq-art__dot pq-art__dot--perfect" /> {t('home.lane_preview.perfect')}
        </span>
        <span className="pq-art__key">
          <i className="pq-art__dot pq-art__dot--ok" /> {t('home.lane_preview.close')}
        </span>
        <span className="pq-art__key">
          <i className="pq-art__dot pq-art__dot--miss" /> {t('home.lane_preview.missed')}
        </span>
      </div>
    </div>
  );
}

/** Locale-independent feature-card shell; copy comes from `home.features.<key>.*`. */
const FEATURES: Array<{
  to: string;
  icon: ReactElement;
  tint: 'blue' | 'peach' | 'green';
  key: FeatureKey;
}> = [
  { to: '/tuner', icon: <GraphicEqRounded />, tint: 'blue', key: 'tuner' },
  { to: '/practice', icon: <SchoolRounded />, tint: 'peach', key: 'score' },
  { to: '/trumpet-drill', icon: <MusicNoteRounded />, tint: 'green', key: 'drill' },
];

/** Locale-independent step shell; copy comes from `home.steps.<key>.*`. */
const STEPS: Array<{ n: string; key: StepKey }> = [
  { n: '1', key: 'pick' },
  { n: '2', key: 'mic' },
  { n: '3', key: 'play' },
];

export function HomePage() {
  const t = useT();

  return (
    <div className="pq-page">
      {/* ═ HERO BLOCK ══════════════════════════════════════════════════════ */}
      <section className="clay-card clay-card--hero pq-hero" aria-labelledby="pq-hero-title">
        <div className="pq-hero__grid">
          <div className="pq-hero__copy">
            <span className="clay-badge clay-badge--white">
              <BoltRounded sx={{ fontSize: 15 }} />
              {t('home.hero.badge')}
            </span>

            <h1 id="pq-hero-title" className="clay-title clay-title--hero">
              {t('home.hero.title1')}
              <br />
              {t('home.hero.title2')}
            </h1>

            <p className="clay-lede">{t('home.hero.lede')}</p>

            <div className="pq-hero__actions">
              <Link className="clay-btn clay-btn--primary clay-btn--lg" to="/tuner">
                {t('home.hero.cta_tuner')}
              </Link>
              <Link className="clay-btn clay-btn--ghost clay-btn--lg" to="/practice">
                {t('home.hero.cta_score')}
                <ArrowForwardRounded sx={{ fontSize: 20 }} />
              </Link>
            </div>

            <dl className="pq-statrow">
              <div className="pq-stat">
                <dt>{t('home.stats.ondevice.label')}</dt>
                <dd>{t('home.stats.ondevice.value')}</dd>
              </div>
              <div className="pq-stat">
                <dt>{t('home.stats.modes.label')}</dt>
                <dd>{t('home.stats.modes.value')}</dd>
              </div>
              <div className="pq-stat">
                <dt>{t('home.stats.cents.label')}</dt>
                <dd>{t('home.stats.cents.value')}</dd>
              </div>
            </dl>
          </div>

          <div className="pq-hero__art">
            <LanePreview />
          </div>
        </div>
      </section>

      {/* ═ FEATURE BLOCKS ══════════════════════════════════════════════════ */}
      <section aria-labelledby="pq-features-title">
        <div className="pq-section-head">
          <span className="clay-eyebrow">{t('home.features.eyebrow')}</span>
          <h2 id="pq-features-title" className="clay-title clay-title--h2">
            {t('home.features.title')}
          </h2>
        </div>

        <div className="clay-grid pq-feature-grid">
          {FEATURES.map(f => (
            <Link key={f.to} to={f.to} className={`clay-tile pq-feature pq-feature--${f.tint}`}>
              <span className={`clay-iconplate clay-iconplate--${f.tint} pq-feature__icon`}>{f.icon}</span>
              <h3 className="clay-title clay-title--h3 pq-feature__title">{t(`home.features.${f.key}.title`)}</h3>
              <p className="clay-text pq-feature__body">{t(`home.features.${f.key}.body`)}</p>
              <span className="pq-feature__cta">
                {t(`home.features.${f.key}.cta`)}
                <ArrowForwardRounded sx={{ fontSize: 18 }} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════════════════ */}
      <section aria-labelledby="pq-steps-title">
        <div className="pq-section-head">
          <span className="clay-eyebrow">{t('home.how.eyebrow')}</span>
          <h2 id="pq-steps-title" className="clay-title clay-title--h2">
            {t('home.how.title')}
          </h2>
        </div>

        <ol className="pq-steps">
          {STEPS.map(s => (
            <li key={s.n} className="clay-card pq-step">
              <span className="clay-stepnum">{s.n}</span>
              <h3 className="clay-title clay-title--h3">{t(`home.steps.${s.key}.title`)}</h3>
              <p className="clay-text">{t(`home.steps.${s.key}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ══ CLOSING CTA BLOCK ═══════════════════════════════════════════════ */}
      <section className="clay-card clay-card--feature pq-cta">
        <div className="pq-cta__copy">
          <span className="clay-eyebrow" style={{ color: 'var(--green-800)' }}>
            {t('home.cta.eyebrow')}
          </span>
          <h2 className="clay-title clay-title--h2">{t('home.cta.title')}</h2>
          <p className="clay-text clay-text--strong">{t('home.cta.body')}</p>
        </div>
        <div className="pq-cta__actions">
          <Link className="clay-btn clay-btn--lg" to="/tuner">
            {t('home.cta.tuner')}
          </Link>
          <Link className="clay-btn clay-btn--peach clay-btn--lg" to="/trumpet-drill">
            {t('home.cta.drill')}
          </Link>
        </div>
      </section>
    </div>
  );
}
