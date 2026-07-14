import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CouncilPortal from './pages/CouncilPortal';
import AdminPanel from './pages/AdminPanel';
import { ReactLenis } from 'lenis/react';

function App() {
  return (
    <ReactLenis root>
      <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/portal" element={<CouncilPortal />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
    </ReactLenis>
  );
}

export default App;
