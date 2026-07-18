import React, { useRef, useState } from 'react';
import { Check, FileText, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { api } from '../lib/api';
import type { UploadRecord } from '../types';

interface Props {
  uploads: UploadRecord[];
  onUploaded: () => void;
  onNavVisible: (visible: boolean) => void;
}

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** iOS-style swipe-left-to-delete row. */
const SwipeRow: React.FC<{ onDelete: () => void; children: React.ReactNode }> = ({ onDelete, children }) => {
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

export const InboxView: React.FC<Props> = ({ uploads, onUploaded, onNavVisible }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editGallery, setEditGallery] = useState('');
  const lastY = useRef(0);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    if (y < 24) onNavVisible(true);
    else if (y - lastY.current > 6) onNavVisible(false);
    else if (lastY.current - y > 6) onNavVisible(true);
    lastY.current = y;
  };

  const handleFiles = async (files: FileList | File[]) => {
    setBusy(true);
    setMessage('');
    let found = 0;
    let failed = 0;
    let aiUsed = false;
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;
      try {
        const res = await api.uploadPdf(file, null, '');
        found += res.artworks_found;
        if (res.engine === 'ai') aiUsed = true;
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    const how = aiUsed ? 'read by AI' : 'extracted';
    setMessage(failed ? `Some uploads failed. ${found} artworks ${how}.` : `${found} artworks ${how} — they're in your deck.`);
    onUploaded();
  };

  const removeUpload = async (u: UploadRecord) => {
    await api.deleteUpload(u.id);
    onUploaded();
  };

  const startEdit = (u: UploadRecord) => {
    setEditingId(u.id);
    setEditGallery(u.gallery);
  };
  const saveEdit = async () => {
    if (editingId == null) return;
    await api.updateUploadGallery(editingId, editGallery);
    setEditingId(null);
    onUploaded();
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-28 pt-2" onScroll={onScroll}>
      {/* upload zone — compact */}
      <div
        className={`border-2 border-dashed rounded-2xl px-5 py-5 flex items-center gap-4 transition-colors ${
          dragOver ? 'border-zinc-500 bg-zinc-100' : 'border-zinc-300 bg-zinc-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        {busy ? (
          <>
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin shrink-0" />
            <p className="text-sm text-zinc-600">Reading the PDF with AI — this can take a minute or two…</p>
          </>
        ) : (
          <>
            <div className="rounded-full bg-zinc-200 p-2.5 shrink-0">
              <Upload className="w-5 h-5 text-zinc-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-900">Drop gallery PDFs here</p>
              <p className="text-xs text-zinc-500">They land in your deck, ready to swipe.</p>
            </div>
            <button onClick={() => inputRef.current?.click()} className="shrink-0 px-3.5 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-full hover:bg-zinc-700">
              Choose
            </button>
            <input ref={inputRef} type="file" accept="application/pdf" multiple hidden onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          </>
        )}
      </div>
      {message && <p className="text-xs text-emerald-600 mt-2 text-center">{message}</p>}

      {/* processed PDFs */}
      <div className="mt-5">
        <h3 className="text-sm font-semibold text-zinc-900 mb-2">Processed PDFs</h3>
        {uploads.length === 0 ? (
          <p className="text-xs text-zinc-500">Nothing yet.</p>
        ) : (
          <div className="space-y-2">
            {uploads.map((u) => (
              <SwipeRow key={u.id} onDelete={() => removeUpload(u)}>
                <div className="flex items-center gap-3 border border-zinc-200 rounded-xl px-4 py-3 bg-white select-none">
                  <FileText className="w-5 h-5 text-zinc-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-zinc-900 truncate">{u.filename}</div>
                    {editingId === u.id ? (
                      <div className="flex items-center gap-1.5 mt-1" onPointerDown={(e) => e.stopPropagation()}>
                        <input
                          value={editGallery}
                          onChange={(e) => setEditGallery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                          autoFocus
                          className="flex-1 min-w-0 bg-white border border-zinc-300 rounded-md px-2 py-1 text-xs text-zinc-900 focus:outline-none focus:border-zinc-500"
                        />
                        <button onClick={saveEdit} className="p-1.5 rounded-md bg-zinc-900 text-white">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500 truncate">
                        {u.gallery || 'Unknown gallery'} · {formatDate(u.created_at)} · {u.page_count} pages → {u.artwork_count} works
                      </div>
                    )}
                  </div>
                  {editingId !== u.id && (
                    <button
                      title="Edit gallery name"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => startEdit(u)}
                      className="p-1.5 rounded-md bg-zinc-100 text-zinc-500 hover:text-zinc-900 shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </SwipeRow>
            ))}
          </div>
        )}
        {uploads.length > 0 && (
          <p className="text-[11px] text-zinc-400 mt-3">
            Swipe a PDF left to delete it — this removes its artworks from the deck and library too.
            The pencil corrects the gallery name across all of its works.
          </p>
        )}
      </div>
    </div>
  );
};
