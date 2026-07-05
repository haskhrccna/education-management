import { discoverEndpoints } from './route-inventory';
import { endpointManifest } from './endpoint-manifest';

describe('endpoint manifest completeness', () => {
  it('every discovered endpoint is in the manifest, and vice versa', () => {
    const discovered = new Set(discoverEndpoints().map((e) => `${e.method} ${e.path}`));
    const manifest = new Set(endpointManifest.map((e) => `${e.method} ${e.path}`));
    const missingFromManifest = [...discovered].filter((k) => !manifest.has(k)).sort();
    const staleInManifest = [...manifest].filter((k) => !discovered.has(k)).sort();
    expect(missingFromManifest).toEqual([]);
    expect(staleInManifest).toEqual([]);
  });
});
