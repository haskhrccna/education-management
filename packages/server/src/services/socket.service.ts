import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../lib/logger';
import { recordJoin, recordLeave } from './halaqa.service';

let io: SocketIOServer;

export const setupSocketIO = (server: http.Server) => {
  io = new SocketIOServer(server, {
    cors: { origin: config.env === 'production' ? process.env.CLIENT_URL || false : '*', methods: ['GET', 'POST'] },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, config.jwtSecret) as { userId: string; role: string };
      socket.data.userId = payload.userId;
      socket.data.userRole = payload.role;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.info({ socketId: socket.id, userId }, 'Socket connected');
    if (userId) socket.join(userId);

    // ── Halaqa WebRTC signaling ──────────────────────────────────────────────
    // The server is a pure relay: it never inspects SDP or ICE candidates.
    // All media flows peer-to-peer; the server only records join/leave for
    // attendance and forwards WebRTC envelopes to the target peer by userId.

    socket.on('halaqa:join', async ({ roomId }: { roomId: string }) => {
      try {
        await recordJoin(roomId, userId);
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

    // WebRTC offer/answer/ICE — relay to the target peer's personal room (userId)
    socket.on(
      'halaqa:offer',
      ({ roomId, targetUserId, sdp }: { roomId: string; targetUserId: string; sdp: unknown }) => {
        io.to(targetUserId).emit('halaqa:offer', { roomId, fromUserId: userId, sdp });
      }
    );

    socket.on(
      'halaqa:answer',
      ({ roomId, targetUserId, sdp }: { roomId: string; targetUserId: string; sdp: unknown }) => {
        io.to(targetUserId).emit('halaqa:answer', { roomId, fromUserId: userId, sdp });
      }
    );

    socket.on(
      'halaqa:ice-candidate',
      ({ roomId, targetUserId, candidate }: { roomId: string; targetUserId: string; candidate: unknown }) => {
        io.to(targetUserId).emit('halaqa:ice-candidate', { roomId, fromUserId: userId, candidate });
      }
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
