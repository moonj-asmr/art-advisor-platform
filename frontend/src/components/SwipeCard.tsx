import React, { useRef, useState } from 'react';
import { mediaUrl } from '../lib/api';
import type { Artwork } from '../types';

interface Props {
  artwork: Artwork;
  active: boolean;
  stackIndex: number; // 0 = top of deck
  onDecision: (decision: 'liked' | 'passed') => void;
}

const SWIPE_THRESHOLD = 90;

export const SwipeCard: React.FC<Props> = ({ artwork, active, stackIndex, onDecision }) => {
  const [drag, setDrag] = useState({ x: 0, y: 0, dragging: false });
  const [leaving, setLeaving] = useState<null | 'liked' | 'passed'>(null);
  const [showDetails, setShowDetails] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active || leaving) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    setDrag((d) => ({ ...d, dragging: true }));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || leaving) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (Math.abs(x) + Math.abs(y) > 6) moved.current = true;
    setDrag({ x, y, dragging: true });
  };

  const settle = () => {
    start.current = null;
    setDrag({ x: 0, y: 0, dragging: false });
  };

  const fling = (decision: 'liked' | 'passed') => {
    setLeaving(decision);
    setTimeout(() => onDecision(decision), 260);
  };

  const onPointerUp = () => {
    if (!start.current || leaving) return;
    const { x } = drag;
    if (x > SWIPE_THRESHOLD) fling('liked');
    else if (x < -SWIPE_THRESHOLD) fling('passed');
    else {
      if (!moved.current) setShowDetails((s) => !s);
      settle();
    }
    start.current = null;
    if (!leaving) setDrag((d) => ({ ...d, dragging: false }));
  };

  const x = leaving === 'liked' ? window.innerWidth : leaving === 'passed' ? -window.innerWidth : drag.x;
  const y = leaving ? drag.y - 40 : drag.y;
  const rotation = (x / 18) * (leaving ? 1.4 : 1);
  const likeOpacity = Math.max(0, Math.min(1, x / SWIPE_THRESHOLD));
  const passOpacity = Math.max(0, Math.min(1, -x / SWIPE_THRESHOLD));

  const stackOffset = active ? 0 : Math.min(stackIndex, 2) * 10;
  const stackScale = active ? 1 : 1 - Math.min(stackIndex, 2) * 0.035;

  return (
    <div
      className="absolute inset-0 select-none touch-none"
      style={{
        transform: `translate(${x}px, ${y + stackOffset}px) rotate(${active ? rotation : 0}deg) scale(${stackScale})`,
        transition: drag.dragging ? 'none' : 'transform 0.28s cubic-bezier(.2,.8,.3,1)',
        zIndex: 50 - stackIndex,
        pointerEvents: active ? 'auto' : 'none',
        opacity: stackIndex > 2 ? 0 : 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={settle}
    >
      <div className="w-full h-full bg-white rounded-2xl border border-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col relative">
        {/* decision stamps */}
        <div
          className="absolute top-6 left-5 z-10 border-4 border-emerald-500 text-emerald-500 rounded-lg px-3 py-1 text-2xl font-extrabold tracking-widest rotate-[-14deg]"
          style={{ opacity: likeOpacity }}
        >
          SELECT
        </div>
        <div
          className="absolute top-6 right-5 z-10 border-4 border-rose-500 text-rose-500 rounded-lg px-3 py-1 text-2xl font-extrabold tracking-widest rotate-[14deg]"
          style={{ opacity: passOpacity }}
        >
          PASS
        </div>

        {showDetails ? (
          <div className="flex-1 overflow-y-auto p-5 bg-white text-zinc-800">
            <div className="text-lg font-semibold text-zinc-900">{artwork.artist || 'Unknown artist'}</div>
            <div className="italic text-zinc-500 mb-3">
              {artwork.title}
              {artwork.year ? `, ${artwork.year}` : ''}
            </div>
            <dl className="text-sm space-y-1.5 mb-4">
              {artwork.medium && <div>{artwork.medium}</div>}
              {artwork.dimensions && <div>{artwork.dimensions}</div>}
              {artwork.edition && <div>{artwork.edition}</div>}
              {artwork.gallery && <div className="text-zinc-500">{artwork.gallery}</div>}
              {artwork.price && <div className="font-semibold text-base pt-1 text-zinc-900">{artwork.price}</div>}
            </dl>
            {artwork.detail_image_urls.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {artwork.detail_image_urls.map((u) => (
                  <img key={u} src={mediaUrl(u)} className="rounded-lg w-full object-cover" draggable={false} />
                ))}
              </div>
            )}
            {artwork.description && (
              <p className="text-sm text-zinc-600 whitespace-pre-line leading-relaxed">{artwork.description}</p>
            )}
            <p className="text-xs text-zinc-400 mt-4">Tap card to flip back · PDF pages {artwork.pages.join(', ')}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 bg-zinc-50 overflow-hidden flex items-center justify-center">
              {artwork.image_url ? (
                <img
                  src={mediaUrl(artwork.image_url)}
                  alt={artwork.title}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="text-zinc-400 text-sm">No image extracted</div>
              )}
            </div>
            <div className="p-4 bg-white border-t border-zinc-100">
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-semibold text-zinc-900 truncate">{artwork.artist || 'Unknown artist'}</div>
                {artwork.price && <div className="font-semibold text-zinc-900 whitespace-nowrap">{artwork.price}</div>}
              </div>
              <div className="italic text-sm text-zinc-500 truncate">
                {artwork.title}
                {artwork.year ? `, ${artwork.year}` : ''}
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="text-xs text-zinc-400 truncate">{artwork.gallery}</div>
                {(artwork.detail_image_urls.length > 0 || artwork.description) && (
                  <div className="text-xs text-zinc-400 whitespace-nowrap ml-2">tap for details</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
