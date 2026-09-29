import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import { config } from '../config';
import { validateAccessToken } from '../middleware/auth.middleware';
import { logger } from '../lib/logger';
import { recordJoin, recordLeave } from './halaqa.service';

let io: SocketIOServer;

export const setupSocketIO = (server: http.Server) => {
  io = new SocketIOServer(server, {
    cors: { origin: config.env === 'production' ? process.env.CLIENT_URL || false : '*', methods: ['GET', 'POST'] },
  });

  // Same account check as HTTP: a valid signature alone is not enough. A
  // banned, deleted or password-changed account is refused here.
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    try {
      const { userId, role, expiresAt } = await validateAccessToken(token);
      socket.data.userId = userId;
      socket.data.userRole = role;
      socket.data.expiresAt = expiresAt;
      next();
    } catch (err) {
      next(new Error((err as Error).message || 'Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.info({ socketId: socket.id, userId }, 'Socket connected');
    if (userId) socket.join(userId);

    // A connection must not outlive its token. The client reconnects with its
    // latest token (mobile/src/hooks/useSocket.ts).
    const expiresAt = socket.data.expiresAt as number | undefined;
    const expiryTimer = expiresAt
      ? setTimeout(() => socket.disconnect(true), Math.max(0, expiresAt * 1000 - Date.now()))
      : undefined;
    socket.on('disconnect', () => clearTimeout(expiryTimer));

    // ── Halaqa WebRTC signaling ──────────────────────────────────────────────
    // The server is a pure relay: it never inspects SDP or ICE candidates.
    // All media flows peer-to-peer; the server only records join/leave for
    // attendance and forwards WebRTC envelopes to the target peer by userId.

    socket.on('halaqa:join', async ({ roomId }: { roomId: string }) => {
      try {
        await recordJoin(roomId, userId, socket.data.userRole as string);
        socket.join(`halaqa:${roomId}`);
        socket.to(`halaqa:${roomId}`).emit('halaqa:participant-joined', { roomId, userId });
        logger.info({ roomId, userId }, 'Halaqa join');
      } catch (err) {
        socket.emit('halaqa:error', { message: (err as Error).message });
      }
    });

    socket.on('halaqa:leave', async ({ roomId }: { roomId: string }) => {
      try {
        await recordLeave(roomId, userId);
        socket.leave(`halaqa:${roomId}`);
        socket.to(`halaqa:${roomId}`).emit('halaqa:participant-left', { roomId, userId });
      } catch {
        /* best-effort */
      }
    });

    // WebRTC offer/answer/ICE. Relayed only between two sockets in the same
    // halaqa room: the sender must have joined `halaqa:<roomId>`, and the
    // envelope goes only to the target user's sockets in that room. Anything
    // else (an outsider, a target outside the room, a room name used as the
    // target to broadcast) is dropped.
    const relay = async (event: string, roomId: unknown, targetUserId: unknown, body: Record<string, unknown>) => {
      if (typeof roomId !== 'string' || typeof targetUserId !== 'string') return;
      const room = `halaqa:${roomId}`;
      if (!socket.rooms.has(room)) return;
      const peers = await io.in(room).fetchSockets();
      for (const peer of peers) {
        if (peer.data.userId === targetUserId) peer.emit(event, { roomId, fromUserId: userId, ...body });
      }
    };

    socket.on('halaqa:offer', ({ roomId, targetUserId, sdp }: { roomId: string; targetUserId: string; sdp: unknown }) =>
      relay('halaqa:offer', roomId, targetUserId, { sdp })
    );
    socket.on(
      'halaqa:answer',
      ({ roomId, targetUserId, sdp }: { roomId: string; targetUserId: string; sdp: unknown }) =>
        relay('halaqa:answer', roomId, targetUserId, { sdp })
    );
    socket.on(
      'halaqa:ice-candidate',
      ({ roomId, targetUserId, candidate }: { roomId: string; targetUserId: string; candidate: unknown }) =>
        relay('halaqa:ice-candidate', roomId, targetUserId, { candidate })
    );

    // 'disconnecting' (not 'disconnect'): socket.rooms is already emptied by the
    // time 'disconnect' fires, so the auto-leave below never ran on the old event.
    socket.on('disconnecting', async () => {
      logger.info({ socketId: socket.id, userId }, 'Socket disconnected');
      // Auto-leave any halaqa rooms this socket was in
      const halaqaRooms = [...socket.rooms].filter((r) => r.startsWith('halaqa:'));
      for (const room of halaqaRooms) {
        const roomId = room.replace('halaqa:', '');
        try {
          await recordLeave(roomId, userId);
          socket.to(room).emit('halaqa:participant-left', { roomId, userId });
        } catch {
          /* best-effort */
        }
      }
    });
  });

  return io;
};

export const sendToUser = (userId: string, event: string, data: unknown) => {
  io?.to(userId).emit(event, data);
};

/**
 * End every live connection a user has: on ban, delete, password change or
 * reset. Their next connect runs the handshake check again. No-op when
 * Socket.IO isn't running (tests, workers).
 */
export const disconnectUserSockets = (userId: string) => {
  io?.in(userId).disconnectSockets(true);
};

export const closeSocketIO = async (): Promise<void> => {
  if (io) {
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    logger.info('Socket.IO server closed');
  }
};

export const notifyNewMessage = (receiverId: string, messageData: unknown) => {
  sendToUser(receiverId, 'new_message', messageData);
};

export const notifyScheduleChange = (userId: string, appointmentUpdate: unknown) => {
  sendToUser(userId, 'appointment_update', appointmentUpdate);
};

// Re-export FCM for push notifications
export { sendPushNotification } from './fcm.service';
