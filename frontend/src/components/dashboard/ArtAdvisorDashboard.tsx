import React, { useState } from 'react';
import { UploadZone } from './UploadZone';
import { ArtworkGrid } from './ArtworkGrid';
import { Plus, FileText, Filter, Grid, List } from 'lucide-react';

// ... (keep the SAMPLE_ARTWORKS array)

export const ArtAdvisorDashboard: React.FC = () => {
  const [selectedArtworks, setSelectedArtworks] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState('artworks');

  const handleArtworkSelect = (id: number) => {
    setSelectedArtworks(prev =>
      prev.includes(id) ? prev.filter(artworkId => artworkId !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-[2000px] mx-auto">
      {/* Navigation */}
      <nav className="bg-white shadow-sm rounded-lg mb-6">
        <div className="flex border-b border-gray-100 px-2">
          {['Artwork Library', 'PDF Management', 'Client Portfolios'].map((tab, i) => (
            <button
              key={i}
              className={`
                px-6 py-4 text-sm font-medium transition-colors relative
                ${activeTab === i ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}
              `}
              onClick={() => setActiveTab(i)}
            >
              {tab}
              {activeTab === i && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Sidebar */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <UploadZone />
          
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-4 space-y-3">
              <button className="
                w-full px-4 py-2.5 rounded-lg
                bg-blue-600 text-white text-sm font-medium
                hover:bg-blue-700 transition-colors
                flex items-center justify-center
              ">
                <Plus className="w-4 h-4 mr-2" />
                Create New Portfolio
              </button>
              
              <button className="
                w-full px-4 py-2.5 rounded-lg
                bg-gray-100 text-gray-700 text-sm font-medium
                hover:bg-gray-200 transition-colors
                flex items-center justify-center
              ">
                <FileText className="w-4 h-4 mr-2" />
                Generate Report
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="col-span-12 lg:col-span-9">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Available Artworks</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedArtworks.length} artwork{selectedArtworks.length !== 1 ? 's' : ''} selected
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button className="
                  px-3 py-2 rounded-lg
                  bg-gray-100 text-gray-700 text-sm font-medium
                  hover:bg-gray-200 transition-colors
                  flex items-center
                ">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </button>
                
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  <button className="px-3 py-2 bg-white hover:bg-gray-50">
                    <Grid className="w-4 h-4 text-gray-600" />
                  </button>
                  <button className="px-3 py-2 bg-white hover:bg-gray-50 border-l border-gray-200">
                    <List className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <ArtworkGrid
                artworks={SAMPLE_ARTWORKS}
                selectedArtworks={selectedArtworks}
                onSelect={handleArtworkSelect}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};