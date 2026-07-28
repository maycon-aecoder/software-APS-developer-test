import React from 'react';
import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar />
      <Sidebar />

      {/* Main content — offset for fixed topbar and sidebar */}
      <main className="ml-60 pt-16 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Welcome, {user?.name ?? 'User'} 👋
          </h1>

          {/* Placeholder content card */}
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Feature placeholder</h2>
            <p className="text-sm text-gray-400 max-w-xs">
              Implement your feature here. This area is intentionally left empty as part of the
              technical assessment.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
