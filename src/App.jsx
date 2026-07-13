import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CouncilPortal from './pages/CouncilPortal';
import AdminPanel from './pages/AdminPanel';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white text-[#171e19]">
        <Routes>
          <Route path="/" element={<CouncilPortal />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
