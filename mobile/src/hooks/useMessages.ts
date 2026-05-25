import { useCallback, useState, useEffect } from 'react';
import { messagesApi, Message } from '../api';
import { useAuthStore } from '../auth/store';
import { useSocket } from './useSocket';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socket = useSocket();

  const { user } = useAuthStore();
  const unreadCount = messages.filter((m: any) => !m.readAt && m.receiverId === user?.id).length;

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

  // Listen for real-time messages to refresh list
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = () => {
      // For simplicity, refetch the whole list when a new message arrives
      // This ensures the last message and unread counts are correct
      fetchMessages();
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, fetchMessages]);

  const sendMessage = useCallback(
    async (receiverId: string, content: string) => {
      try {
        const sent = await messagesApi.send(receiverId, content);
        // After sending, we refetch to ensure the list is sorted correctly
        await fetchMessages();
        return sent;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [fetchMessages]
  );

  return { messages, isLoading, error, fetchMessages, sendMessage, unreadCount };
}
