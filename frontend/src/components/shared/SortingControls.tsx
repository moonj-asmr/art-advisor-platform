import React from 'react';

interface SortingControlsProps {
  sortBy: string;
  onSortChange: (value: string) => void;
  selectedCount: number;
}

export const SortingControls: React.FC<SortingControlsProps> = ({
  sortBy,
  onSortChange,
  selectedCount
}) => {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium">Sort by:</span>
        <select 
          className="border rounded-md px-2 py-1"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
        >
          <option value="artist">Artist Name</option>
          <option value="title">Title</option>
          <option value="price">Price</option>
          <option value="gallery">Gallery</option>
        </select>
      </div>
      <span className="text-sm text-gray-600">
        {selectedCount} artwork(s) selected
      </span>
    </div>
  );
};