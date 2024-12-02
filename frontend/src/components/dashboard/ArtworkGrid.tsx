import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface Artwork {
  id: number;
  artist: string;
  title: string;
  price: string;
  gallery: string;
}

interface ArtworkGridProps {
  artworks: Artwork[];
  selectedArtworks: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  sortBy: string;
}

export const ArtworkGrid: React.FC<ArtworkGridProps> = ({
  artworks,
  selectedArtworks,
  onSelectionChange,
  sortBy
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
                onSelectionChange(
                  isSelected 
                    ? selectedArtworks.filter(id => id !== artwork.id)
                    : [...selectedArtworks, artwork.id]
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
  );
};