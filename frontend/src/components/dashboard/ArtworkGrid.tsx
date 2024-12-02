import React from 'react';

interface Artwork {
  id: number;
  title: string;
  artist: string;
  price: string;
  gallery: string;
}

interface Props {
  artworks: Artwork[];
  selectedArtworks: number[];
  onSelect: (id: number) => void;
}

export const ArtworkGrid: React.FC<Props> = ({ artworks, selectedArtworks, onSelect }) => {
  return (
    <div className="artwork-grid">
      {artworks.map((artwork) => {
        const isSelected = selectedArtworks.includes(artwork.id);
        return (
          <div 
            key={artwork.id}
            className={`artwork-card cursor-pointer ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => onSelect(artwork.id)}
          >
            <div className="artwork-image">
              <img 
                src={`https://picsum.photos/seed/${artwork.id}/800/1000`}
                alt={artwork.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4 space-y-2">
              <h3 className="font-medium text-lg">{artwork.title}</h3>
              <p className="text-gray-600">{artwork.artist}</p>
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-500 text-sm">{artwork.gallery}</span>
                <span className="font-medium">{artwork.price}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};