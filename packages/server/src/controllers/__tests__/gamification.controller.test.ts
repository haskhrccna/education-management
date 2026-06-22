import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/gamification.service', () => ({
  getMyGamification: jest.fn(),
  getLeaderboard: jest.fn(),
}));

import * as gamificationService from '../../services/gamification.service';
import { getMyGamification, getLeaderboard } from '../gamification.controller';

const mockedService = gamificationService as jest.Mocked<typeof gamificationService>;

function createApp(userId = 'user-1') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    next();
  });
  app.get('/gamification', getMyGamification);
  app.get('/leaderboard', getLeaderboard);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  return app;
}

describe('gamification.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /gamification', () => {
    it('returns gamification data for authenticated user', async () => {
      const mockData = { streak: { currentStreak: 5, longestStreak: 10 }, badges: [], rank: 3 };
      mockedService.getMyGamification.mockResolvedValue(mockData as any);

      const res = await request(createApp()).get('/gamification');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.streak.currentStreak).toBe(5);
      expect(mockedService.getMyGamification).toHaveBeenCalledWith('user-1');
    });

    it('returns 401 when userId is missing', async () => {
      const app = express();
      app.use(express.json());
      app.get('/gamification', getMyGamification);
      app.use((err: any, _req: any, res: any, _next: any) =>
        res.status(err.statusCode || 500).json({ error: err.message })
      );

      const res = await request(app).get('/gamification');
      expect(res.status).toBe(401);
    });

    it('propagates service errors to next()', async () => {
      mockedService.getMyGamification.mockRejectedValue(new Error('DB error'));

      const app = createApp();
      app.use((err: any, _req: any, res: any, _next: any) =>
        res.status(err.statusCode || 500).json({ error: err.message })
      );

      const res = await request(app).get('/gamification');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /leaderboard', () => {
    it('returns leaderboard with default limit of 20', async () => {
      const mockData = [{ userId: 'u1', rank: 1 }];
      mockedService.getLeaderboard.mockResolvedValue(mockData as any);

      const res = await request(createApp()).get('/leaderboard');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(mockedService.getLeaderboard).toHaveBeenCalledWith(undefined, 20);
    });

    it('passes scope and limit query params to service', async () => {
      mockedService.getLeaderboard.mockResolvedValue([] as any);

      await request(createApp()).get('/leaderboard?scope=weekly&limit=10');

      expect(mockedService.getLeaderboard).toHaveBeenCalledWith('weekly', 10);
    });

    it('defaults limit to 20 when limit param is non-numeric', async () => {
      mockedService.getLeaderboard.mockResolvedValue([] as any);

      await request(createApp()).get('/leaderboard?limit=abc');

      expect(mockedService.getLeaderboard).toHaveBeenCalledWith(undefined, 20);
    });
  });
});
