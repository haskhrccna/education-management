import { Platform } from 'react-native';

export const TOTAL_MUSHAF_PAGES = 604;

// The Mushaf pages are served as static images by the API, one WebP per page,
// under /mushaf-pages/<page>.webp (see packages/server/scripts/extract_mushaf_pages.py).
// The API base ends in /api/v1; the image host is the same origin without it.
function getImageOrigin(): string {
  const base =
    process.env.EXPO_PUBLIC_API_URL ??
    (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api/v1' : 'http://localhost:4000/api/v1');
  return base.replace(/\/api\/v1\/?$/, '');
}

export const IMAGE_ORIGIN = getImageOrigin();

export const mushafPageUri = (page: number) => `${IMAGE_ORIGIN}/mushaf-pages/${page}.webp`;
