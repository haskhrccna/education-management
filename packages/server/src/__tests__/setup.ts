import { mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../prisma/client', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../lib/queue', () => ({
  addBroadcastJob: jest.fn().mockResolvedValue(null),
  addReportJob: jest.fn().mockResolvedValue(null),
  addScoringJob: jest.fn().mockResolvedValue(null),
}));
