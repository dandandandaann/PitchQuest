import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SidebarLayout } from './components/SidebarLayout';
import { HomePage } from './pages/HomePage';
import { TunerPage } from './pages/TunerPage';
import { PracticePage } from './pages/PracticePage';
import { TrumpetDrillPage } from './pages/TrumpetDrillPage';
import './App.css';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<SidebarLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/tuner" element={<TunerPage />} />
          <Route path="/trumpet-drill" element={<TrumpetDrillPage />} />
          {/* Redirect any other path to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
