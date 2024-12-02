import React, { useState } from 'react';
import { UploadZone } from './UploadZone';
import { ArtworkGrid } from './ArtworkGrid';
import { Plus, FileText, Filter } from 'lucide-react';

const SAMPLE_ARTWORKS = [
  {
    id: 1,
    artist: "Yu Nishimura",
    title: "portrait (orange on blue)",
    price: "€20,000",
    gallery: "CASTLE",
  },
  {
    id: 2,
    artist: "Magnus Frederik Clausen",
    title: "Tolvoverfemtiltreiotte",
    price: "$4,900",
    gallery: "CASTLE",
  },
  {
    id: 3,
    artist: "Yu Nishimura",
    title: "meditation",
    price: "€20,000",
    gallery: "CASTLE",
  },
  {
    id: 4,
    artist: "Magnus Frederik Clausen",
    title: "Untitled (Study)",
    price: "$5,200",
    gallery: "CASTLE",
  },
  {
    id: 5,
    artist: "Yu Nishimura",
    title: "Autumn Light",
    price: "€18,000",
    gallery: "CASTLE",
  },
  {
    id: 6,
    artist: "Magnus Frederik Clausen",
    title: "Time Series III",
    price: "$6,800",
    gallery: "CASTLE",
  }
];

export const ArtAdvisorDashboard: React.FC = () => {
  const [selectedArtworks, setSelectedArtworks] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState('artworks');

  const handleArtworkSelect = (id: number) => {
    setSelectedArtworks(prev =>
      prev.includes(id) ? prev.filter(artworkId => artworkId !== id) : [...prev, id]
    );
  };

  const tabs = [
    { id: 'artworks', label: 'Artwork Library' },
    { id: 'pdfs', label: 'PDF Management' },
    { id: 'clients', label: 'Client Portfolios' },
  ];

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'artworks' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Upload Zone */}
            <div className="md:col-span-2">
              <UploadZone />
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
              <h3 className="font-medium text-lg">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Portfolio
                </button>
                <button className="w-full flex items-center justify-center px-4 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Report
                </button>
              </div>
            </div>
          </div>

          {/* Artwork Grid */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-medium">Available Artworks</h2>
                <span className="text-sm text-gray-500">
                  {selectedArtworks.length} selected
                </span>
              </div>
              <button className="flex items-center text-gray-600 hover:text-gray-900">
                <Filter className="w-4 h-4 mr-1" />
                Filter
              </button>
            </div>
            <ArtworkGrid
              artworks={SAMPLE_ARTWORKS}
              selectedArtworks={selectedArtworks}
              onSelect={handleArtworkSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
};