const runtimeOrigin =
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

export const SITE_NAME =
  import.meta.env.VITE_SITE_NAME || 'Intelligent Meeting Analyzer';
export const SITE_URL = (import.meta.env.VITE_SITE_URL || runtimeOrigin).replace(/\/$/, '');
export const DEFAULT_DESCRIPTION =
  'Intelligent Meeting Analyzer помогает командам расшифровывать встречи, структурировать решения и сохранять историю обсуждений в удобном формате.';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-cover.svg`;

export function toAbsoluteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}
