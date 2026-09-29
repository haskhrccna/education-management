import { Platform } from 'react-native';
import { resolveSocketOrigin } from '../api/apiBase';

export const TOTAL_MUSHAF_PAGES = 604;

// The Mushaf pages are served as static images by the API, one WebP per page,
// under /mushaf-pages/<page>.webp (see packages/server/scripts/extract_mushaf_pages.py).
// Same origin as every other client — never a second EXPO_PUBLIC_API_URL lookup.
export const IMAGE_ORIGIN = resolveSocketOrigin({
  os: Platform.OS,
  hostname: typeof window !== 'undefined' ? window.location?.hostname : undefined,
});

export const mushafPageUri = (page: number) => `${IMAGE_ORIGIN}/mushaf-pages/${page}.webp`;
