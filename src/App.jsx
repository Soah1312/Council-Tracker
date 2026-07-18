import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const CouncilPortal = lazy(() => import('./pages/CouncilPortal'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#000] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#ffe17c]/30 border-t-[#ffe17c] rounded-full animate-spin" />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/portal" element={<CouncilPortal />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
