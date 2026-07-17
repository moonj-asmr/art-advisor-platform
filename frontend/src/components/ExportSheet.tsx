import React, { useState } from 'react';
import { FileDown, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Artwork, ExportOptions } from '../types';

interface Props {
  artworks: Artwork[];
  onClose: () => void;
}

/**
 * The "make it mine" panel: every advisor formats client PDFs differently,
 * so the export is driven by style options rather than a fixed template.
 */
export const ExportSheet: React.FC<Props> = ({ artworks, onClose }) => {
  const [opts, setOpts] = useState<ExportOptions>({
    title: '',
    client_name: '',
    advisor_name: '',
    align: 'left',
    image_scale: 1.0,
    show_price: true,
    show_gallery: true,
    show_description: false,
    font: 'serif',
    accent_hex: '#1a1a1a',
    logo_media: '',
    notes: {},
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [logoName, setLogoName] = useState('');

  const set = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { logo_media } = await api.uploadLogo(file);
      set('logo_media', logo_media);
      setLogoName(file.name);
    } catch (e) {
      setError('Logo upload failed');
    }
  };

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

  const field = 'mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500';
  const chip = (activeCond: boolean) =>
    `px-3 py-1.5 rounded-full text-sm border ${activeCond ? 'bg-white text-neutral-900 border-white font-medium' : 'border-neutral-700 text-neutral-300'}`;

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-neutral-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto border border-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-neutral-100">Export client PDF</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-neutral-500 mb-4">
          {artworks.length} work{artworks.length === 1 ? '' : 's'} · one per page, in your formatting — not the galleries'.
        </p>

        <label className="block mb-3">
          <span className="text-xs text-neutral-400">Title (cover & header)</span>
          <input className={field} placeholder="e.g. Art Basel — Selections" value={opts.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label className="block mb-3">
          <span className="text-xs text-neutral-400">Client name (personalizes the cover)</span>
          <input className={field} placeholder="e.g. Alice Chen" value={opts.client_name} onChange={(e) => set('client_name', e.target.value)} />
        </label>
        <label className="block mb-4">
          <span className="text-xs text-neutral-400">Your name / advisory (footer)</span>
          <input className={field} placeholder="e.g. Britt Art Advisory" value={opts.advisor_name} onChange={(e) => set('advisor_name', e.target.value)} />
        </label>

        <div className="mb-4">
          <span className="text-xs text-neutral-400 block mb-2">Layout</span>
          <div className="flex gap-2 flex-wrap">
            <button className={chip(opts.align === 'left')} onClick={() => set('align', 'left')}>Left aligned</button>
            <button className={chip(opts.align === 'center')} onClick={() => set('align', 'center')}>Centered</button>
            <button className={chip(opts.font === 'serif')} onClick={() => set('font', 'serif')}>Serif</button>
            <button className={chip(opts.font === 'sans')} onClick={() => set('font', 'sans')}>Sans</button>
          </div>
        </div>

        <label className="block mb-4">
          <span className="text-xs text-neutral-400">Image size</span>
          <input
            type="range" min={0.6} max={1.25} step={0.05} value={opts.image_scale}
            onChange={(e) => set('image_scale', Number(e.target.value))}
            className="w-full mt-2 accent-white"
          />
          <div className="flex justify-between text-[10px] text-neutral-500"><span>Intimate</span><span>Large</span></div>
        </label>

        <div className="mb-4 space-y-2">
          {([
            ['show_price', 'Show prices'],
            ['show_gallery', 'Show gallery names'],
            ['show_description', 'Include artist texts'],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={opts[k]} onChange={(e) => set(k, e.target.checked)} className="accent-white" />
              {label}
            </label>
          ))}
        </div>

        <label className="block mb-5">
          <span className="text-xs text-neutral-400">Your logo (appears on cover & each page)</span>
          <input type="file" accept="image/png,image/jpeg" onChange={(e) => onLogo(e.target.files?.[0])} className="mt-1 block w-full text-xs text-neutral-400 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-neutral-200" />
          {logoName && <span className="text-xs text-emerald-400">✓ {logoName}</span>}
        </label>

        {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}

        <button
          onClick={doExport}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-white text-neutral-900 font-semibold rounded-lg py-3 hover:bg-neutral-200 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {busy ? 'Building PDF…' : 'Download PDF'}
        </button>
      </div>
    </div>
  );
};
