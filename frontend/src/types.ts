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
  created_at: string | null;
}

export interface ExportOptions {
  title: string;
  client_name: string;
  advisor_name: string;
  align: 'left' | 'center';
  image_scale: number;
  show_price: boolean;
  show_gallery: boolean;
  show_description: boolean;
  font: 'serif' | 'sans';
  accent_hex: string;
  logo_media: string;
  notes: Record<string, string>;
}
