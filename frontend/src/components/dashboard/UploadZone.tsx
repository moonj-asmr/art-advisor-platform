import React from 'react';
import { Upload } from 'lucide-react';

export const UploadZone: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-lg font-medium text-gray-900">Upload PDFs</h2>
        <p className="text-sm text-gray-500 mt-1">Add gallery or art fair PDFs for processing</p>
      </div>
      
      <div className="p-8">
        <div 
          className="
            border-2 border-dashed border-gray-200 rounded-lg 
            bg-gray-50 px-6 py-10
            flex flex-col items-center justify-center
            transition-all duration-200
            hover:border-blue-400 hover:bg-blue-50
          "
        >
          <div className="rounded-full bg-blue-100 p-3 mb-4">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-900">
              Drop PDFs here or click to upload
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PDF files up to 50MB
            </p>
          </div>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Select Files
          </button>
        </div>
        
        <div className="mt-4 flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg text-sm">
          <span className="text-gray-600">Processing queue: 0 files</span>
          <button className="text-blue-600 hover:text-blue-800 font-medium">
            View History
          </button>
        </div>
      </div>
    </div>
  );
};