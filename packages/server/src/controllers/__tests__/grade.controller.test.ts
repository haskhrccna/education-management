import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../../prisma/client';
import { createGrade, getMyGrades, getStudentGrades } from '../grade.controller';

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

function createTestApp(userId: string, userRole: string) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = userRole;
    next();
  });
  app.get('/', getMyGrades);
  app.post('/', createGrade);
  app.get('/student/:id', getStudentGrades);
  return app;
}

describe('grade.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /', () => {
    it('should create grade for valid student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT' } as any);
      mockedPrisma.grade.create.mockResolvedValue({ id: 'grade-1' } as any);

      const app = createTestApp('teacher-1', 'teacher');
      const res = await request(app)
        .post('/')
        .send({ studentId: 'student-1', subject: 'Math', grade: '95', type: 'EXAM' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('grade-1');
    });

    it('should return 404 for deleted student', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({ id: 'student-1', role: 'STUDENT', deletedAt: new Date() } as any);

      const app = createTestApp('teacher-1', 'TEACHER');
      const res = await request(app)
        .post('/')
        .send({ studentId: 'student-1', subject: 'Math', grade: '95', type: 'EXAM' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /', () => {
    it('should return own grades', async () => {
      mockedPrisma.grade.findMany.mockResolvedValue([{ id: 'grade-1' }] as any);

      const app = createTestApp('student-1', 'student');
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /student/:id', () => {
    it('should return student grades for teacher', async () => {
      mockedPrisma.grade.findMany.mockResolvedValue([{ id: 'grade-1' }] as any);

      const app = createTestApp('teacher-1', 'teacher');
      const res = await request(app).get('/student/student-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
