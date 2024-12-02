import React from 'react';
import { ArtAdvisorDashboard } from './components/dashboard/ArtAdvisorDashboard';
import { Header } from './components/layout/Header';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ArtAdvisorDashboard />
      </main>
    </div>
  );
}

export default App;