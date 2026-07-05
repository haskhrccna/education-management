import { healthContracts } from '@quran-review/shared';
import { getHealthStatus } from '../../lib/health';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const getHealth = defineRoute(healthContracts.getHealth, async () => {
  const health = await getHealthStatus();
  // Same status mapping as the old inline handler: healthy/degraded → 200, unhealthy → 503.
  return health.status === 'unhealthy'
    ? { status: 503 as const, body: { success: true as const, data: health } }
    : { status: 200 as const, body: { success: true as const, data: health } };
});

export const healthRouter = buildContractRouter([getHealth], { mountPrefix: '/api' });
