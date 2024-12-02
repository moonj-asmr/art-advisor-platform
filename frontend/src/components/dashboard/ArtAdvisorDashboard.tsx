import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { TabsContent, Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Filter, Users, FileText, Plus } from 'lucide-react';

export const ArtAdvisorDashboard = () => {
  const [selectedArtworks, setSelectedArtworks] = useState([]);
  const [sortBy, setSortBy] = useState('artist');
  const [artworks, setArtworks] = useState([
    { id: 1, artist: "Yu Nishimura", title: "portrait (orange on blue)", price: "€20,000", gallery: "CASTLE" },
    { id: 2, artist: "Magnus Frederik Clausen", title: "Tolvoverfemtiltreiotte", price: "$4,900", gallery: "CASTLE" },
    { id: 3, artist: "Yu Nishimura", title: "meditation", price: "€20,000", gallery: "CASTLE" },
  ]);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Art Advisor Dashboard</h1>
        <div className="space-x-4">
          <span className="text-gray-600">Storage: 45/100 PDFs</span>
          <span className="text-gray-600">Premium Account</span>
        </div>
      </div>

      <Tabs defaultValue="artworks" className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="artworks">Artwork Library</TabsTrigger>
          <TabsTrigger value="pdfs">PDF Management</TabsTrigger>
          <TabsTrigger value="clients">Client Portfolios</TabsTrigger>
        </TabsList>

        <TabsContent value="artworks">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* PDF Upload Card */}
            <Card className="bg-gray-50">
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
                  <Upload className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-gray-600">Drop PDFs here or click to upload</p>
                  <p className="text-sm text-gray-500 mt-2">Support for gallery and art fair PDFs</p>
                </div>
              </CardContent>
            </Card>

            {/* Art Fair Filters */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <h3 className="font-semibold">Active Art Fairs</h3>
                <Filter className="w-4 h-4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span>Art Basel Miami 2024</span>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span>Frieze Los Angeles 2024</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Quick Actions</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <button className="flex items-center text-blue-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Client Portfolio
                </button>
                <button className="flex items-center text-blue-600">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate PDF Report
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Artwork Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-8">
            {artworks
              .sort((a, b) => a[sortBy].localeCompare(b[sortBy]))
              .map((artwork) => {
                const isSelected = selectedArtworks.includes(artwork.id);
                return (
                  <Card 
                    key={artwork.id} 
                    className={`overflow-hidden cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => {
                      setSelectedArtworks(prev => 
                        isSelected 
                          ? prev.filter(id => id !== artwork.id)
                          : [...prev, artwork.id]
                      );
                    }}
                  >
                    <div className="aspect-square bg-gray-100">
                      <img 
                        src="/api/placeholder/200/200" 
                        alt={artwork.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardContent className="p-2">
                      <p className="text-xs font-medium truncate">{artwork.title}</p>
                      <p className="text-xs text-gray-600 truncate">{artwork.artist}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-600">{artwork.gallery}</span>
                        <span className="text-xs font-medium">{artwork.price}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>

        <TabsContent value="pdfs">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Uploaded PDFs</h3>
            {/* PDF management interface would go here */}
          </div>
        </TabsContent>

        <TabsContent value="clients">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Client Portfolios</h3>
            {/* Client management interface would go here */}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};