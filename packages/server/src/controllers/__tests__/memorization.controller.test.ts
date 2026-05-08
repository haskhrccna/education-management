import request from 'supertest';
import express from 'express';
import { errorHandler, AppError } from '../../middleware/error.middleware';

jest.mock('../../services/memorization.service', () => ({
  getSurahs: jest.fn(),
  getProgress: jest.fn(),
  updateProgress: jest.fn(),
}));

import * as memorizationService from '../../services/memorization.service';
import { listSurahs, getProgress, updateProgress } from '../memorization.controller';

const mockedService = memorizationService as jest.Mocked<typeof memorizationService>;

function makeApp(userId = 'user-1', userRole = 'STUDENT') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = userRole;
    next();
  });
  app.get('/surahs', listSurahs);
  app.get('/memorization', getProgress);
  app.put('/memorization/:surahId', updateProgress);
  app.use(errorHandler);
  return app;
}

describe('memorization.controller', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /surahs', () => {
    it('should return surah list', async () => {
      mockedService.getSurahs.mockResolvedValue([{ id: 1, nameAr: 'الفاتحة' }] as any);
      const res = await request(makeApp()).get('/surahs');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('GET /memorization', () => {
    it('should return student own progress', async () => {
      mockedService.getProgress.mockResolvedValue([{ surahId: 1, memorizedAyahs: 7 }] as any);
      const res = await request(makeApp('student-1', 'STUDENT')).get('/memorization');
      expect(res.status).toBe(200);
      expect(mockedService.getProgress).toHaveBeenCalledWith('student-1', 'STUDENT', undefined);
    });

    it('should pass studentId query param for teacher', async () => {
      mockedService.getProgress.mockResolvedValue([{ surahId: 1, memorizedAyahs: 3 }] as any);
      const res = await request(makeApp('teacher-1', 'TEACHER')).get('/memorization?studentId=student-1');
      expect(res.status).toBe(200);
      expect(mockedService.getProgress).toHaveBeenCalledWith('teacher-1', 'TEACHER', 'student-1');
    });
  });

  describe('PUT /memorization/:surahId', () => {
    it('should update progress', async () => {
      mockedService.updateProgress.mockResolvedValue({ surahId: 1, memorizedAyahs: 50 } as any);
      const res = await request(makeApp('teacher-1', 'TEACHER'))
        .put('/memorization/1')
        .send({ studentId: 'student-1', memorizedAyahs: 50 });
      expect(res.status).toBe(200);
      expect(mockedService.updateProgress).toHaveBeenCalledWith('teacher-1', 1, 'student-1', 50, undefined);
    });

    it('should return 400 for non-numeric surahId', async () => {
      const res = await request(makeApp('teacher-1', 'TEACHER'))
        .put('/memorization/abc')
        .send({ studentId: 'student-1', memorizedAyahs: 10 });
      expect(res.status).toBe(400);
    });

    it('should return 400 when studentId missing', async () => {
      const res = await request(makeApp('teacher-1', 'TEACHER')).put('/memorization/1').send({ memorizedAyahs: 10 });
      expect(res.status).toBe(400);
    });

    it('should propagate 403 from service', async () => {
      mockedService.updateProgress.mockRejectedValue(new AppError(403, 'No accepted appointment'));
      const res = await request(makeApp('teacher-1', 'TEACHER'))
        .put('/memorization/1')
        .send({ studentId: 'student-1', memorizedAyahs: 10 });
      expect(res.status).toBe(403);
    });
  });
});
