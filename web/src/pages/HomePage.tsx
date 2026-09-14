import { Link } from 'react-router-dom';
import GraphicEqRounded from '@mui/icons-material/GraphicEqRounded';
import SchoolRounded from '@mui/icons-material/SchoolRounded';
import MusicNoteRounded from '@mui/icons-material/MusicNoteRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';

/** Static hero art: a miniature of the practice lane, in clay. */
function LanePreview() {
  return (
    <div className="pq-art" aria-hidden="true">
      <div className="pq-art__topline">
        <span className="clay-badge clay-badge--white">Ode to Joy</span>
        <span className="clay-badge">90 BPM</span>
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
          <i className="pq-art__dot pq-art__dot--perfect" /> Perfect
        </span>
        <span className="pq-art__key">
          <i className="pq-art__dot pq-art__dot--ok" /> Close
        </span>
        <span className="pq-art__key">
          <i className="pq-art__dot pq-art__dot--miss" /> Missed
        </span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    to: '/tuner',
    icon: <GraphicEqRounded />,
    tint: 'blue' as const,
    title: 'Tuner',
    body: 'Watch the needle settle. A big note readout, a cent meter, and an instrument-key selector for transposing horns.',
    cta: 'Open the tuner',
  },
  {
    to: '/practice',
    icon: <SchoolRounded />,
    tint: 'peach' as const,
    title: 'Score practice',
    body: 'Load a MusicXML piece, sing or play along, and watch each note light up green as it lands on the beat.',
    cta: 'Practise a score',
  },
  {
    to: '/trumpet-drill',
    icon: <MusicNoteRounded />,
    tint: 'green' as const,
    title: 'Trumpet drill',
    body: 'Random notes on a staff. Hold the right valves on J, K and L, then tap space to advance. Speed builds itself.',
    cta: 'Start drilling',
  },
];

const STEPS = [
  {
    n: '1',
    title: 'Pick a piece',
    body: 'Choose from the score library or drop in your own MusicXML file. Tempo is editable on the spot.',
  },
  {
    n: '2',
    title: 'Start the mic',
    body: 'Your audio is analysed on-device with the YIN algorithm — nothing is recorded, nothing is uploaded.',
  },
  {
    n: '3',
    title: 'Play the notes',
    body: 'Each note is measured for pitch and timing. Perfect, close or missed — then the score shows you the damage.',
  },
];

export function HomePage() {
  return (
    <div className="pq-page">
      {/* ═ HERO BLOCK ══════════════════════════════════════════════════════ */}
      <section className="clay-card clay-card--hero pq-hero" aria-labelledby="pq-hero-title">
        <div className="pq-hero__grid">
          <div className="pq-hero__copy">
            <span className="clay-badge clay-badge--white">
              <BoltRounded sx={{ fontSize: 15 }} />
              Clay-crafted pitch training
            </span>

            <h1 id="pq-hero-title" className="clay-title clay-title--hero">
              Hit the note.
              <br />
              Hold the streak.
            </h1>

            <p className="clay-lede">
              PitchQuest listens while you play, slices your sound into single notes, and scores every one of them for
              pitch and timing. A tuner, a score trainer and a trumpet drill — all under one roof.
            </p>

            <div className="pq-hero__actions">
              <Link className="clay-btn clay-btn--primary clay-btn--lg" to="/tuner">
                Start with the tuner
              </Link>
              <Link className="clay-btn clay-btn--ghost clay-btn--lg" to="/practice">
                Practise a score
                <ArrowForwardRounded sx={{ fontSize: 20 }} />
              </Link>
            </div>

            <dl className="pq-statrow">
              <div className="pq-stat">
                <dt>On-device</dt>
                <dd>Audio never leaves the browser</dd>
              </div>
              <div className="pq-stat">
                <dt>3 modes</dt>
                <dd>Tuner · score practice · drills</dd>
              </div>
              <div className="pq-stat">
                <dt>±25¢</dt>
                <dd>Perfect-pitch window, tunable</dd>
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
          <span className="clay-eyebrow">Three ways in</span>
          <h2 id="pq-features-title" className="clay-title clay-title--h2">
            Pick the room you want to practise in
          </h2>
        </div>

        <div className="clay-grid pq-feature-grid">
          {FEATURES.map(f => (
            <Link key={f.to} to={f.to} className={`clay-tile pq-feature pq-feature--${f.tint}`}>
              <span className={`clay-iconplate clay-iconplate--${f.tint} pq-feature__icon`}>{f.icon}</span>
              <h3 className="clay-title clay-title--h3 pq-feature__title">{f.title}</h3>
              <p className="clay-text pq-feature__body">{f.body}</p>
              <span className="pq-feature__cta">
                {f.cta}
                <ArrowForwardRounded sx={{ fontSize: 18 }} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════════════════ */}
      <section aria-labelledby="pq-steps-title">
        <div className="pq-section-head">
          <span className="clay-eyebrow">How it works</span>
          <h2 id="pq-steps-title" className="clay-title clay-title--h2">
            Three steps from silence to a score
          </h2>
        </div>

        <ol className="pq-steps">
          {STEPS.map(s => (
            <li key={s.n} className="clay-card pq-step">
              <span className="clay-stepnum">{s.n}</span>
              <h3 className="clay-title clay-title--h3">{s.title}</h3>
              <p className="clay-text">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ══ CLOSING CTA BLOCK ═══════════════════════════════════════════════ */}
      <section className="clay-card clay-card--feature pq-cta">
        <div className="pq-cta__copy">
          <span className="clay-eyebrow" style={{ color: 'var(--green-800)' }}>
            Ready when you are
          </span>
          <h2 className="clay-title clay-title--h2">Your first note is one click away</h2>
          <p className="clay-text clay-text--strong">
            No account, no download, no setup. Open the tuner, allow the microphone, and play.
          </p>
        </div>
        <div className="pq-cta__actions">
          <Link className="clay-btn clay-btn--lg" to="/tuner">
            Open the tuner
          </Link>
          <Link className="clay-btn clay-btn--peach clay-btn--lg" to="/trumpet-drill">
            Try a drill
          </Link>
        </div>
      </section>
    </div>
  );
}