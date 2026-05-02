import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../lib/logger';

let io: SocketIOServer;

export const setupSocketIO = (server: http.Server) => {
  io = new SocketIOServer(server, { cors: { origin: config.env === 'production' ? process.env.CLIENT_URL || false : '*', methods: ['GET', 'POST'] } });

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

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id, userId }, 'Socket disconnected');
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
