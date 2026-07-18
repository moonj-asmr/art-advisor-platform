import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Heart, Inbox, Layers, Settings } from 'lucide-react';
import { api } from './lib/api';
import type { Artwork, Collection, UploadRecord } from './types';
import { CollectionPicker } from './components/CollectionPicker';
import { DeckView } from './components/DeckView';
import { InboxView } from './components/InboxView';
import { LibraryView } from './components/LibraryView';
import { SettingsSheet } from './components/SettingsSheet';

type Tab = 'deck' | 'library' | 'inbox';

function App() {
  const [tab, setTab] = useState<Tab>('deck');
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  // collections that right-swipes are allocated into right now
  const [allocation, setAllocation] = useState<number[]>([]);
  const [pickingAllocation, setPickingAllocation] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // floating nav hides on scroll-down, jogs back on scroll-up
  const [navVisible, setNavVisible] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [arts, cols, ups] = await Promise.all([api.artworks(), api.collections(), api.uploads()]);
      setArtworks(arts);
      setCollections(cols);
      setUploads(ups);
    } catch {
      /* backend not up yet */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // while any PDF is still being read by the AI, keep the app in sync —
  // regardless of which tab the advisor is on
  const anyProcessing = uploads.some((u) => u.status === 'processing');
  useEffect(() => {
    if (!anyProcessing) return;
    const timer = setInterval(reload, 3500);
    return () => clearInterval(timer);
  }, [anyProcessing, reload]);

  useEffect(() => {
    setNavVisible(true); // switching tabs always brings the nav back
  }, [tab]);

  const pending = artworks.filter((a) => a.status === 'pending');
  const decided = artworks.filter((a) => a.status !== 'pending');
  const likedCount = artworks.filter((a) => a.status === 'liked').length;

  // optimistic swipe updates so the deck never waits on the network
  const onDecided = (artwork: Artwork, decision: 'liked' | 'passed') =>
    setArtworks((arts) =>
      arts.map((a) =>
        a.id === artwork.id
          ? {
              ...a,
              status: decision,
              collection_ids:
                decision === 'liked'
                  ? Array.from(new Set([...a.collection_ids, ...allocation]))
                  : a.collection_ids,
            }
          : a,
      ),
    );
  const onUndo = (artwork: Artwork) =>
    setArtworks((arts) => arts.map((a) => (a.id === artwork.id ? { ...a, status: 'pending' } : a)));

  const createCollection = async (name: string) => {
    await api.createCollection(name);
    setCollections(await api.collections());
  };
  const renameCollection = async (id: number, name: string) => {
    await api.renameCollection(id, name);
    setCollections(await api.collections());
  };
  const deleteCollection = async (id: number) => {
    await api.deleteCollection(id);
    setAllocation((a) => a.filter((x) => x !== id));
    await reload();
  };

  const allocationLabel =
    allocation.length === 0
      ? 'General'
      : collections
          .filter((c) => allocation.includes(c.id))
          .map((c) => c.name)
          .join(', ');

  return (
    <div className="h-full bg-white text-zinc-900 flex flex-col max-w-md mx-auto sm:border-x sm:border-zinc-200 relative overflow-hidden">
      {/* header: app name + (on deck) where right-swipes are going */}
      <header className="px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}>
        {/* fixed-height row so the wordmark sits identically on every tab */}
        <div className="h-10 flex items-center justify-between gap-3">
          <h1 className="font-serif font-semibold tracking-tight text-xl leading-none text-zinc-950">Advisory<span className="text-blue-900">Deck</span></h1>
          {tab === 'deck' && (
            <button
              onClick={() => setPickingAllocation(true)}
              className="flex items-center gap-1.5 bg-zinc-100 border border-zinc-200 text-zinc-600 text-sm rounded-full pl-4 pr-2.5 py-2 max-w-[58%]"
            >
              <span className="truncate">Selecting for: <span className="text-zinc-900 font-medium">{allocationLabel}</span></span>
              <ChevronDown className="w-4 h-4 shrink-0" />
            </button>
          )}
          {tab === 'inbox' && (
            <button
              aria-label="Settings"
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 hover:text-zinc-900"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="h-2" />
      </header>

      {/* body */}
      <main className="flex-1 flex flex-col min-h-0">
        {!loaded ? (
          <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">Loading…</div>
        ) : tab === 'deck' ? (
          <DeckView
            pending={pending}
            likedCount={likedCount}
            allocation={allocation}
            onDecided={onDecided}
            onUndo={onUndo}
          />
        ) : tab === 'library' ? (
          <LibraryView
            artworks={decided}
            collections={collections}
            onChanged={reload}
            onCreateCollection={createCollection}
            onRenameCollection={renameCollection}
            onDeleteCollection={deleteCollection}
            onNavVisible={setNavVisible}
          />
        ) : (
          <InboxView uploads={uploads} onUploaded={reload} onNavVisible={setNavVisible} />
        )}
      </main>

      {/* floating lozenge nav — full card width, fixed height shared with the
          Library's select-mode action bar so the two swap without jumping */}
      <nav
        className={`absolute left-4 right-4 z-30 h-[52px] flex items-center gap-1 bg-white/90 backdrop-blur border border-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.14)] rounded-full px-1.5 transition-all duration-300 ${
          navVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          bottom: 'max(env(safe-area-inset-bottom), 0.9rem)',
          transform: `translateY(${navVisible ? '0' : '6rem'})`,
        }}
      >
        {([
          ['deck', Layers, 'Deck', pending.length],
          ['library', Heart, 'Library', likedCount],
          ['inbox', Inbox, 'Inbox', 0],
        ] as const).map(([key, Icon, label, badge]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex-1 h-[40px] flex items-center justify-center gap-1.5 text-xs rounded-full ${
              tab === key ? 'bg-zinc-900 text-white font-medium' : 'text-zinc-500'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge > 0 && (
              <span className={`text-[10px] font-bold rounded-full min-w-[15px] h-[15px] px-1 flex items-center justify-center ${
                tab === key ? 'bg-white text-zinc-900' : 'bg-zinc-200 text-zinc-700'
              }`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}

      {pickingAllocation && (
        <CollectionPicker
          title="Selecting for…"
          subtitle="Right-swipes are allocated into the ticked collections — or into General, your unfiled selection. You can always re-allocate later in the Library."
          collections={collections}
          selected={allocation}
          includeGeneral
          confirmLabel="Done"
          onConfirm={(ids) => {
            setAllocation(ids);
            setPickingAllocation(false);
          }}
          onCreate={createCollection}
          onRename={renameCollection}
          onDelete={deleteCollection}
          onClose={() => setPickingAllocation(false)}
        />
      )}
    </div>
  );
}

export default App;
