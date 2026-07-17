import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Heart, Inbox, Layers } from 'lucide-react';
import { api } from './lib/api';
import type { Artwork, Collection, UploadRecord } from './types';
import { CollectionPicker } from './components/CollectionPicker';
import { DeckView } from './components/DeckView';
import { InboxView } from './components/InboxView';
import { LibraryView } from './components/LibraryView';

type Tab = 'deck' | 'library' | 'inbox';

function App() {
  const [tab, setTab] = useState<Tab>('deck');
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  // collections that right-swipes are allocated into right now
  const [allocation, setAllocation] = useState<number[]>([]);
  const [pickingAllocation, setPickingAllocation] = useState(false);
  const [loaded, setLoaded] = useState(false);

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

  const allocationLabel =
    allocation.length === 0
      ? 'General'
      : collections
          .filter((c) => allocation.includes(c.id))
          .map((c) => c.name)
          .join(', ');

  return (
    <div className="h-dvh bg-white text-zinc-900 flex flex-col max-w-md mx-auto sm:border-x sm:border-zinc-200 relative">
      {/* header: app name + (on deck) where right-swipes are going */}
      <header
        className="px-4 pb-2 flex items-center justify-between gap-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}
      >
        <h1 className="font-semibold tracking-tight text-lg">Advisory<span className="text-zinc-400">Deck</span></h1>
        {tab === 'deck' && (
          <button
            onClick={() => setPickingAllocation(true)}
            className="flex items-center gap-1 bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs rounded-full pl-3 pr-2 py-1.5 max-w-[58%]"
          >
            <span className="truncate">Selecting for: <span className="text-zinc-900 font-medium">{allocationLabel}</span></span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}
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
          />
        ) : (
          <InboxView uploads={uploads} onUploaded={reload} />
        )}
      </main>

      {/* bottom tab bar */}
      <nav className="border-t border-zinc-200 bg-white flex justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {([
          ['deck', Layers, 'Deck', pending.length],
          ['library', Heart, 'Library', likedCount],
          ['inbox', Inbox, 'Inbox', 0],
        ] as const).map(([key, Icon, label, badge]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex flex-col items-center gap-0.5 px-6 py-1 text-xs ${tab === key ? 'text-zinc-900' : 'text-zinc-400'}`}
          >
            <Icon className="w-5 h-5" />
            {label}
            {badge > 0 && (
              <span className="absolute -top-0.5 right-2.5 bg-zinc-900 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {pickingAllocation && (
        <CollectionPicker
          title="Selecting for…"
          subtitle="Right-swipes are allocated into these collections. Leave everything unticked for a general selection — you can always allocate later in the Library."
          collections={collections}
          selected={allocation}
          confirmLabel="Done"
          onConfirm={(ids) => {
            setAllocation(ids);
            setPickingAllocation(false);
          }}
          onCreate={createCollection}
          onClose={() => setPickingAllocation(false)}
        />
      )}
    </div>
  );
}

export default App;
