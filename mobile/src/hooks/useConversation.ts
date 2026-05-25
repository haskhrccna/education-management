import { useState, useCallback, useEffect } from 'react';
import { messagesApi } from '../api/messages';
import { useAuthStore } from '../auth/store';
import { useSocket } from './useSocket';

export function useConversation(partnerId: string) {
  const [thread, setThread] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const socket = useSocket();

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

  // Listen for real-time messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: any) => {
      // Only append if it's from the current partner or sent by me to this partner
      const isFromPartner = message.senderId === partnerId;
      const isToPartner = message.receiverId === partnerId;

      if (isFromPartner || isToPartner) {
        setThread((prev) => {
          // Prevent duplicates (e.g. if we just fetched)
          if (prev.find((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });

        // Mark as read if from partner
        if (isFromPartner) {
          messagesApi.markRead(message.id).catch(() => {});
        }
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, partnerId]);

  const sendMessage = useCallback(
    async (content: string) => {
      try {
        const sentMessage = await messagesApi.send(partnerId, content, 'TEXT');
        // Optionally append immediately for better UX, or let the socket event handle it
        // The server should emit the message back to the sender too if designed that way
        // Let's append it manually to ensure immediate feedback
        setThread((prev) => {
          if (prev.find((m) => m.id === sentMessage.id)) return prev;
          return [...prev, sentMessage];
        });
      } catch (err) {
        setError('Failed to send message');
        throw err;
      }
    },
    [partnerId]
  );

  return { thread, isLoading, error, fetchThread, sendMessage };
}
