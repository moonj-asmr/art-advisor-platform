import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface PDFDropzoneProps {
  onUpload: (file: File) => void;
  uploading: boolean;
  progress: number;
}

export const PDFDropzone: React.FC<PDFDropzoneProps> = ({
  onUpload,
  uploading,
  progress
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles[0]);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={`
        w-full p-8 border-2 border-dashed rounded-lg
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
        ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <input {...getInputProps()} disabled={uploading} />
      <div className="flex flex-col items-center justify-center text-center">
        <Upload className="w-12 h-12 text-gray-400 mb-4" />
        {uploading ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Uploading...</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-lg mb-2">
              {isDragActive
                ? 'Drop the PDF here'
                : 'Drag & drop a PDF here or click to select'}
            </p>
            <p className="text-sm text-gray-500">
              Gallery and art fair PDFs accepted
            </p>
          </div>
        )}
      </div>
    </div>
  );
};