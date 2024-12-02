import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ArtworkGrid } from '../components/dashboard/ArtworkGrid';

const mockArtworks = [
  {
    id: 1,
    title: 'Test Artwork',
    artist: 'Test Artist',
    price: '$45,000',
    gallery: 'Test Gallery'
  }
];

describe('ArtworkGrid', () => {
  it('renders artworks correctly', () => {
    const { getByText } = render(
      <ArtworkGrid
        artworks={mockArtworks}
        selectedArtworks={[]}
        onSelectionChange={() => {}}
        sortBy="artist"
      />
    );

    expect(getByText('Test Artwork')).toBeInTheDocument();
    expect(getByText('Test Artist')).toBeInTheDocument();
  });

  it('handles artwork selection', () => {
    const handleSelection = jest.fn();
    const { getByText } = render(
      <ArtworkGrid
        artworks={mockArtworks}
        selectedArtworks={[]}
        onSelectionChange={handleSelection}
        sortBy="artist"
      />
    );

    fireEvent.click(getByText('Test Artwork'));
    expect(handleSelection).toHaveBeenCalledWith([1]);
  });
});