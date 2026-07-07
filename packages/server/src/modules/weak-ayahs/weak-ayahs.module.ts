import { weakAyahsContracts } from '@quran-review/shared';
import * as weakAyahService from '../../services/weak-ayah.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const flag = defineRoute(weakAyahsContracts.flag, async ({ body, userId }) => {
  const data = await weakAyahService.flagWeakAyah(body.studentId, body.ayahId, userId!);
  return { status: 201 as const, body: { success: true as const, data } };
});

const list = defineRoute(weakAyahsContracts.list, async ({ userId, userRole }) => {
  const data = await weakAyahService.listWeakAyahFlags(userId!, userRole as 'STUDENT' | 'TEACHER' | 'ADMIN');
  return { status: 200 as const, body: { success: true as const, data } };
});

export const weakAyahsRouter = buildContractRouter([flag, list], { mountPrefix: '/api/v1/weak-ayahs' });
