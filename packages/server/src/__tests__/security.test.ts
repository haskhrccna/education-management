import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../services/socket.service', () => ({
  notifyNewMessage: jest.fn(),
  notifyScheduleChange: jest.fn(),
  sendToUser: jest.fn(),
}));

jest.mock('../services/auth.service', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed'),
  comparePassword: jest.fn().mockResolvedValue(true),
  generateToken: jest.fn().mockReturnValue('test-token'),
  verifyToken: jest.fn().mockReturnValue({ userId: 'user-1', role: 'student' }),
}));

import { prisma } from '../prisma/client';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@quran-review/shared'

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate middleware', () => {
    it('should reject missing Authorization header', async () => {
      const app = express();
      app.use(authenticate);
      app.get('/', (_req, res) => res.json({ ok: true }));

      const res = await request(app).get('/');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token format', async () => {
      const app = express();
      app.use(authenticate);
      app.get('/', (_req, res) => res.json({ ok: true }));

      const res = await request(app).get('/').set('Authorization', 'Basic abc');
      expect(res.status).toBe(401);
    });
  });

  describe('authorize middleware', () => {
    it('should reject insufficient role', async () => {
      const app = express();
      app.use((req: any, _res: any, next: any) => {
        req.userRole = UserRole.STUDENT;
        next();
      });
      app.use(authorize(UserRole.ADMIN));
      app.get('/', (_req, res) => res.json({ ok: true }));

      const res = await request(app).get('/');
      expect(res.status).toBe(403);
    });

    it('should allow authorized role', async () => {
      const app = express();
      app.use((req: any, _res: any, next: any) => {
        req.userRole = UserRole.ADMIN;
        next();
      });
      app.use(authorize(UserRole.ADMIN));
      app.get('/', (_req, res) => res.json({ ok: true }));

      const res = await request(app).get('/');
      expect(res.status).toBe(200);
    });
  });

  describe('RBAC on appointments', () => {
    it('teacher cannot manage another teacher appointment', async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        teacherId: 'teacher-2',
      } as any);

      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.userId = 'teacher-1';
        req.userRole = 'TEACHER';
        next();
      });
      const { manageAppointment } = require('../controllers/appointment.controller');
      app.put('/:id', manageAppointment);

      const res = await request(app).put('/appt-1').send({ action: 'ACCEPTED' });
      expect(res.status).toBe(403);
    });
  });

  describe('Message ownership', () => {
    it('user cannot mark another message as read', async () => {
      mockedPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        receiverId: 'user-2',
      } as any);

      const app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.userId = 'user-1';
        next();
      });
      const { markRead } = require('../controllers/message.controller');
      app.put('/:id/read', markRead);

      const res = await request(app).put('/msg-1/read');
      expect(res.status).toBe(403);
    });
  });

  describe('Recording ownership', () => {
    it('student cannot delete another student recording', async () => {
      mockedPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        studentId: 'student-2',
      } as any);

      const app = express();
      app.use((req: any, _res: any, next: any) => {
        req.userId = 'student-1';
        req.userRole = 'STUDENT';
        next();
      });
      const { deleteRecording } = require('../controllers/recording.controller');
      app.delete('/:id', deleteRecording);

      const res = await request(app).delete('/rec-1');
      expect(res.status).toBe(403);
    });
  });

  describe('P0 regression: export IDOR', () => {
    it('student is blocked by authorize(TEACHER, ADMIN) guard', async () => {
      const app = express();
      app.use((req: any, _res: any, next: any) => {
        req.userId = 'student-1';
        req.userRole = UserRole.STUDENT;
        next();
      });
      app.use(authorize(UserRole.TEACHER, UserRole.ADMIN));
      app.get('/grades', (_req, res) => res.json({ data: [] }));

      const res = await request(app).get('/grades');
      expect(res.status).toBe(403);
    });

    it('teacher passes authorize(TEACHER, ADMIN) guard', async () => {
      const app = express();
      app.use((req: any, _res: any, next: any) => {
        req.userId = 'teacher-1';
        req.userRole = UserRole.TEACHER;
        next();
      });
      app.use(authorize(UserRole.TEACHER, UserRole.ADMIN));
      app.get('/grades', (_req, res) => res.json({ data: [] }));

      const res = await request(app).get('/grades');
      expect(res.status).toBe(200);
    });
  });

  describe('P0 regression: JWT role case', () => {
    it('authorize passes for uppercase TEACHER role', async () => {
      const app = express();
      app.use((req: any, _res: any, next: any) => {
        req.userRole = UserRole.TEACHER;
        next();
      });
      app.use(authorize(UserRole.TEACHER));
      app.get('/', (_req, res) => res.json({ ok: true }));

      const res = await request(app).get('/');
      expect(res.status).toBe(200);
    });

    it('authorize rejects lowercase teacher role', async () => {
      const app = express();
      app.use((req: any, _res: any, next: any) => {
        req.userRole = 'teacher';
        next();
      });
      app.use(authorize(UserRole.TEACHER));
      app.get('/', (_req, res) => res.json({ ok: true }));

      const res = await request(app).get('/');
      expect(res.status).toBe(403);
    });
  });
});
