import { useCallback, useState } from 'react';
import { messagesApi, Message } from '../api';
import { useAuthStore } from '../auth/store';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuthStore();
  const unreadCount = messages.filter(
    (m: any) => !m.readAt && m.receiverId === user?.id
  ).length;

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await messagesApi.getConversations();
      setMessages(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (receiverId: string, content: string) => {
    try {
      const sent = await messagesApi.send(receiverId, content);
      setMessages((prev) => [sent, ...prev]);
      return sent;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  return { messages, isLoading, error, fetchMessages, sendMessage, unreadCount };
}
