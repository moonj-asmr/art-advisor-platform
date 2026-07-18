import React, { useEffect, useState } from 'react';
import { Building2, ChevronRight, Eye, Loader2, Palette, Sparkles, User, X } from 'lucide-react';
import { api, mediaUrl } from '../lib/api';
import type { AdvisorSettings } from '../types';
import { Sheet } from './Sheet';

interface Props {
  onClose: () => void;
}

const USER_KEY = 'advisorydeck_user';

type Section = 'menu' | 'account' | 'profile' | 'style';

const SECTION_META: Record<Section, { title: string; subtitle?: string }> = {
  menu: { title: 'Settings', subtitle: 'Everything here prints automatically on exported PDFs.' },
  account: { title: 'Account' },
  profile: { title: 'Advisory profile', subtitle: 'Printed on the cover of every client PDF.' },
  style: { title: 'PDF style', subtitle: 'How your client PDFs are laid out.' },
};

/** Settings as a small sectioned menu — Account, Advisory profile, PDF style —
 *  so each screen stays short and there's room to grow at full release. */
export const SettingsSheet: React.FC<Props> = ({ onClose }) => {
  const [section, setSection] = useState<Section>('menu');
  const [settings, setSettings] = useState<AdvisorSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  // login: signed-in email is remembered on this device
  const [signedInAs, setSignedInAs] = useState<string | null>(() => localStorage.getItem(USER_KEY));
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  // preview shown in-app as page images — with a proper X to get out —
  // because Safari's own PDF view has no obvious way back
  const [previewPages, setPreviewPages] = useState<string[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setLoginEmail((prev) => prev || s.email);
    }).catch(() => setNotice('Could not load settings.'));
  }, []);

  const go = (s: Section) => {
    setNotice('');
    setSection(s);
  };

  const doLogin = async () => {
    setLoggingIn(true);
    setNotice('');
    try {
      const res = await api.login(loginEmail.trim(), loginPassword);
      localStorage.setItem(USER_KEY, res.email);
      setSignedInAs(res.email);
      setLoginPassword('');
      setSettings((s) => (s ? { ...s, email: res.email, has_password: true } : s));
      setNotice(res.created ? 'Login created — use it on your next visit.' : 'Logged in.');
    } catch {
      setNotice('Wrong email or password.');
    } finally {
      setLoggingIn(false);
    }
  };

  const doLogout = () => {
    localStorage.removeItem(USER_KEY);
    setSignedInAs(null);
    setNotice('Logged out.');
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setNotice('');
    try {
      const saved = await api.saveSettings({
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

  const openPreview = async () => {
    setPreviewLoading(true);
    setNotice('');
    try {
      const res = await api.settingsPreviewImages();
      setPreviewPages(res.pages);
    } catch {
      setNotice('Could not build the preview — try again.');
    } finally {
      setPreviewLoading(false);
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

  const set = <K extends keyof AdvisorSettings>(key: K, value: AdvisorSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  const field = 'mt-1 w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-500';
  const chip = (on: boolean) =>
    `px-3.5 py-2 rounded-full text-sm border ${on ? 'bg-zinc-900 text-white border-zinc-900 font-medium' : 'border-zinc-300 text-zinc-600'}`;
  const saveRow = (
    <div className="flex justify-end gap-2 mt-1">
      {section === 'style' && (
        <button onClick={openPreview} disabled={previewLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-full hover:bg-emerald-500 disabled:opacity-60">
          {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Preview PDF
        </button>
      )}
      <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-full hover:bg-zinc-700 disabled:opacity-60">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
      </button>
    </div>
  );

  const menuRow = (icon: React.ReactNode, title: string, sub: string, target: Section) => (
    <button
      onClick={() => go(target)}
      className="w-full flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3.5 text-left hover:bg-zinc-50"
    >
      <span className="text-zinc-500">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-900">{title}</span>
        <span className="block text-xs text-zinc-500 truncate">{sub}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
    </button>
  );

  const meta = SECTION_META[section];

  return (
    <>
      <Sheet
        title={meta.title}
        subtitle={meta.subtitle}
        onBack={section !== 'menu' ? () => go('menu') : undefined}
        onClose={onClose}
      >
        {!settings ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
        ) : section === 'menu' ? (
          <div className="space-y-2">
            {menuRow(<User className="w-5 h-5" />, 'Account',
              signedInAs || 'Log in or create your login', 'account')}
            {menuRow(<Building2 className="w-5 h-5" />, 'Advisory profile',
              settings.advisory_name || 'Name, address, logo', 'profile')}
            {menuRow(<Palette className="w-5 h-5" />, 'PDF style',
              'Layout, AI styling, preview', 'style')}
          </div>
        ) : section === 'account' ? (
          <>
            {signedInAs ? (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-900 truncate">{signedInAs}</div>
                  <div className="text-xs text-zinc-500">Logged in</div>
                </div>
                <button onClick={doLogout}
                        className="shrink-0 px-3.5 py-2 bg-zinc-100 border border-zinc-200 rounded-full text-sm text-zinc-700 hover:text-zinc-900">
                  Log out
                </button>
              </div>
            ) : (
              <>
                <label className="block mb-2">
                  <span className="text-xs text-zinc-500">Email</span>
                  <input className={field} type="email" autoComplete="email" placeholder="you@advisory.com"
                         value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </label>
                <label className="block mb-2">
                  <span className="text-xs text-zinc-500">Password</span>
                  <input className={field} type="password" autoComplete="current-password" placeholder="••••••••"
                         value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
                </label>
                <div className="flex items-center gap-2">
                  <button onClick={doLogin} disabled={loggingIn || !loginEmail.trim() || !loginPassword}
                          className="px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-full hover:bg-zinc-700 disabled:opacity-50">
                    {loggingIn ? 'Logging in…' : settings.has_password ? 'Log in' : 'Create login'}
                  </button>
                  {!settings.has_password && (
                    <span className="text-[11px] text-zinc-400">First time? This creates your login.</span>
                  )}
                </div>
              </>
            )}
            {notice && <p className="text-xs text-emerald-700 mt-3">{notice}</p>}
          </>
        ) : section === 'profile' ? (
          <>
            <label className="block mb-3">
              <span className="text-xs text-zinc-500">Advisory name</span>
              <input className={field} placeholder="e.g. Britt Art Advisory"
                     value={settings.advisory_name} onChange={(e) => set('advisory_name', e.target.value)} />
            </label>
            <label className="block mb-4">
              <span className="text-xs text-zinc-500">Address</span>
              <textarea className={field} rows={2} placeholder={'12 Rue de Seine\n75006 Paris'}
                        value={settings.advisory_address} onChange={(e) => set('advisory_address', e.target.value)} />
            </label>
            <div className="mb-4 flex items-center gap-3">
              {settings.logo_url ? (
                <img src={mediaUrl(settings.logo_url)} alt="advisory logo"
                     className="h-10 max-w-[130px] object-contain border border-zinc-200 rounded bg-white p-1" />
              ) : (
                <span className="text-xs text-zinc-400">No logo yet</span>
              )}
              <label className="ml-auto shrink-0 px-3.5 py-2 bg-zinc-100 border border-zinc-200 rounded-full text-sm text-zinc-700 cursor-pointer">
                {settings.logo_url ? 'Replace logo' : 'Upload logo'}
                <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
              </label>
            </div>
            {notice && <p className="text-xs text-emerald-700 mb-3">{notice}</p>}
            {saveRow}
          </>
        ) : (
          <>
            <div className="mb-3 flex gap-2 flex-wrap">
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
            {saveRow}
          </>
        )}
      </Sheet>

      {/* full-screen preview with an unmissable X — no swiping back required */}
      {previewPages && (
        <div className="fixed inset-0 z-50 bg-zinc-900/95 flex flex-col">
          <div
            className="shrink-0 flex items-center justify-between px-4 pb-2"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
          >
            <span className="text-white text-sm font-medium">Style preview</span>
            <button
              aria-label="Close preview"
              onClick={() => setPreviewPages(null)}
              className="p-2.5 rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto px-4 space-y-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}
          >
            {previewPages.map((src, i) => (
              <img key={i} src={src} alt={`Preview page ${i + 1}`} className="w-full rounded-lg shadow-lg" />
            ))}
          </div>
        </div>
      )}
    </>
  );
};
