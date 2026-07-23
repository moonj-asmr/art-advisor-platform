import React, { useState } from 'react';
import { ArrowLeftRight, Pencil, Share, X } from 'lucide-react';
import { mediaUrl } from '../lib/api';
import type { Artwork, Collection } from '../types';

/** The caption that travels with a shared work: title, artist, medium,
 *  dimensions, price — nothing else. */
const shareText = (a: Artwork) => {
  const titleLine = [a.title, a.year].filter(Boolean).join(', ');
  return [a.artist, titleLine, a.medium, a.dimensions, a.price].filter(Boolean).join('\n');
};

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

  // opens the system share sheet (Messages, WhatsApp, Mail…) with the main
  // image and the short caption
  const share = async () => {
    setSharing(true);
    try {
      const text = shareText(a);
      let files: File[] | undefined;
      if (a.image_url) {
        try {
          const blob = await fetch(mediaUrl(a.image_url)).then((r) => r.blob());
          const file = new File([blob], 'artwork.png', { type: blob.type || 'image/png' });
          if (navigator.canShare?.({ files: [file] })) files = [file];
        } catch {
          /* image fetch failed — share the text alone */
        }
      }
      if (navigator.share) {
        await navigator.share(files ? { files, text } : { text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Caption copied — sharing is only available on the phone.');
      }
    } catch {
      /* user cancelled the share sheet */
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
        <button aria-label="Close" onClick={onClose} className="p-2.5 rounded-full bg-zinc-100 text-zinc-600 hover:text-zinc-900">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}>
        <div className="bg-zinc-100 rounded-xl overflow-hidden flex items-center justify-center">
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
            <img key={u} src={mediaUrl(u)} alt="Additional view" className="mt-3 w-full rounded-xl border border-zinc-200" />
          ))}
        </div>

        <div className="mt-5 flex gap-2 flex-wrap">
          <button onClick={(e) => { e.stopPropagation(); share(); }} disabled={sharing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-semibold disabled:opacity-60">
            <Share className="w-4 h-4" /> {sharing ? 'Sharing…' : 'Share'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="flex items-center gap-1.5 px-4 py-2 bg-zinc-100 border border-zinc-200 rounded-full text-sm text-zinc-700 hover:text-zinc-900">
            <Pencil className="w-4 h-4" /> Edit caption
          </button>
          <button onClick={(e) => { e.stopPropagation(); onSwap(); }} className="flex items-center gap-1.5 px-4 py-2 bg-zinc-100 border border-zinc-200 rounded-full text-sm text-zinc-700 hover:text-zinc-900">
            <ArrowLeftRight className="w-4 h-4" /> {a.status === 'liked' ? 'Move to Passed' : 'Move to Selects'}
          </button>
        </div>
      </div>
    </div>
  );
};
