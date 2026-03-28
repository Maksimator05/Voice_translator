import { useEffect } from 'react';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, toAbsoluteUrl } from '../../config/site';

type StructuredData = Record<string, unknown> | Array<Record<string, unknown>>;

interface SeoHeadProps {
  title: string;
  description?: string;
  canonicalPath: string;
  robots?: string;
  image?: string;
  openGraphType?: string;
  structuredData?: StructuredData;
}

const META_TAG_KEYS = [
  ['name', 'description'],
  ['name', 'robots'],
  ['property', 'og:title'],
  ['property', 'og:description'],
  ['property', 'og:type'],
  ['property', 'og:url'],
  ['property', 'og:image'],
  ['name', 'twitter:card'],
  ['name', 'twitter:title'],
  ['name', 'twitter:description'],
  ['name', 'twitter:image'],
] as const;

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }

  link.setAttribute('href', href);
}

export function SeoHead({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  robots = 'index,follow',
  image = DEFAULT_OG_IMAGE,
  openGraphType = 'website',
  structuredData,
}: SeoHeadProps) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonicalUrl = toAbsoluteUrl(canonicalPath);

    document.title = fullTitle;
    upsertCanonical(canonicalUrl);

    const metaContent: Record<string, string> = {
      description,
      robots,
      'og:title': fullTitle,
      'og:description': description,
      'og:type': openGraphType,
      'og:url': canonicalUrl,
      'og:image': image,
      'twitter:card': 'summary_large_image',
      'twitter:title': fullTitle,
      'twitter:description': description,
      'twitter:image': image,
    };

    META_TAG_KEYS.forEach(([attribute, key]) => {
      upsertMeta(attribute, key, metaContent[key]);
    });

    const existingScript = document.getElementById('seo-structured-data');
    if (existingScript) {
      existingScript.remove();
    }

    if (structuredData) {
      const script = document.createElement('script');
      script.id = 'seo-structured-data';
      script.type = 'application/ld+json';
      script.text = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [canonicalPath, description, image, openGraphType, robots, structuredData, title]);

  return null;
}

export default SeoHead;
