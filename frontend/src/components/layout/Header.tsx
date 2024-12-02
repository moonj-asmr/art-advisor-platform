import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Art Advisor Platform</h1>
          </div>
          <div className="flex items-center space-x-6">
            <span className="text-sm text-gray-500">Storage: 45/100 PDFs</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Premium Account
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};