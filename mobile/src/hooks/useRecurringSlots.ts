import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { recurringSlotsApi, RecurringSlot, GeneratedOccurrence } from '../api';

export function useRecurringSlots() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const q = useQuery<RecurringSlot[]>({
    queryKey: ['recurringSlots'],
    queryFn: () => recurringSlotsApi.list(),
  });

  const createSlot = useCallback(
    async (
      teacherId: string,
      dayOfWeek: number,
      time: string,
      durationMinutes?: number
    ): Promise<{ slot: RecurringSlot; occurrences: GeneratedOccurrence[] } | null> => {
      setError(null);
      try {
        const result = await recurringSlotsApi.create(teacherId, dayOfWeek, time, durationMinutes);
        await qc.invalidateQueries({ queryKey: ['recurringSlots'] });
        return result;
      } catch (err: any) {
        setError(err?.response?.data?.error ?? err?.message ?? 'Failed to create recurring slot');
        return null;
      }
    },
    [qc]
  );

  const cancelSlot = useCallback(
    async (id: string) => {
      await recurringSlotsApi.cancel(id);
      await qc.invalidateQueries({ queryKey: ['recurringSlots'] });
    },
    [qc]
  );

  return {
    slots: (q.data ?? []).filter((s) => s.active),
    isLoading: q.isLoading,
    error,
    refetch: q.refetch,
    createSlot,
    cancelSlot,
  };
}
