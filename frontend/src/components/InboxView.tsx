import React, { useRef, useState } from 'react';
import { FileText, Loader2, Plus, Upload } from 'lucide-react';
import { api } from '../lib/api';
import type { Collection, UploadRecord } from '../types';

interface Props {
  uploads: UploadRecord[];
  collections: Collection[];
  activeCollection: number | null;
  onUploaded: () => void;
  onCreateCollection: (name: string) => Promise<void>;
}

export const InboxView: React.FC<Props> = ({ uploads, collections, activeCollection, onUploaded, onCreateCollection }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState('');
  const [newCollection, setNewCollection] = useState('');
  const [galleryName, setGalleryName] = useState('');

  const handleFiles = async (files: FileList | File[]) => {
    setBusy(true);
    setMessage('');
    let found = 0;
    let failed = 0;
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;
      try {
        const res = await api.uploadPdf(file, activeCollection, galleryName.trim());
        found += res.artworks_found;
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    setGalleryName('');
    setMessage(failed ? `Some uploads failed. ${found} artworks extracted.` : `${found} artworks extracted — they're in your deck.`);
    onUploaded();
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3">
      {/* upload zone */}
      <div
        className={`border-2 border-dashed rounded-2xl px-6 py-9 flex flex-col items-center text-center transition-colors ${
          dragOver ? 'border-zinc-500 bg-zinc-100' : 'border-zinc-300 bg-zinc-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        {busy ? (
          <>
            <Loader2 className="w-8 h-8 text-zinc-500 animate-spin mb-3" />
            <p className="text-sm text-zinc-600">Reading the PDF, extracting artworks…</p>
          </>
        ) : (
          <>
            <div className="rounded-full bg-zinc-200 p-3 mb-3">
              <Upload className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-sm font-medium text-zinc-900">Drop gallery PDFs here</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Forwarded from email or WhatsApp — single-page captions or multi-page presentations both work. Up to 50MB.
            </p>
            <input
              value={galleryName}
              onChange={(e) => setGalleryName(e.target.value)}
              placeholder="Gallery name (optional — auto-detected if blank)"
              className="mt-4 w-full max-w-xs bg-white border border-zinc-300 rounded-full px-4 py-2 text-xs text-zinc-900 text-center focus:outline-none focus:border-zinc-500"
            />
            <button onClick={() => inputRef.current?.click()} className="mt-3 px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-full hover:bg-zinc-700">
              Choose files
            </button>
            <input ref={inputRef} type="file" accept="application/pdf" multiple hidden onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          </>
        )}
      </div>
      {message && <p className="text-xs text-emerald-600 mt-3 text-center">{message}</p>}

      {/* collections */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-zinc-900 mb-2">Collections</h3>
        <p className="text-xs text-zinc-500 mb-3">
          Group uploads by fair or season — Art Basel, Spring shows — and review each deck separately. New uploads land in the collection selected above.
        </p>
        <div className="flex gap-2">
          <input
            value={newCollection}
            onChange={(e) => setNewCollection(e.target.value)}
            placeholder="e.g. Art Basel 2026"
            className="flex-1 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={async () => { if (newCollection.trim()) { await onCreateCollection(newCollection.trim()); setNewCollection(''); } }}
            className="px-3 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {collections.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-4 py-3">
              <div>
                <div className="text-sm text-zinc-900">{c.name}</div>
                <div className="text-xs text-zinc-500">
                  {c.counts.pending} to review · {c.counts.liked} selected
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* processed PDFs */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-zinc-900 mb-2">Processed PDFs</h3>
        {uploads.length === 0 ? (
          <p className="text-xs text-zinc-500">Nothing yet.</p>
        ) : (
          <div className="space-y-2">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl px-4 py-3">
                <FileText className="w-5 h-5 text-zinc-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm text-zinc-900 truncate">{u.filename}</div>
                  <div className="text-xs text-zinc-500 truncate">
                    {u.gallery} · {u.page_count} pages → {u.artwork_count} artworks
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
