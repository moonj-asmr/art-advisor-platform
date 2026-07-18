import React, { useState } from 'react';
import { RotateCcw, X, Heart } from 'lucide-react';
import { api } from '../lib/api';
import type { Artwork } from '../types';
import { SwipeCard } from './SwipeCard';

interface Props {
  pending: Artwork[];
  onDecided: (artwork: Artwork, decision: 'liked' | 'passed') => void;
  onUndo: (artwork: Artwork) => void;
  likedCount: number;
  allocation: number[]; // collections a right-swipe allocates into
  reviewingLabel?: string | null; // set when the deck is dealt from one PDF
  onClearReview?: () => void;
}

export const DeckView: React.FC<Props> = ({
  pending, onDecided, onUndo, likedCount, allocation, reviewingLabel, onClearReview,
}) => {
  const [history, setHistory] = useState<Artwork[]>([]);
  const top = pending[0];

  const reviewBanner = reviewingLabel && (
    <div className="flex justify-center pt-1">
      <button
        onClick={onClearReview}
        className="flex items-center gap-1.5 max-w-full bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-full pl-3 pr-2 py-1.5"
      >
        <span className="truncate">Reviewing: {reviewingLabel}</span>
        <X className="w-3.5 h-3.5 shrink-0" />
      </button>
    </div>
  );

  const decide = async (artwork: Artwork, decision: 'liked' | 'passed') => {
    setHistory((h) => [...h.slice(-19), artwork]);
    onDecided(artwork, decision); // optimistic
    try {
      await api.decide(artwork.id, decision, decision === 'liked' ? allocation : []);
    } catch {
      /* optimistic UI; a refresh re-syncs */
    }
  };

  const undo = async () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    onUndo(last);
    try {
      await api.decide(last.id, 'pending');
    } catch {
      /* ignore */
    }
  };

  if (!top) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {reviewBanner}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
        <div className="text-4xl">🎨</div>
        <h2 className="text-lg font-semibold text-zinc-900">Deck clear</h2>
        <p className="text-sm text-zinc-500 max-w-xs">
          {reviewingLabel
            ? 'You have been through every work in this PDF — tap the pill above to go back to the full deck.'
            : likedCount > 0
              ? `You have ${likedCount} work${likedCount === 1 ? '' : 's'} in your Library — refine them and export a client PDF.`
              : 'Upload a gallery PDF in the Inbox tab and the works will appear here to review.'}
        </p>
        {history.length > 0 && (
          <button onClick={undo} className="mt-2 flex items-center gap-2 text-sm text-zinc-600 border border-zinc-300 rounded-full px-4 py-2 hover:bg-zinc-50">
            <RotateCcw className="w-4 h-4" /> Undo last swipe
          </button>
        )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 pb-3 min-h-0">
      {reviewBanner}
      <div className="relative flex-1 min-h-0 my-2">
        {pending.slice(0, 4).map((artwork, i) => (
          <SwipeCard
            key={artwork.id}
            artwork={artwork}
            active={i === 0}
            stackIndex={i}
            onDecision={(d) => decide(artwork, d)}
          />
        ))}
      </div>
      <div className="flex items-center justify-center gap-5 py-1">
        <button
          aria-label="Pass"
          onClick={() => decide(top, 'passed')}
          className="w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center text-rose-500 hover:bg-zinc-200 active:scale-95 transition"
        >
          <X className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <button
          aria-label="Undo"
          onClick={undo}
          disabled={history.length === 0}
          className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center disabled:opacity-30 hover:bg-zinc-200 active:scale-95 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          aria-label="Select"
          onClick={() => decide(top, 'liked')}
          className="w-11 h-11 rounded-full bg-zinc-100 flex items-center justify-center text-emerald-500 hover:bg-zinc-200 active:scale-95 transition"
        >
          <Heart className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>
      <div className="text-center text-[11px] text-zinc-400 pb-1">{pending.length} to review</div>
    </div>
  );
};
