import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, FileDown, FolderCog, FolderMinus, FolderPlus, Layers, Pencil } from 'lucide-react';
import { api, mediaUrl } from '../lib/api';
import type { Artwork, Collection } from '../types';
import { ArtworkDetail } from './ArtworkDetail';
import { CollectionPicker } from './CollectionPicker';
import { ExportSheet } from './ExportSheet';
import { Sheet } from './Sheet';

type Segment = 'liked' | 'passed';

interface Props {
  artworks: Artwork[]; // all decided works (liked + passed)
  collections: Collection[];
  onChanged: () => void;
  onCreateCollection: (name: string) => Promise<void>;
  onRenameCollection: (id: number, name: string) => Promise<void>;
  onDeleteCollection: (id: number) => Promise<void>;
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

export const LibraryView: React.FC<Props> = ({
  artworks, collections, onChanged, onCreateCollection, onRenameCollection, onDeleteCollection,
}) => {
  const [segment, setSegment] = useState<Segment>('liked');
  const [filter, setFilter] = useState<number | 'all'>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<number[]>([]);
  const [editing, setEditing] = useState<Artwork | null>(null);
  const [viewing, setViewing] = useState<Artwork | null>(null);
  const [form, setForm] = useState<Partial<Artwork>>({});
  const [exporting, setExporting] = useState(false);
  const [exportingChecked, setExportingChecked] = useState(false);
  const [picking, setPicking] = useState(false);
  const [managing, setManaging] = useState(false);

  const actionBarOpen = selectMode && checked.length > 0;

  useEffect(() => {
    // a deleted collection can't stay the active filter
    if (filter !== 'all' && !collections.some((c) => c.id === filter)) setFilter('all');
  }, [collections, filter]);

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
  // only offered while filtered to one collection — takes the checked works
  // out of that collection without touching the works themselves
  const bulkRemoveFromCollection = async () => {
    if (filter === 'all') return;
    await api.bulkCollections(checked, filter, 'remove');
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
    if (viewing && viewing.id === editing.id) setViewing({ ...viewing, ...form } as Artwork);
    setEditing(null);
    onChanged();
  };

  const collectionName = (id: number) => collections.find((c) => c.id === id)?.name ?? '';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* everything scrolls together — the controls simply slide off the top,
          no animated collapse to glitch mid-scroll */}
      <div className={`flex-1 overflow-y-auto px-4 ${actionBarOpen ? 'pb-24' : 'pb-6'}`}>
      {/* controls share grid columns so the collections row lines up exactly
          under the Passed/Selects slide — the cog ends where the slide ends */}
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-2 items-center pt-1 pb-2">
          {/* segment control — Passed left / Selects right matches the swipe
              directions; Passed is deliberately quieter, it's the safety net */}
          <div className="flex items-center bg-zinc-100 rounded-full p-0.5 justify-self-start">
            {([
              ['passed', 'Passed', passedCount],
              ['liked', 'Selects', likedCount],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => { setSegment(key); exitSelect(); }}
                className={`flex items-center gap-1.5 py-2 rounded-full ${
                  key === 'passed'
                    ? `px-3 text-xs ${segment === key ? 'bg-white shadow text-zinc-600 font-medium' : 'text-zinc-400'}`
                    : `px-4 text-sm ${segment === key ? 'bg-white shadow text-zinc-900 font-semibold' : 'text-zinc-500'}`
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold rounded-full min-w-[15px] h-[15px] px-1 flex items-center justify-center ${
                    segment === key && key === 'liked' ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div />
          {segment === 'liked' && shown.length > 0 && !selectMode ? (
            <button
              onClick={() => setExporting(true)}
              className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-full px-4 py-2 whitespace-nowrap justify-self-end hover:bg-emerald-500"
            >
              <FileDown className="w-4 h-4" />
              Export
            </button>
          ) : (
            <div />
          )}

          {/* row 2 — stretches to the same width as the slide above */}
          <div className="flex items-center gap-2 justify-self-stretch">
            <select
              value={filter === 'all' ? '' : filter}
              onChange={(e) => setFilter(e.target.value ? Number(e.target.value) : 'all')}
              className="flex-1 min-w-0 bg-zinc-100 border border-zinc-200 text-zinc-700 text-[15px] rounded-full px-4 py-2.5 focus:outline-none"
            >
              <option value="">All collections</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              title="Manage collections"
              onClick={() => setManaging(true)}
              className="p-3 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-zinc-900 shrink-0"
            >
              <FolderCog className="w-5 h-5" />
            </button>
          </div>
          <div />
          <button
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            className={`text-sm rounded-full px-4 py-2 border justify-self-end ${selectMode ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-300 text-zinc-600'}`}
          >
            {selectMode ? 'Done' : 'Select'}
          </button>

          {selectMode && checked.length === 0 && (
            <p className="col-span-3 text-xs text-zinc-400">
              Tap works to select them — then add them to a collection, move them, or export.
            </p>
          )}
      </div>

      <div>
        {shown.length === 0 ? (
          <div className="text-center text-sm text-zinc-400 pt-16 px-8">
            {segment === 'liked'
              ? 'Nothing here yet — swipe right in the deck, or loosen the collection filter.'
              : 'No passed works here. Anything you pass in the deck lands in this list, so nothing is ever lost.'}
          </div>
        ) : (
          // two explicit top-aligned columns (odd items left, even items right)
          // so the first row of cards always starts level; cards keep each
          // artwork's true proportions and never crop into the work
          <div className="flex items-start gap-3">
            {[0, 1].map((col) => (
              <div key={col} className="flex-1 min-w-0 space-y-3">
                {shown.filter((_, i) => i % 2 === col).map((a) => {
              const isChecked = checked.includes(a.id);
              return (
                <div
                  key={a.id}
                  onClick={() => (selectMode ? toggleCheck(a.id) : setViewing(a))}
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
                  <div className="bg-zinc-100">
                    {a.image_url ? (
                      <img src={mediaUrl(a.image_url)} alt={a.title} className="w-full h-auto" />
                    ) : (
                      <div className="aspect-square flex items-center justify-center">
                        <span className="text-xs text-zinc-400">No image</span>
                      </div>
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
                        <button title="Edit caption" onClick={(e) => { e.stopPropagation(); openEdit(a); }} className="p-1.5 rounded-md bg-zinc-100 text-zinc-500 hover:text-zinc-900">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title={segment === 'liked' ? 'Move to Passed' : 'Move to Selects'}
                          onClick={(e) => { e.stopPropagation(); swapOne(a); }}
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
            ))}
          </div>
        )}
      </div>
      </div>

      {/* multi-select action lozenge — the one floating lozenge left, popping
          up just above the permanent bottom nav */}
      {actionBarOpen && (
        <div className="absolute left-4 right-4 bottom-3 z-30 h-[52px] bg-white/95 backdrop-blur border border-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.14)] rounded-full px-2 flex items-center justify-center gap-1 overflow-x-auto">
          <button
            onClick={() => setPicking(true)}
            className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-semibold rounded-full px-2.5 py-2 whitespace-nowrap shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Add
          </button>
          <button
            onClick={bulkSwap}
            className="flex items-center gap-1.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-full px-2.5 py-2 whitespace-nowrap shrink-0"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> {segment === 'liked' ? 'Pass' : 'Select'}
          </button>
          <button
            onClick={bulkBackToDeck}
            className="flex items-center gap-1.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-full px-2.5 py-2 whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5" /> Re-deck
          </button>
          {filter !== 'all' && (
            <button
              title={`Remove from ${collectionName(filter)}`}
              onClick={bulkRemoveFromCollection}
              className="flex items-center gap-1.5 bg-zinc-100 text-rose-600 text-xs font-semibold rounded-full px-2.5 py-2 whitespace-nowrap shrink-0"
            >
              <FolderMinus className="w-3.5 h-3.5" /> Remove
            </button>
          )}
          {segment === 'liked' && (
            <button
              onClick={() => setExportingChecked(true)}
              className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-full px-2.5 py-2 whitespace-nowrap shrink-0 ml-auto"
            >
              <FileDown className="w-3.5 h-3.5" /> Export
            </button>
          )}
        </div>
      )}

      {/* full-screen artwork view — tap any card outside select mode */}
      {viewing && (
        <ArtworkDetail
          artwork={viewing}
          collections={collections}
          onEdit={() => openEdit(viewing)}
          onSwap={async () => {
            await swapOne(viewing);
            setViewing(null);
          }}
          onClose={() => setViewing(null)}
        />
      )}

      {/* edit modal */}
      {editing && (
        <Sheet title="Edit caption" onClose={() => setEditing(null)}>
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
        </Sheet>
      )}

      {managing && (
        <CollectionPicker
          title="Collections"
          subtitle="Rename with the pencil, delete with the trash — artworks are always kept."
          collections={collections}
          selected={filter === 'all' ? [] : [filter]}
          confirmLabel="Done"
          onConfirm={() => setManaging(false)}
          onCreate={onCreateCollection}
          onRename={onRenameCollection}
          onDelete={onDeleteCollection}
          onClose={() => setManaging(false)}
        />
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
          onRename={onRenameCollection}
          onDelete={onDeleteCollection}
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
