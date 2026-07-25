import React, { useState } from 'react';
import { ArrowLeftRight, Pencil, Share, X } from 'lucide-react';
import { mediaUrl } from '../lib/api';
import { shareArtwork } from '../lib/share';
import type { Artwork, Collection } from '../types';

interface Props {
  artwork: Artwork;
  collections: Collection[];
  onEdit: () => void;
  onSwap: () => void;
  onClose: () => void;
}

/** Full-screen view of one work — the "hold it up to the light" moment.
 *  Big image, the complete caption, and the same actions as the grid. */
export const ArtworkDetail: React.FC<Props> = ({ artwork: a, collections, onEdit, onSwap, onClose }) => {
  const names = a.collection_ids
    .map((id) => collections.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[];
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    setSharing(true);
    try {
      await shareArtwork(a);
    } finally {
      setSharing(false);
    }
  };

  return (
    // tapping anywhere closes — the action buttons stop the tap from bubbling
    <div className="fixed inset-0 z-40 bg-white flex flex-col" onClick={onClose}>
      <div
        className="shrink-0 flex items-center justify-between px-4 pb-2"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
      >
        <span className="text-sm text-zinc-500">{a.status === 'liked' ? 'In your selects' : 'Passed'}</span>
        <button aria-label="Close" onClick={onClose} className="icon-btn w-10 h-10">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}>
        <div className="bg-zinc-100 rounded-2xl overflow-hidden flex items-center justify-center">
          {a.image_url ? (
            <img src={mediaUrl(a.image_url)} alt={a.title} className="w-full max-h-[52vh] object-contain" />
          ) : (
            <span className="text-xs text-zinc-400 py-16">No image</span>
          )}
        </div>

        <div className="mt-4">
          <div className="text-lg font-semibold text-zinc-900">{a.artist || 'Unknown artist'}</div>
          <div className="text-base italic text-zinc-600">
            {a.title}
            {a.year ? `, ${a.year}` : ''}
          </div>
          <div className="mt-2 text-sm text-zinc-600 space-y-0.5">
            {a.medium && <div>{a.medium}</div>}
            {a.dimensions && <div>{a.dimensions}</div>}
            {a.edition && <div>{a.edition}</div>}
          </div>
          {a.price && <div className="mt-2 text-base font-semibold text-zinc-900">{a.price}</div>}
          {a.gallery && <div className="mt-1 text-sm text-zinc-500">{a.gallery}</div>}
          {names.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {names.map((n) => (
                <span key={n} className="text-xs bg-zinc-100 border border-zinc-200 text-zinc-600 rounded-full px-2.5 py-1">
                  {n}
                </span>
              ))}
            </div>
          )}
          {a.description && (
            <p className="mt-4 text-sm text-zinc-600 whitespace-pre-line leading-relaxed">{a.description}</p>
          )}
          {a.detail_image_urls.map((u) => (
            <img key={u} src={mediaUrl(u)} alt="Additional view" className="mt-3 w-full rounded-2xl border border-zinc-200" />
          ))}
        </div>

        {/* one row, three equal buttons — labels kept short so nothing wraps */}
        <div className="mt-5 flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); share(); }} disabled={sharing}
                  className="btn-primary flex-1 px-2 py-3 text-[13px]">
            <Share className="w-4 h-4" /> {sharing ? 'Sharing…' : 'Share'}
          </button>
          <button title="Edit caption" onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="btn-quiet flex-1 px-2 py-3 text-[13px]">
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button onClick={(e) => { e.stopPropagation(); onSwap(); }}
                  className="btn-quiet flex-1 px-2 py-3 text-[13px]">
            <ArrowLeftRight className="w-4 h-4" /> {a.status === 'liked' ? 'To Passed' : 'To Selects'}
          </button>
        </div>
      </div>
    </div>
  );
};
