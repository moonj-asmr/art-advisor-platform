import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, FileDown, FolderPlus, Layers, Pencil, X } from 'lucide-react';
import { api, mediaUrl } from '../lib/api';
import type { Artwork, Collection } from '../types';
import { CollectionPicker } from './CollectionPicker';
import { ExportSheet } from './ExportSheet';

type Segment = 'liked' | 'passed';

interface Props {
  artworks: Artwork[]; // all decided works (liked + passed)
  collections: Collection[];
  onChanged: () => void;
  onCreateCollection: (name: string) => Promise<void>;
  onNavVisible: (visible: boolean) => void;
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

export const LibraryView: React.FC<Props> = ({ artworks, collections, onChanged, onCreateCollection, onNavVisible }) => {
  const [segment, setSegment] = useState<Segment>('liked');
  const [filter, setFilter] = useState<number | 'all'>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<number[]>([]);
  const [editing, setEditing] = useState<Artwork | null>(null);
  const [form, setForm] = useState<Partial<Artwork>>({});
  const [exporting, setExporting] = useState(false);
  const [exportingChecked, setExportingChecked] = useState(false);
  const [picking, setPicking] = useState(false);
  const lastY = useRef(0);

  const actionBarOpen = selectMode && checked.length > 0;
  useEffect(() => {
    // the multi-select action bar takes the nav's spot
    onNavVisible(!actionBarOpen);
  }, [actionBarOpen, onNavVisible]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (actionBarOpen) return;
    const y = e.currentTarget.scrollTop;
    if (y < 24) onNavVisible(true);
    else if (y - lastY.current > 6) onNavVisible(false);
    else if (lastY.current - y > 6) onNavVisible(true);
    lastY.current = y;
  };

  const shown = useMemo(
    () =>
      artworks.filter(
        (a) => a.status === segment && (filter === 'all' || a.collection_ids.includes(filter)),
      ),
    [artworks, segment, filter],
  );
  const likedCount = artworks.filter((a) => a.status === 'liked').length;
  const passedCount = artworks.filter((a) => a.status === 'passed').length;

  const exitSelect = () => {
    setSelectMode(false);
    setChecked([]);
  };
  const toggleCheck = (id: number) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const swapOne = async (a: Artwork) => {
    await api.decide(a.id, a.status === 'liked' ? 'passed' : 'liked');
    onChanged();
  };
  const bulkSwap = async () => {
    await api.bulkStatus(checked, segment === 'liked' ? 'passed' : 'liked');
    exitSelect();
    onChanged();
  };
  const bulkBackToDeck = async () => {
    await api.bulkStatus(checked, 'pending');
    exitSelect();
    onChanged();
  };
  const bulkAddToCollections = async (ids: number[]) => {
    for (const cid of ids) await api.bulkCollections(checked, cid, 'add');
    setPicking(false);
    exitSelect();
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

  const collectionName = (id: number) => collections.find((c) => c.id === id)?.name ?? '';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* controls */}
      <div className="px-4 pt-1 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          {/* segment control */}
          <div className="flex bg-zinc-100 rounded-full p-0.5 text-sm">
            {([
              ['liked', `Selected ${likedCount}`],
              ['passed', `Passed ${passedCount}`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setSegment(key); exitSelect(); }}
                className={`px-3.5 py-1.5 rounded-full ${segment === key ? 'bg-white shadow text-zinc-900 font-medium' : 'text-zinc-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            className={`text-sm rounded-full px-3.5 py-1.5 border ${selectMode ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-300 text-zinc-600'}`}
          >
            {selectMode ? 'Done' : 'Select'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter === 'all' ? '' : filter}
            onChange={(e) => setFilter(e.target.value ? Number(e.target.value) : 'all')}
            className="bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs rounded-full px-3 py-1.5 focus:outline-none max-w-[60%]"
          >
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex-1" />
          {segment === 'liked' && shown.length > 0 && !selectMode && (
            <button
              onClick={() => setExporting(true)}
              className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-semibold rounded-full px-3.5 py-2 hover:bg-zinc-700"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export {filter !== 'all' ? collectionName(filter) : 'PDF'}
            </button>
          )}
        </div>
      </div>

      {/* grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-32" onScroll={onScroll}>
        {shown.length === 0 ? (
          <div className="text-center text-sm text-zinc-400 pt-16 px-8">
            {segment === 'liked'
              ? 'Nothing here yet — swipe right in the deck, or loosen the collection filter.'
              : 'No passed works here. Anything you pass in the deck lands in this list, so nothing is ever lost.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {shown.map((a) => {
              const isChecked = checked.includes(a.id);
              return (
                <div
                  key={a.id}
                  onClick={() => selectMode && toggleCheck(a.id)}
                  className={`relative bg-white rounded-xl overflow-hidden border ${
                    selectMode && isChecked ? 'border-zinc-900 ring-2 ring-zinc-900' : 'border-zinc-200'
                  }`}
                >
                  {selectMode && (
                    <span
                      className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isChecked ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white/80 border-zinc-400 text-transparent'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  )}
                  <div className="aspect-square bg-zinc-100 flex items-center justify-center">
                    {a.image_url ? (
                      <img src={mediaUrl(a.image_url)} alt={a.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-zinc-400">No image</span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="text-sm font-medium text-zinc-900 truncate">{a.artist || 'Unknown'}</div>
                    <div className="text-xs italic text-zinc-500 truncate">
                      {a.title}
                      {a.year ? `, ${a.year}` : ''}
                    </div>
                    <div className="text-xs text-zinc-700 font-medium mt-0.5">{a.price}</div>
                    {a.collection_ids.length > 0 && (
                      <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                        {a.collection_ids.map(collectionName).filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {!selectMode && (
                      <div className="flex items-center gap-1 mt-2">
                        <button title="Edit caption" onClick={() => openEdit(a)} className="p-1.5 rounded-md bg-zinc-100 text-zinc-500 hover:text-zinc-900">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title={segment === 'liked' ? 'Move to Passed' : 'Move to Selected'}
                          onClick={() => swapOne(a)}
                          className="p-1.5 rounded-md bg-zinc-100 text-zinc-500 hover:text-zinc-900 ml-auto"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* multi-select action bar (floats where the nav lozenge sits) */}
      {actionBarOpen && (
        <div
          className="absolute left-3 right-3 z-30 bg-white/95 backdrop-blur border border-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.14)] rounded-2xl px-3 py-2.5 flex items-center gap-1.5 flex-wrap"
          style={{ bottom: 'max(env(safe-area-inset-bottom), 0.9rem)' }}
        >
          <span className="text-xs text-zinc-500 mr-0.5">{checked.length}</span>
          <button
            onClick={() => setPicking(true)}
            className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-semibold rounded-full px-3 py-2"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Add
          </button>
          {segment === 'liked' && (
            <button
              onClick={() => setExportingChecked(true)}
              className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-semibold rounded-full px-3 py-2"
            >
              <FileDown className="w-3.5 h-3.5" /> Export
            </button>
          )}
          <button
            onClick={bulkSwap}
            className="flex items-center gap-1.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-full px-3 py-2"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> {segment === 'liked' ? 'Pass' : 'Select'}
          </button>
          <button
            onClick={bulkBackToDeck}
            className="flex items-center gap-1.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-full px-3 py-2 ml-auto"
          >
            <Layers className="w-3.5 h-3.5" /> Re-deck
          </button>
        </div>
      )}

      {/* edit modal */}
      {editing && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setEditing(null)}>
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto border border-zinc-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-900">Edit caption</h3>
              <button onClick={() => setEditing(null)} className="text-zinc-400 hover:text-zinc-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            {EDIT_FIELDS.map(([key, label]) => (
              <label key={key} className="block mb-3">
                <span className="text-xs text-zinc-500">{label}</span>
                <input
                  className="mt-1 w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-500"
                  value={(form[key] as string) ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            <button onClick={saveEdit} className="w-full bg-zinc-900 text-white font-semibold rounded-lg py-2.5 mt-2 hover:bg-zinc-700">
              Save
            </button>
          </div>
        </div>
      )}

      {picking && (
        <CollectionPicker
          title="Add to collections"
          subtitle={`${checked.length} work${checked.length === 1 ? '' : 's'} — a work can live in several collections at once.`}
          collections={collections}
          selected={[]}
          confirmLabel="Add"
          onConfirm={bulkAddToCollections}
          onCreate={onCreateCollection}
          onClose={() => setPicking(false)}
        />
      )}

      {exporting && (
        <ExportSheet artworks={shown} onClose={() => setExporting(false)} />
      )}
      {exportingChecked && (
        <ExportSheet
          artworks={shown.filter((a) => checked.includes(a.id))}
          onClose={() => setExportingChecked(false)}
        />
      )}
    </div>
  );
};
