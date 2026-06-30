import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '../api';
import { useAuthStore } from '../auth/store';
import { useSocket } from './useSocket';

const KEY = ['conversations'];

export function useMessages() {
  const qc = useQueryClient();
  const socket = useSocket();
  const { user } = useAuthStore();
  const [actionError, setActionError] = useState<string | null>(null);

  const q = useQuery({ queryKey: KEY, queryFn: () => messagesApi.getConversations() });
  const messages = q.data ?? [];
  const unreadCount = messages.filter((m: any) => !m.readAt && m.receiverId === user?.id).length;

  // Refresh the conversation list when a new message arrives.
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => qc.invalidateQueries({ queryKey: KEY });
    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, qc]);

  const fetchMessages = useCallback(async () => {
    await q.refetch();
  }, [q.refetch]);

  const sendMessage = useCallback(
    async (receiverId: string, content: string) => {
      setActionError(null);
      try {
        const sent = await messagesApi.send(receiverId, content);
        await q.refetch();
        return sent;
      } catch (err: any) {
        setActionError(err.message);
        throw err;
      }
    },
    [q.refetch]
  );

  return {
    messages,
    isLoading: q.isLoading,
    error: q.error ? (q.error as Error).message : actionError,
    fetchMessages,
    sendMessage,
    unreadCount,
  };
}
