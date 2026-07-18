import type { AdvisorSettings, Artwork, Collection, ExportOptions, UploadRecord } from '../types';

const BASE = import.meta.env.VITE_API_URL || '';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  artworks: (params: { status?: string; collection_id?: number | null } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.collection_id != null) q.set('collection_id', String(params.collection_id));
    return fetch(`${BASE}/api/artworks?${q}`).then((r) => json<Artwork[]>(r));
  },

  decide: (id: number, decision: 'liked' | 'passed' | 'pending', collectionIds: number[] = []) =>
    fetch(`${BASE}/api/artworks/${id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, collection_ids: collectionIds }),
    }).then((r) => json<Artwork>(r)),

  bulkCollections: (artworkIds: number[], collectionId: number, action: 'add' | 'remove') =>
    fetch(`${BASE}/api/artworks/bulk/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artwork_ids: artworkIds, collection_id: collectionId, action }),
    }).then((r) => json(r)),

  bulkStatus: (artworkIds: number[], status: 'liked' | 'passed' | 'pending') =>
    fetch(`${BASE}/api/artworks/bulk/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artwork_ids: artworkIds, status }),
    }).then((r) => json(r)),

  updateArtwork: (id: number, patch: Partial<Artwork>) =>
    fetch(`${BASE}/api/artworks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json<Artwork>(r)),

  deleteArtwork: (id: number) =>
    fetch(`${BASE}/api/artworks/${id}`, { method: 'DELETE' }).then((r) => json(r)),

  collections: () => fetch(`${BASE}/api/collections`).then((r) => json<Collection[]>(r)),

  createCollection: (name: string) =>
    fetch(`${BASE}/api/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((r) => json<{ id: number; name: string }>(r)),

  renameCollection: (id: number, name: string) =>
    fetch(`${BASE}/api/collections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((r) => json(r)),

  deleteCollection: (id: number) =>
    fetch(`${BASE}/api/collections/${id}`, { method: 'DELETE' }).then((r) => json(r)),

  uploads: () => fetch(`${BASE}/api/uploads`).then((r) => json<UploadRecord[]>(r)),

  updateUploadGallery: (id: number, gallery: string) =>
    fetch(`${BASE}/api/uploads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gallery }),
    }).then((r) => json(r)),

  deleteUpload: (id: number) =>
    fetch(`${BASE}/api/uploads/${id}`, { method: 'DELETE' }).then((r) => json(r)),

  uploadPdf: (file: File, collectionId: number | null, gallery: string) => {
    const form = new FormData();
    form.append('file', file);
    if (collectionId != null) form.append('collection_id', String(collectionId));
    if (gallery) form.append('gallery', gallery);
    return fetch(`${BASE}/api/uploads`, { method: 'POST', body: form }).then((r) =>
      json<{ upload_id: number; status: 'processing' }>(r),
    );
  },

  getSettings: () => fetch(`${BASE}/api/settings`).then((r) => json<AdvisorSettings>(r)),

  saveSettings: (patch: Partial<AdvisorSettings>) =>
    fetch(`${BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json<AdvisorSettings>(r)),

  uploadAdvisoryLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/api/settings/logo`, { method: 'POST', body: form }).then((r) =>
      json<{ logo_media: string; logo_url: string }>(r),
    );
  },

  settingsPreviewUrl: () => `${BASE}/api/settings/preview`,

  exportPdf: async (artworkIds: number[], opts: ExportOptions): Promise<Blob> => {
    const res = await fetch(`${BASE}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artwork_ids: artworkIds, ...opts }),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Export failed'));
    return res.blob();
  },
};

export const mediaUrl = (path: string | null) => (path ? `${BASE}${path}` : '');
