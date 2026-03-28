export interface ExternalResourceItem {
  id: string;
  title: string;
  authors: string[];
  description?: string | null;
  resource_url: string;
  thumbnail_url?: string | null;
  published_date?: string | null;
  categories: string[];
  source: string;
}

export interface ExternalResourceResponse {
  query: string;
  items: ExternalResourceItem[];
  total: number;
  source: string;
  cached: boolean;
  fetched_at: string;
}
