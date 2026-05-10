import { useLocalSearchParams } from 'expo-router';

export function useRequiredParam(key: string): string | null {
  const params = useLocalSearchParams();
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === 'string') return value;
  return null;
}
