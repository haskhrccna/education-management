import request from 'supertest';
import { Role, UserStatus } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

describe('GET /api/v1/admin/audit-logs', () => {
  it('returns audited admin actions newest-first with actor, filterable by action', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });

    await request(app)
      .put(`/api/v1/admin/users/${s.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .set('User-Agent', 'itest-agent/1.0');

    const res = await request(app)
      .get('/api/v1/admin/audit-logs?action=APPROVE_STUDENT')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    const entry = res.body.data[0];
    expect(entry).toMatchObject({
      action: 'APPROVE_STUDENT',
      resourceType: 'USER',
      resourceId: s.id,
      userId: admin.id,
      userAgent: 'itest-agent/1.0',
    });
    expect(entry.user).toMatchObject({ id: admin.id });
    expect(entry).toHaveProperty('createdAt');
  });

  it('supports userId filter and pagination meta', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const other = await createUser({ role: Role.ADMIN, email: 'admin2@example.com' });
    const s = await createUser({ role: Role.STUDENT });

    await request(app).put(`/api/v1/admin/users/${s.id}/deactivate`).set('Authorization', `Bearer ${admin.token}`);

    const mine = await request(app)
      .get(`/api/v1/admin/audit-logs?userId=${admin.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.meta).toMatchObject({ page: 1, total: 1 });
    expect(mine.body.data[0].action).toBe('DEACTIVATE_USER');

    const none = await request(app)
      .get(`/api/v1/admin/audit-logs?userId=${other.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(none.body.meta.total).toBe(0);
  });
});
