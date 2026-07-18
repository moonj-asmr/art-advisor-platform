import React, { useState } from 'react';
import { FileDown, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Artwork, ExportOptions } from '../types';

interface Props {
  artworks: Artwork[];
  onClose: () => void;
}

/** Per-client export choices only. The advisory identity, logo, and layout
 *  come from Settings (gear icon on the Inbox tab) and print automatically. */
export const ExportSheet: React.FC<Props> = ({ artworks, onClose }) => {
  const [opts, setOpts] = useState<ExportOptions>({
    title: '',
    client_name: '',
    show_price: true,
    show_gallery: true,
    notes: {},
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  const doExport = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await api.exportPdf(
        artworks.map((a) => a.id),
        opts,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(opts.title || 'selection').replace(/\s+/g, '-').toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const field = 'mt-1 w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-500';

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto border border-zinc-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-zinc-900">Export client PDF</h3>
          <button aria-label="Close" onClick={onClose} className="text-zinc-400 hover:text-zinc-900">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          {artworks.length} work{artworks.length === 1 ? '' : 's'} · one per page. Your advisory name,
          logo and layout come from Settings.
        </p>

        <label className="block mb-3">
          <span className="text-xs text-zinc-500">Title (cover & header)</span>
          <input className={field} placeholder="e.g. Art Basel — Selections" value={opts.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label className="block mb-4">
          <span className="text-xs text-zinc-500">Client name (personalizes the cover)</span>
          <input className={field} placeholder="e.g. Alice Chen" value={opts.client_name} onChange={(e) => set('client_name', e.target.value)} />
        </label>

        <div className="mb-5 space-y-2">
          {([
            ['show_price', 'Show prices'],
            ['show_gallery', 'Show gallery names'],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={opts[k]} onChange={(e) => set(k, e.target.checked)} className="accent-zinc-900" />
              {label}
            </label>
          ))}
        </div>

        {error && <div className="text-xs text-rose-500 mb-3">{error}</div>}

        <button
          onClick={doExport}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold rounded-full py-3 hover:bg-emerald-500 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {busy ? 'Building PDF…' : 'Download PDF'}
        </button>
      </div>
    </div>
  );
};
