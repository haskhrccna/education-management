/**
 * The single place mobile code learns which API — and therefore which
 * database — it talks to.
 *
 * The resolver implementation lives in @quran-review/shared so the server's
 * cross-client test suite pins mobile and web to the same resolution rules
 * without reaching into this package's source tree (a server `tsc` build used
 * to fail with TS6059 because the integration test imported this mobile file,
 * which sits outside the server package's rootDir). Every caller (axios
 * client, contract client, sockets, mushaf images, recording URLs) imports
 * from here — not from the shared package directly.
 */
export { DEFAULT_API_BASE, resolveApiBase, resolveSocketOrigin, isApiUnreachableByConfig } from '@quran-review/shared';
export type { ApiBaseInput, AppPlatform } from '@quran-review/shared';
