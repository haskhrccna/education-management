import { useState, useCallback } from 'react';
import { messagesApi } from '../api/messages';
import { useAuthStore } from '../auth/store';

export function useConversation(partnerId: string) {
  const [thread, setThread] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const fetchThread = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await messagesApi.getThread(partnerId);
      // Mark received unread messages as read (fire-and-forget)
      data
        .filter((m: any) => !m.readAt && m.receiverId === user?.id)
        .forEach((m: any) => messagesApi.markRead(m.id).catch(() => {}));
      setThread([...data].reverse()); // chronological order
    } catch {
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [partnerId, user?.id]);

  const sendMessage = useCallback(async (content: string) => {
    await messagesApi.send(partnerId, content, 'TEXT');
    await fetchThread();
  }, [partnerId, fetchThread]);

  return { thread, isLoading, error, fetchThread, sendMessage };
}
