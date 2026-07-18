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
  last_added_at: string | null; // when works last went in — drives "recently used" sorting
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
  has_password: boolean;
  advisory_name: string;
  advisory_address: string;
  logo_media: string;
  logo_url: string | null;
  align: 'left' | 'center';
  font: string; // a key from font_options
  accent_hex: string;
  background_hex: string;
  text_hex: string;
  base_font_pt: number;
  heading_font_pt: number;
  image_scale: number;
  style_request: string;
  style_summary?: string;
  font_options?: Array<{ key: string; label: string }>;
}
