import React, { useCallback, useEffect, useState } from 'react';
import { Heart, Inbox, Layers } from 'lucide-react';
import { api } from './lib/api';
import type { Artwork, Collection, UploadRecord } from './types';
import { DeckView } from './components/DeckView';
import { InboxView } from './components/InboxView';
import { SelectsView } from './components/SelectsView';

type Tab = 'deck' | 'selects' | 'inbox';

function App() {
  const [tab, setTab] = useState<Tab>('deck');
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [activeCollection, setActiveCollection] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [arts, cols, ups] = await Promise.all([
        api.artworks({ collection_id: activeCollection }),
        api.collections(),
        api.uploads(),
      ]);
      setArtworks(arts);
      setCollections(cols);
      setUploads(ups);
    } catch {
      /* backend not up yet */
    } finally {
      setLoaded(true);
    }
  }, [activeCollection]);

  useEffect(() => {
    reload();
  }, [reload]);

  const pending = artworks.filter((a) => a.status === 'pending');
  const liked = artworks.filter((a) => a.status === 'liked');

  // optimistic swipe updates so the deck never waits on the network
  const onDecided = (artwork: Artwork, decision: 'liked' | 'passed') =>
    setArtworks((arts) => arts.map((a) => (a.id === artwork.id ? { ...a, status: decision } : a)));
  const onUndo = (artwork: Artwork) =>
    setArtworks((arts) => arts.map((a) => (a.id === artwork.id ? { ...a, status: 'pending' } : a)));

  const createCollection = async (name: string) => {
    await api.createCollection(name);
    const cols = await api.collections();
    setCollections(cols);
    const created = cols.find((c) => c.name === name);
    if (created) setActiveCollection(created.id);
  };

  return (
    <div className="h-dvh bg-neutral-950 text-neutral-100 flex flex-col max-w-md mx-auto sm:border-x sm:border-neutral-800">
      {/* header: app name + collection scope */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <h1 className="font-semibold tracking-tight text-lg">Advisory<span className="text-neutral-500">Deck</span></h1>
        <select
          value={activeCollection ?? ''}
          onChange={(e) => setActiveCollection(e.target.value ? Number(e.target.value) : null)}
          className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-full px-3 py-1.5 focus:outline-none max-w-[55%]"
        >
          <option value="">All works</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </header>

      {/* body */}
      <main className="flex-1 flex flex-col min-h-0">
        {!loaded ? (
          <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">Loading…</div>
        ) : tab === 'deck' ? (
          <DeckView pending={pending} likedCount={liked.length} onDecided={onDecided} onUndo={onUndo} />
        ) : tab === 'selects' ? (
          <SelectsView liked={liked} onChanged={reload} />
        ) : (
          <InboxView
            uploads={uploads}
            collections={collections}
            activeCollection={activeCollection}
            onUploaded={reload}
            onCreateCollection={createCollection}
          />
        )}
      </main>

      {/* bottom tab bar */}
      <nav className="border-t border-neutral-800 bg-neutral-950 flex justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {([
          ['deck', Layers, 'Deck', pending.length],
          ['selects', Heart, 'Selects', liked.length],
          ['inbox', Inbox, 'Inbox', 0],
        ] as const).map(([key, Icon, label, badge]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex flex-col items-center gap-0.5 px-6 py-1 text-xs ${tab === key ? 'text-white' : 'text-neutral-500'}`}
          >
            <Icon className="w-5 h-5" />
            {label}
            {badge > 0 && (
              <span className="absolute -top-0.5 right-2.5 bg-white text-neutral-900 text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
