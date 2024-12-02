import React from 'react';
import { Upload } from 'lucide-react';

export const UploadZone: React.FC = () => {
  return (
    <div className="upload-zone">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <Upload className="w-12 h-12 text-blue-400" />
        <div>
          <p className="text-lg font-medium text-gray-700">
            Drop PDFs here or click to upload
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Support for gallery and art fair PDFs
          </p>
        </div>
      </div>
    </div>
  );
};