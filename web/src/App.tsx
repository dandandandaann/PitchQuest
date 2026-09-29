import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { SidebarLayout } from './components/SidebarLayout';
import { useT } from './i18n/I18nContext';
import { HomePage } from './pages/HomePage';
import { TunerPage } from './pages/TunerPage';
import { PracticePage } from './pages/PracticePage';
import { muiTheme } from './theme/muiTheme';
import './styles/tokens.css';

// VexFlow is ~500 kB — keep the drill route out of the initial bundle.
const TrumpetDrillPage = lazy(() =>
  import('./pages/TrumpetDrillPage').then(m => ({ default: m.TrumpetDrillPage })),
);
const TromboneDrillPage = lazy(() =>
  import('./pages/TromboneDrillPage').then(m => ({ default: m.TromboneDrillPage })),
);

/** Clay skeleton shown while a lazy route chunk downloads. */
function RouteFallback() {
  const t = useT();
  return (
    <div className="pq-page">
      <div className="clay-card" role="status" aria-live="polite">
        <span className="clay-eyebrow">{t('app.fallback.eyebrow')}</span>
        <p className="clay-text" style={{ marginTop: 'var(--sp-2)' }}>
          {t('app.fallback.body')}
        </p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <HashRouter>
        <Routes>
          <Route element={<SidebarLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/tuner" element={<TunerPage />} />
            <Route
              path="/trumpet-drill"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <TrumpetDrillPage />
                </Suspense>
              }
            />
            <Route
              path="/trombone-drill"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <TromboneDrillPage />
                </Suspense>
              }
            />
            {/* Redirect any other path to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;