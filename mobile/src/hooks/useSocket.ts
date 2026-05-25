import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { useAuthStore } from '../auth/store';
import { secureStorage } from '../storage/secureStorage';

function getSocketUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }
  return 'http://localhost:4000';
}

const SOCKET_URL = getSocketUrl();
const subscribers = new Set<(socket: Socket | null) => void>();

let sharedSocket: Socket | null = null;
let sharedUserId: string | null = null;
let connectPromise: Promise<Socket | null> | null = null;
let consumerCount = 0;
let connectionGeneration = 0;

function publishSocket(socket: Socket | null) {
  subscribers.forEach((subscriber) => subscriber(socket));
}

function disconnectSocket() {
  connectionGeneration += 1;
  connectPromise = null;
  sharedUserId = null;
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  publishSocket(null);
}

async function ensureSocket(userId: string): Promise<Socket | null> {
  if (sharedSocket && sharedUserId === userId) return sharedSocket;

  if (sharedUserId && sharedUserId !== userId) {
    disconnectSocket();
  }
  sharedUserId = userId;

  if (connectPromise) return connectPromise;

  const generation = connectionGeneration;
  connectPromise = (async () => {
    const token = await secureStorage.getItem('auth_token');
    if (!token || generation !== connectionGeneration || sharedUserId !== userId) return null;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    sharedSocket = socket;
    publishSocket(socket);
    return socket;
  })().finally(() => {
    connectPromise = null;
  });

  return connectPromise;
}

export function useSocket() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [socket, setSocket] = useState<Socket | null>(() => (userId && sharedUserId === userId ? sharedSocket : null));

  useEffect(() => {
    subscribers.add(setSocket);
    return () => {
      subscribers.delete(setSocket);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      disconnectSocket();
      setSocket(null);
      return;
    }

    consumerCount += 1;
    let mounted = true;
    ensureSocket(userId).then((connectedSocket) => {
      if (mounted) setSocket(connectedSocket);
    });

    return () => {
      mounted = false;
      consumerCount = Math.max(0, consumerCount - 1);
      if (consumerCount === 0) disconnectSocket();
    };
  }, [userId]);

  return socket;
}
