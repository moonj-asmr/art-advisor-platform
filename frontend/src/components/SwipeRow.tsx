import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

/** iOS-style swipe-left-to-delete row — used for PDF rows and collections. */
export const SwipeRow: React.FC<{ onDelete: () => void; children: React.ReactNode }> = ({ onDelete, children }) => {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const start = useRef<number | null>(null);
  const dragging = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    start.current = e.clientX;
    dragging.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (start.current == null) return;
    const delta = e.clientX - start.current + (open ? -80 : 0);
    if (Math.abs(delta) > 6) dragging.current = true;
    setDx(Math.max(-96, Math.min(0, delta)));
  };
  const onPointerUp = () => {
    if (start.current == null) return;
    start.current = null;
    if (dx < -48) {
      setOpen(true);
      setDx(-80);
    } else {
      setOpen(false);
      setDx(0);
    }
  };
  const closeIfOpen = () => {
    if (open && !dragging.current) {
      setOpen(false);
      setDx(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <button
        onClick={onDelete}
        className="absolute inset-y-0 right-0 w-20 bg-rose-500 text-white flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
      <div
        className="relative bg-white touch-pan-y"
        style={{ transform: `translateX(${dx}px)`, transition: start.current == null ? 'transform .2s ease' : 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={closeIfOpen}
      >
        {children}
      </div>
    </div>
  );
};
