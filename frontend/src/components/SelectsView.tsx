import React, { useState } from 'react';
import { FileDown, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { api, mediaUrl } from '../lib/api';
import type { Artwork } from '../types';
import { ExportSheet } from './ExportSheet';

interface Props {
  liked: Artwork[];
  onChanged: () => void; // reload artworks
}

const EDIT_FIELDS: Array<[keyof Artwork, string]> = [
  ['artist', 'Artist'],
  ['title', 'Title'],
  ['year', 'Year'],
  ['medium', 'Medium'],
  ['dimensions', 'Dimensions'],
  ['edition', 'Edition'],
  ['price', 'Price'],
  ['gallery', 'Gallery'],
];

export const SelectsView: React.FC<Props> = ({ liked, onChanged }) => {
  const [editing, setEditing] = useState<Artwork | null>(null);
  const [form, setForm] = useState<Partial<Artwork>>({});
  const [exporting, setExporting] = useState(false);

  const removeFromSelects = async (a: Artwork) => {
    await api.decide(a.id, 'passed');
    onChanged();
  };
  const backToDeck = async (a: Artwork) => {
    await api.decide(a.id, 'pending');
    onChanged();
  };

  const openEdit = (a: Artwork) => {
    setEditing(a);
    setForm(Object.fromEntries(EDIT_FIELDS.map(([k]) => [k, a[k]])));
  };
  const saveEdit = async () => {
    if (!editing) return;
    await api.updateArtwork(editing.id, form);
    setEditing(null);
    onChanged();
  };

  if (liked.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
        <div className="text-4xl">♥</div>
        <h2 className="text-lg font-semibold text-neutral-100">No selects yet</h2>
        <p className="text-sm text-neutral-400 max-w-xs">
          Swipe right on works in the deck and they will collect here, ready to refine and send to clients.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24">
      <div className="flex items-center justify-between py-3 sticky top-0 bg-neutral-950/95 backdrop-blur z-10">
        <div className="text-sm text-neutral-400">
          {liked.length} work{liked.length === 1 ? '' : 's'} selected
        </div>
        <button
          onClick={() => setExporting(true)}
          className="flex items-center gap-2 bg-white text-neutral-900 text-sm font-semibold rounded-full px-4 py-2 hover:bg-neutral-200"
        >
          <FileDown className="w-4 h-4" /> Export PDF
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {liked.map((a) => (
          <div key={a.id} className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800">
            <div className="aspect-square bg-neutral-800 flex items-center justify-center">
              {a.image_url ? (
                <img src={mediaUrl(a.image_url)} alt={a.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-neutral-500">No image</span>
              )}
            </div>
            <div className="p-2.5">
              <div className="text-sm font-medium text-neutral-100 truncate">{a.artist || 'Unknown'}</div>
              <div className="text-xs italic text-neutral-400 truncate">
                {a.title}
                {a.year ? `, ${a.year}` : ''}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-neutral-300 font-medium">{a.price}</span>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <button title="Edit caption" onClick={() => openEdit(a)} className="p-1.5 rounded-md bg-neutral-800 text-neutral-300 hover:text-white">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button title="Back to deck" onClick={() => backToDeck(a)} className="p-1.5 rounded-md bg-neutral-800 text-neutral-300 hover:text-white">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button title="Remove from selects" onClick={() => removeFromSelects(a)} className="p-1.5 rounded-md bg-neutral-800 text-rose-400 hover:text-rose-300 ml-auto">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* edit modal */}
      {editing && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center" onClick={() => setEditing(null)}>
          <div
            className="bg-neutral-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-100">Edit caption</h3>
              <button onClick={() => setEditing(null)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              Extraction is automatic — fix anything the PDF made ambiguous. This is what prints on the client PDF.
            </p>
            {EDIT_FIELDS.map(([key, label]) => (
              <label key={key} className="block mb-3">
                <span className="text-xs text-neutral-400">{label}</span>
                <input
                  className="mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
                  value={(form[key] as string) ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            <button onClick={saveEdit} className="w-full bg-white text-neutral-900 font-semibold rounded-lg py-2.5 mt-2 hover:bg-neutral-200">
              Save
            </button>
          </div>
        </div>
      )}

      {exporting && <ExportSheet artworks={liked} onClose={() => setExporting(false)} />}
    </div>
  );
};
