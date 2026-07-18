import React, { useEffect, useState } from 'react';
import { Eye, Loader2, Sparkles, X } from 'lucide-react';
import { api, mediaUrl } from '../lib/api';
import type { AdvisorSettings } from '../types';

interface Props {
  onClose: () => void;
}

/** Everything about the advisor's account and house style. What is saved here
 *  prints on every exported client PDF — the export sheet only asks for
 *  per-client choices. */
export const SettingsSheet: React.FC<Props> = ({ onClose }) => {
  const [settings, setSettings] = useState<AdvisorSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => setNotice('Could not load settings.'));
  }, []);

  const set = <K extends keyof AdvisorSettings>(key: K, value: AdvisorSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setNotice('');
    try {
      const saved = await api.saveSettings({
        email: settings.email,
        advisory_name: settings.advisory_name,
        advisory_address: settings.advisory_address,
        align: settings.align,
        font: settings.font,
        image_scale: settings.image_scale,
        style_request: settings.style_request,
      });
      setSettings(saved);
      setNotice(saved.style_summary || 'Saved.');
    } catch {
      setNotice('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const res = await api.uploadAdvisoryLogo(file);
      setSettings((s) => (s ? { ...s, logo_media: res.logo_media, logo_url: res.logo_url } : s));
      setNotice('Logo saved — it will print on every export.');
    } catch {
      setNotice('Logo must be a PNG or JPEG.');
    }
  };

  const field = 'mt-1 w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-500';
  const chip = (on: boolean) =>
    `px-3.5 py-2 rounded-full text-sm border ${on ? 'bg-zinc-900 text-white border-zinc-900 font-medium' : 'border-zinc-300 text-zinc-600'}`;
  const label = 'text-xs font-semibold text-zinc-900 uppercase tracking-wide';

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[92vh] overflow-y-auto border border-zinc-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-zinc-900">Settings</h3>
          <button aria-label="Close" onClick={onClose} className="text-zinc-400 hover:text-zinc-900">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Your advisory's identity and house style. Everything here prints automatically on exported PDFs.
        </p>

        {!settings ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
        ) : (
          <>
            <div className={label}>Account</div>
            <label className="block mt-2 mb-4">
              <span className="text-xs text-zinc-500">Email (your login)</span>
              <input className={field} type="email" placeholder="you@advisory.com"
                     value={settings.email} onChange={(e) => set('email', e.target.value)} />
            </label>

            <div className={label}>Organization</div>
            <label className="block mt-2 mb-3">
              <span className="text-xs text-zinc-500">Advisory name</span>
              <input className={field} placeholder="e.g. Britt Art Advisory"
                     value={settings.advisory_name} onChange={(e) => set('advisory_name', e.target.value)} />
            </label>
            <label className="block mb-4">
              <span className="text-xs text-zinc-500">Address</span>
              <textarea className={field} rows={2} placeholder={'12 Rue de Seine\n75006 Paris'}
                        value={settings.advisory_address} onChange={(e) => set('advisory_address', e.target.value)} />
            </label>

            <div className={label}>Logo</div>
            <div className="mt-2 mb-4 flex items-center gap-3">
              {settings.logo_url ? (
                <img src={mediaUrl(settings.logo_url)} alt="advisory logo"
                     className="h-10 max-w-[130px] object-contain border border-zinc-200 rounded bg-white p-1" />
              ) : (
                <span className="text-xs text-zinc-400">No logo yet</span>
              )}
              <label className="ml-auto shrink-0 px-3.5 py-2 bg-zinc-100 border border-zinc-200 rounded-full text-sm text-zinc-700 cursor-pointer">
                {settings.logo_url ? 'Replace' : 'Upload'}
                <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
              </label>
            </div>

            <div className={label}>Layout</div>
            <div className="mt-2 mb-3 flex gap-2 flex-wrap">
              <button className={chip(settings.align === 'left')} onClick={() => set('align', 'left')}>Left aligned</button>
              <button className={chip(settings.align === 'center')} onClick={() => set('align', 'center')}>Centered</button>
              <button className={chip(settings.font === 'serif')} onClick={() => set('font', 'serif')}>Serif</button>
              <button className={chip(settings.font === 'sans')} onClick={() => set('font', 'sans')}>Sans</button>
            </div>
            <label className="block mb-4">
              <span className="text-xs text-zinc-500">Image size on the page</span>
              <input type="range" min={0.6} max={1.25} step={0.05} value={settings.image_scale}
                     onChange={(e) => set('image_scale', Number(e.target.value))}
                     className="w-full mt-2 accent-zinc-900" />
              <div className="flex justify-between text-[10px] text-zinc-400"><span>Intimate</span><span>Large</span></div>
            </label>

            <label className="block mb-4">
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Sparkles className="w-3.5 h-3.5" /> Describe your style in your own words — AI applies it
              </span>
              <textarea className={field} rows={2}
                        placeholder="e.g. everything centered, larger images, headings in deep green"
                        value={settings.style_request} onChange={(e) => set('style_request', e.target.value)} />
            </label>

            {notice && <p className="text-xs text-emerald-700 mb-3">{notice}</p>}

            <div className="flex gap-2">
              <button onClick={save} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 text-white font-semibold rounded-full py-3 hover:bg-zinc-700 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
              <button onClick={() => window.open(api.settingsPreviewUrl(), '_blank')}
                      className="flex items-center justify-center gap-2 px-4 bg-emerald-600 text-white font-semibold rounded-full py-3 hover:bg-emerald-500">
                <Eye className="w-4 h-4" /> Preview PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
