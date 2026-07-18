export interface Artwork {
  id: number;
  upload_id: number;
  collection_id: number | null;
  artist: string;
  title: string;
  year: string;
  medium: string;
  dimensions: string;
  price: string;
  edition: string;
  gallery: string;
  description: string;
  image_url: string | null;
  detail_image_urls: string[];
  pages: number[];
  status: 'pending' | 'liked' | 'passed';
  position: number;
  collection_ids: number[];
}

export interface Collection {
  id: number;
  name: string;
  created_at: string | null;
  counts: { pending: number; liked: number; passed: number };
  total: number;
}

export interface UploadRecord {
  id: number;
  filename: string;
  gallery: string;
  page_count: number;
  collection_id: number | null;
  artwork_count: number;
  status: 'processing' | 'done' | 'failed';
  created_at: string | null;
}

export interface ExportOptions {
  title: string;
  client_name: string;
  show_price: boolean;
  show_gallery: boolean;
  show_description: boolean;
  notes: Record<string, string>;
}

export interface AdvisorSettings {
  email: string;
  advisory_name: string;
  advisory_address: string;
  logo_media: string;
  logo_url: string | null;
  align: 'left' | 'center';
  font: 'serif' | 'sans';
  accent_hex: string;
  image_scale: number;
  style_request: string;
  style_summary?: string;
}
