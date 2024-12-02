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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {artworks.map((artwork) => {
        const isSelected = selectedArtworks.includes(artwork.id);
        return (
          <div 
            key={artwork.id}
            onClick={() => onSelect(artwork.id)}
            className={`
              group relative bg-white rounded-lg overflow-hidden shadow-sm 
              transition-all duration-200 cursor-pointer
              ${isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}
            `}
          >
            <div className="aspect-square w-full overflow-hidden">
              <img 
                src={`https://picsum.photos/seed/${artwork.id}/400/400`}
                alt={artwork.title}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-200"
              />
              {isSelected && (
                <div className="absolute inset-0 bg-blue-500 bg-opacity-10 flex items-center justify-center">
                  <div className="bg-blue-500 text-white p-2 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <h3 className="font-medium text-sm mb-1 truncate">{artwork.title}</h3>
              <p className="text-gray-600 text-sm truncate">{artwork.artist}</p>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-500 text-xs">{artwork.gallery}</span>
                <span className="font-medium text-sm">{artwork.price}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};