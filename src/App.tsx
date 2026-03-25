import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SidebarLayout } from './components/SidebarLayout';
import { HomePage } from './pages/HomePage';
import { TunerPage } from './pages/TunerPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SidebarLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/tuner" element={<TunerPage />} />
          {/* Redirect any other path to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
