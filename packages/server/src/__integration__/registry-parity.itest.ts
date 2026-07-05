import { contractRegistry } from '@quran-review/shared';
import { endpointManifest } from './endpoint-manifest';

describe('contract registry ↔ endpoint manifest parity', () => {
  for (const contract of contractRegistry) {
    it(`${contract.method} ${contract.path} exists in the manifest with identical access`, () => {
      const entry = endpointManifest.find((e) => e.method === contract.method && e.path === contract.path);
      expect(entry).toBeDefined();
      // UserRole enum values are the same strings the manifest uses — deep-equal works.
      expect(entry!.access).toEqual(contract.access);
    });
  }

  it('registry entries are unique by method+path', () => {
    const keys = contractRegistry.map((c) => `${c.method} ${c.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
