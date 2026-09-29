/**
 * The single place the mobile app and the web export learn which API — and
 * therefore which database — they talk to.
 *
 * Both clients are one Expo codebase. If each file resolved
 * EXPO_PUBLIC_API_URL on its own, one of them could drift to a different
 * backend and the two would silently stop sharing data. Every caller
 * (axios client, contract client, sockets, mushaf images, recording URLs)
 * resolves through here.
 *
 * A hosted web build with the variable unset used to fall back to
 * http://localhost:4000 and publish a site that called the visitor's own
 * machine. That fallback is now refused: localhost is only acceptable when
 * the page itself is being served from localhost.
 *
 * This module is dependency-free and framework-free (no react-native, no
 * expo) so both the server test suite and the mobile bundle can import it.
 */

export const DEFAULT_API_BASE = 'http://localhost:4000/api/v1';

export type AppPlatform = 'ios' | 'android' | 'web' | 'windows' | 'macos';

export interface ApiBaseInput {
  os: AppPlatform;
  /** process.env at resolution time. Tests pass a stub; production reads the real one. */
  env?: Record<string, string | undefined>;
  /** window.location.hostname. Only meaningful when os === 'web'. */
  hostname?: string;
}

export function resolveApiBase({ os, env = process.env, hostname }: ApiBaseInput): string {
  const configured = env.EXPO_PUBLIC_API_URL;
  if (configured) return configured;

  if (os === 'web') {
    // No hostname means "not in a browser" (native test, SSR before hydration).
    // An empty hostname is a browser that has none — treat it as loopback.
    // Anything else is a hosted page, and localhost would call the visitor's machine.
    if (hostname !== undefined && hostname !== '' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      throw new Error(
        'EXPO_PUBLIC_API_URL was not set when this site was built, so it has no API to call ' +
          `and cannot share the app's database. Rebuild with EXPO_PUBLIC_API_URL set (page host: ${hostname}).`
      );
    }
  }

  if (os === 'android') return 'http://10.0.2.2:4000/api/v1';
  return DEFAULT_API_BASE;
}

/** Origin only — contract paths and sockets are rooted here, not under /api/v1. */
export function resolveSocketOrigin(input: ApiBaseInput): string {
  return resolveApiBase(input).replace(/\/api\/v1\/?$/, '');
}

/**
 * True when a hosted web build was published without EXPO_PUBLIC_API_URL.
 * Kept for the sign-in screen, which explains the misconfiguration instead of
 * letting the thrown error surface as a blank "Network Error".
 */
export function isApiUnreachableByConfig(input: Partial<ApiBaseInput> = {}): boolean {
  if ((input.os ?? 'web') !== 'web') return false;
  if (input.env?.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_API_URL) return false;
  const host = input.hostname ?? '';
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '';
}
