import { recurringSlotsContracts } from '@quran-review/shared';
import * as recurringSlotService from '../../services/recurring-slot.service';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const create = defineRoute(recurringSlotsContracts.create, async ({ body, userId }) => {
  const { slot, occurrences } = await recurringSlotService.createRecurringSlot(
    userId!,
    body.teacherId,
    body.dayOfWeek,
    body.time,
    body.durationMinutes
  );
  return { status: 201 as const, body: { success: true as const, data: { slot, occurrences } } };
});

const list = defineRoute(recurringSlotsContracts.list, async ({ userId, userRole }) => {
  const data = await recurringSlotService.listRecurringSlots(userId!, userRole as 'STUDENT' | 'TEACHER' | 'ADMIN');
  return { status: 200 as const, body: { success: true as const, data } };
});

const update = defineRoute(recurringSlotsContracts.update, async ({ params, body, userId, userRole }) => {
  const slot = await recurringSlotService.updateRecurringSlot(String(params.id), userId!, userRole!, body);
  return { status: 200 as const, body: { success: true as const, data: slot } };
});

const cancel = defineRoute(recurringSlotsContracts.cancel, async ({ params, userId, userRole }) => {
  const slot = await recurringSlotService.cancelRecurringSlot(String(params.id), userId!, userRole!);
  return { status: 200 as const, body: { success: true as const, data: slot } };
});

export const recurringSlotsRouter = buildContractRouter([create, list, update, cancel], {
  mountPrefix: '/api/v1/recurring-slots',
});
