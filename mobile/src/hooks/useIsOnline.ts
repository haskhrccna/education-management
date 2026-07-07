import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';

/** Mirrors the same onlineManager state React Query itself uses to pause/resume. */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setIsOnline), []);

  return isOnline;
}
