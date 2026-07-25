import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, FileDown, FolderCog, FolderMinus, FolderPlus, Layers, Pencil, Share } from 'lucide-react';
import { api, mediaUrl } from '../lib/api';
import { shareArtwork } from '../lib/share';
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
  // 'all' = everything, 'none' = works not filed into any collection
  const [filter, setFilter] = useState<number | 'all' | 'none'>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<number[]>([]);
  const [editing, setEditing] = useState<Artwork | null>(null);
  const [viewing, setViewing] = useState<Artwork | null>(null);
  const [form, setForm] = useState<Partial<Artwork>>({});
  const [exporting, setExporting] = useState(false);
  const [exportingChecked, setExportingChecked] = useState(false);
  const [picking, setPicking] = useState(false);
  const [managing, setManaging] = useState(false);

  // the action lozenge shows as soon as select mode starts (buttons disabled
  // until something is ticked) so the mode explains itself before the first tap
  const actionBarOpen = selectMode;
  const nothingChecked = checked.length === 0;

  // one-time floating hint the very first time Organize is used — hovers over
  // the grid without shifting any cards, gone forever after the first tap
  const HINT_KEY = 'advisorydeck_organize_hint_seen';
  const [showHint, setShowHint] = useState(false);
  const enterSelectMode = () => {
    setSelectMode(true);
    if (!localStorage.getItem(HINT_KEY)) setShowHint(true);
  };
  useEffect(() => {
    if (showHint && checked.length > 0) {
      localStorage.setItem(HINT_KEY, '1');
      setShowHint(false);
    }
  }, [checked, showHint]);

  // the collections row is sized to end exactly where the Passed/Selects
  // slide ends — measured, so it tracks the slide's real width
  const segRef = useRef<HTMLDivElement>(null);
  const [segWidth, setSegWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = segRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSegWidth(el.offsetWidth));
    ro.observe(el);
    setSegWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // a deleted collection can't stay the active filter
    if (typeof filter === 'number' && !collections.some((c) => c.id === filter)) setFilter('all');
  }, [collections, filter]);

  const shown = useMemo(
    () =>
      artworks.filter(
        (a) =>
          a.status === segment &&
          (filter === 'all' ||
            (filter === 'none' ? a.collection_ids.length === 0 : a.collection_ids.includes(filter))),
      ),
    [artworks, segment, filter],
  );
  const likedCount = artworks.filter((a) => a.status === 'liked').length;
  const passedCount = artworks.filter((a) => a.status === 'passed').length;

  const exitSelect = () => {
    setSelectMode(false);
    setChecked([]);
    if (showHint) {
      localStorage.setItem(HINT_KEY, '1');
      setShowHint(false);
    }
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
    if (typeof filter !== 'number') return;
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

  // the filter dropdown lists the collections you're actively using first
  const dropdownCollections = useMemo(
    () =>
      [...collections].sort((a, b) =>
        (b.last_added_at ?? b.created_at ?? '').localeCompare(a.last_added_at ?? a.created_at ?? ''),
      ),
    [collections],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* everything scrolls together — the controls simply slide off the top,
          no animated collapse to glitch mid-scroll */}
      <div className={`flex-1 overflow-y-auto px-4 ${actionBarOpen ? 'pb-nav-stacked' : 'pb-nav'}`}>
      <div className="space-y-2 pt-1 pb-2">
        <div className="flex items-center gap-2">
          {/* the Passed/Selects slide is the page's main control — heavy on
              purpose; the filter row below is deliberately quieter */}
          <div ref={segRef} className="flex items-center bg-zinc-100 rounded-full p-1">
            {([
              ['passed', 'Passed', passedCount],
              ['liked', 'Selects', likedCount],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => { setSegment(key); exitSelect(); }}
                className={`flex items-center gap-1.5 py-2.5 rounded-full ${
                  key === 'passed'
                    ? `px-3.5 text-[13px] ${segment === key ? 'bg-white shadow-md text-zinc-700 font-semibold' : 'text-zinc-400'}`
                    : `px-5 text-[15px] ${segment === key ? 'bg-white shadow-md text-zinc-900 font-bold' : 'text-zinc-500 font-medium'}`
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center ${
                    segment === key && key === 'liked' ? 'bg-blue-900 text-white' : 'bg-zinc-200 text-zinc-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {segment === 'liked' && shown.length > 0 && !selectMode && (
            <button
              onClick={() => setExporting(true)}
              className="btn-export text-sm px-4 py-2 whitespace-nowrap shrink-0"
            >
              <FileDown className="w-4 h-4" />
              Export
            </button>
          )}
          {selectMode && shown.length > 0 && (
            <button
              onClick={() =>
                setChecked(checked.length === shown.length ? [] : shown.map((a) => a.id))
              }
              className="btn-quiet bg-transparent text-[13px] px-3.5 py-2 whitespace-nowrap shrink-0"
            >
              {checked.length === shown.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* dropdown + cog together span exactly the slide's width */}
          <div className="flex items-center gap-1.5" style={segWidth ? { width: segWidth } : undefined}>
            <select
              value={filter === 'all' ? '' : filter === 'none' ? 'none' : filter}
              onChange={(e) =>
                setFilter(e.target.value === '' ? 'all' : e.target.value === 'none' ? 'none' : Number(e.target.value))
              }
              className="flex-1 min-w-0 bg-transparent border border-zinc-200 text-zinc-500 text-[13px] rounded-full px-3 py-2 focus:outline-none"
            >
              <option value="">All collections</option>
              <option value="none">No collection</option>
              {dropdownCollections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              title="Manage collections"
              onClick={() => setManaging(true)}
              className="icon-btn bg-transparent border border-zinc-200 text-zinc-400"
            >
              <FolderCog className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => (selectMode ? exitSelect() : enterSelectMode())}
            className={`text-[13px] rounded-full px-3.5 py-2 border shrink-0 transition-colors ${selectMode ? 'bg-blue-900 text-white border-blue-900 font-semibold' : 'border-zinc-200 text-zinc-500'}`}
          >
            {selectMode ? 'Done' : 'Organize'}
          </button>
        </div>
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
                  className={`relative bg-white rounded-2xl overflow-hidden border ${
                    selectMode && isChecked ? 'border-blue-900 ring-2 ring-blue-900' : 'border-zinc-200'
                  }`}
                >
                  {selectMode && (
                    <span
                      className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                        isChecked ? 'bg-blue-900 border-blue-900 text-white' : 'bg-white/80 border-zinc-400 text-transparent'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  )}
                  <div className="bg-zinc-100">
                    {a.image_url ? (
                      <img crossOrigin="anonymous" src={mediaUrl(a.image_url)} alt={a.title} className="w-full h-auto" />
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
                    {a.gallery && (
                      <div className="text-[10px] text-zinc-400 truncate mt-0.5">{a.gallery}</div>
                    )}
                    {!selectMode && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <button title="Edit caption" onClick={(e) => { e.stopPropagation(); openEdit(a); }} className="icon-btn">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button title="Share" onClick={(e) => { e.stopPropagation(); shareArtwork(a); }} className="icon-btn">
                          <Share className="w-4 h-4" />
                        </button>
                        <button
                          title={segment === 'liked' ? 'Move to Passed' : 'Move to Selects'}
                          onClick={(e) => { e.stopPropagation(); swapOne(a); }}
                          className="icon-btn ml-auto"
                        >
                          <ArrowLeftRight className="w-4 h-4" />
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
      {actionBarOpen && showHint && nothingChecked && (
        <div className="glass absolute left-1/2 -translate-x-1/2 z-30 text-zinc-700 text-xs font-medium rounded-full px-4 py-2 whitespace-nowrap" style={{ bottom: 'calc(var(--actionbar-bottom) + 60px)' }}>
          Tap works to select them
        </div>
      )}
      {actionBarOpen && (
        // a second glass pill, identical material to the tab bar, stacked
        // directly above it — icon-only so everything fits without scrolling
        <div className="glass-bar h-[56px] px-2.5 flex items-center gap-2" style={{ bottom: 'var(--actionbar-bottom)' }}>
          <span className={`text-xs font-bold rounded-full min-w-[26px] h-[26px] px-1.5 flex items-center justify-center shrink-0 ${
            nothingChecked ? 'bg-zinc-900/[0.07] text-zinc-400' : 'bg-blue-900 text-white'
          }`}>
            {checked.length}
          </span>
          <span className="w-px self-stretch my-3 bg-zinc-900/10 shrink-0" />
          <div className="flex-1 flex items-center justify-evenly">
            <button
              aria-label="Add to collection"
              title="Add to collection"
              disabled={nothingChecked}
              onClick={() => setPicking(true)}
              className="icon-btn-accent"
            >
              <FolderPlus className="w-5 h-5" />
            </button>
            <button
              aria-label={segment === 'liked' ? 'Move to Passed' : 'Move to Selects'}
              title={segment === 'liked' ? 'Move to Passed' : 'Move to Selects'}
              disabled={nothingChecked}
              onClick={bulkSwap}
              className="icon-btn-glass"
            >
              <ArrowLeftRight className="w-5 h-5" />
            </button>
            <button
              aria-label="Back to the deck"
              title="Back to the deck"
              disabled={nothingChecked}
              onClick={bulkBackToDeck}
              className="icon-btn-glass"
            >
              <Layers className="w-5 h-5" />
            </button>
            {typeof filter === 'number' && (
              <button
                aria-label={`Remove from ${collectionName(filter)}`}
                title={`Remove from ${collectionName(filter)}`}
                disabled={nothingChecked}
                onClick={bulkRemoveFromCollection}
                className="icon-btn-danger"
              >
                <FolderMinus className="w-5 h-5" />
              </button>
            )}
            {segment === 'liked' && (
              <button
                aria-label="Export selection"
                title="Export selection"
                disabled={nothingChecked}
                onClick={() => setExportingChecked(true)}
                className="icon-btn-export"
              >
                <FileDown className="w-5 h-5" />
              </button>
            )}
          </div>
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
                className="field mt-1 w-full px-3 py-2 text-sm"
                value={(form[key] as string) ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <button onClick={saveEdit} className="btn-primary w-full py-3 mt-2">
            Save
          </button>
        </Sheet>
      )}

      {managing && (
        <CollectionPicker
          title="Collections"
          subtitle="Rename with the pencil. Tick collections with the dot to delete several at once — artworks are always kept."
          sortable
          manageMode
          collections={collections}
          selected={[]}
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
