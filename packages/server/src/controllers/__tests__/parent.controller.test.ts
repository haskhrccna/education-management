import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import express from 'express';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../../services/parent.service', () => ({
  requestLink: jest.fn(),
  listLinks: jest.fn(),
  approveLink: jest.fn(),
  denyLink: jest.fn(),
  getChildren: jest.fn(),
  getChildDashboard: jest.fn(),
}));

import * as parentService from '../../services/parent.service';
import { requestLink, listLinks, decideLink, getChildren, getChildDashboard } from '../parent.controller';

const mockedService = parentService as jest.Mocked<typeof parentService>;

function createApp(userId = 'parent-1', role = 'PARENT') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.userRole = role;
    next();
  });
  app.post('/links', requestLink);
  app.get('/links', listLinks);
  app.patch('/links/:id/decide', decideLink);
  app.get('/children', getChildren);
  app.get('/children/:studentId/dashboard', getChildDashboard);
  app.use((err: any, _req: any, res: any, _next: any) =>
    res.status(err.statusCode || 500).json({ error: err.message })
  );
  return app;
}

describe('parent.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /links', () => {
    it('creates a parent-student link request', async () => {
      mockedService.requestLink.mockResolvedValue({ id: 'link-1', status: 'PENDING' } as any);

      const res = await request(createApp())
        .post('/links')
        .send({ studentId: 'student-1', reason: 'I am their parent' });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('link-1');
      expect(mockedService.requestLink).toHaveBeenCalledWith('parent-1', 'student-1', 'I am their parent');
    });

    it('returns 400 when studentId is missing', async () => {
      const res = await request(createApp()).post('/links').send({ reason: 'test' });
      expect(res.status).toBe(400);
    });

    it('passes undefined reason when reason is empty string', async () => {
      mockedService.requestLink.mockResolvedValue({ id: 'link-1' } as any);

      await request(createApp()).post('/links').send({ studentId: 'student-1', reason: '' });

      expect(mockedService.requestLink).toHaveBeenCalledWith('parent-1', 'student-1', undefined);
    });

    it('returns 401 when userId is missing', async () => {
      const app = express();
      app.use(express.json());
      app.post('/links', requestLink);
      app.use((err: any, _req: any, res: any, _next: any) =>
        res.status(err.statusCode || 500).json({ error: err.message })
      );

      const res = await request(app).post('/links').send({ studentId: 'student-1' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /links', () => {
    it('returns links for PARENT role', async () => {
      mockedService.listLinks.mockResolvedValue([{ id: 'link-1' }] as any);

      const res = await request(createApp()).get('/links');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockedService.listLinks).toHaveBeenCalledWith('parent-1', 'PARENT');
    });

    it('passes ADMIN role to service when caller is admin', async () => {
      mockedService.listLinks.mockResolvedValue([{ id: 'link-1' }] as any);

      await request(createApp('admin-1', 'ADMIN')).get('/links');

      expect(mockedService.listLinks).toHaveBeenCalledWith('admin-1', 'ADMIN');
    });
  });

  describe('PATCH /links/:id/decide', () => {
    it('approves a link', async () => {
      mockedService.approveLink.mockResolvedValue({ id: 'link-1', status: 'APPROVED' } as any);

      const res = await request(createApp('admin-1', 'ADMIN'))
        .patch('/links/link-1/decide')
        .send({ action: 'APPROVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(mockedService.approveLink).toHaveBeenCalledWith('link-1', 'admin-1');
    });

    it('denies a link with an optional note', async () => {
      mockedService.denyLink.mockResolvedValue({ id: 'link-1', status: 'DENIED' } as any);

      const res = await request(createApp('admin-1', 'ADMIN'))
        .patch('/links/link-1/decide')
        .send({ action: 'DENY', note: 'Not verified' });

      expect(res.body.data.status).toBe('DENIED');
      expect(mockedService.denyLink).toHaveBeenCalledWith('link-1', 'admin-1', 'Not verified');
    });

    it('returns 400 for invalid action value', async () => {
      const res = await request(createApp('admin-1', 'ADMIN'))
        .patch('/links/link-1/decide')
        .send({ action: 'INVALID' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /children', () => {
    it('returns children linked to the parent', async () => {
      mockedService.getChildren.mockResolvedValue([{ id: 'student-1' }] as any);

      const res = await request(createApp()).get('/children');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockedService.getChildren).toHaveBeenCalledWith('parent-1');
    });
  });

  describe('GET /children/:studentId/dashboard', () => {
    it('returns the child dashboard', async () => {
      const dashboardData = { grades: [], recordings: [], attendance: [] };
      mockedService.getChildDashboard.mockResolvedValue(dashboardData as any);

      const res = await request(createApp()).get('/children/student-1/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(dashboardData);
      expect(mockedService.getChildDashboard).toHaveBeenCalledWith('parent-1', 'student-1');
    });
  });
});
