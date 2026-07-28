import request from 'supertest';
import { Role, UserStatus } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';
import { prisma } from '../prisma/client';

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

  it('filters by resourceType', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    await request(app).put(`/api/v1/admin/users/${s.id}/approve`).set('Authorization', `Bearer ${admin.token}`);

    const hit = await request(app)
      .get('/api/v1/admin/audit-logs?resourceType=USER')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(hit.status).toBe(200);
    expect(hit.body.meta.total).toBe(1);

    const miss = await request(app)
      .get('/api/v1/admin/audit-logs?resourceType=MESSAGE')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(miss.body.meta.total).toBe(0);
  });

  it('filters by dateFrom/dateTo window', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    await request(app).put(`/api/v1/admin/users/${s.id}/approve`).set('Authorization', `Bearer ${admin.token}`);

    const past = new Date(Date.now() - 86_400_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();

    const inWindow = await request(app)
      .get(`/api/v1/admin/audit-logs?dateFrom=${past}&dateTo=${future}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(inWindow.body.meta.total).toBe(1);

    const beforeWindow = await request(app)
      .get(`/api/v1/admin/audit-logs?dateTo=${past}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(beforeWindow.body.meta.total).toBe(0);
  });

  it('combines action + resourceType filters: wrong resourceType excludes an otherwise-matching action', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    // APPROVE_STUDENT always logs resourceType: 'USER' (see admin.module.ts).
    await request(app).put(`/api/v1/admin/users/${s.id}/approve`).set('Authorization', `Bearer ${admin.token}`);

    // Same action, but paired with the resourceType used by a *different* action (BROADCAST -> 'MESSAGE').
    // If the resourceType filter were dropped, this would still match on action alone and return 1.
    const wrongResourceType = await request(app)
      .get('/api/v1/admin/audit-logs?action=APPROVE_STUDENT&resourceType=MESSAGE')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(wrongResourceType.status).toBe(200);
    expect(wrongResourceType.body.meta.total).toBe(0);

    // The matching resourceType, combined with the same action filter, does find the row.
    const rightResourceType = await request(app)
      .get('/api/v1/admin/audit-logs?action=APPROVE_STUDENT&resourceType=USER')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(rightResourceType.body.meta.total).toBe(1);
    expect(rightResourceType.body.data[0].action).toBe('APPROVE_STUDENT');
  });

  it('combines action + date window filters: a backdated row of the same action is excluded', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const s1 = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING });
    const s2 = await createUser({
      role: Role.STUDENT,
      status: UserStatus.PENDING,
      email: 'itest-window-2@itest.local',
    });

    // Two APPROVE_STUDENT rows, same action — one will be pushed outside the queried window.
    await request(app).put(`/api/v1/admin/users/${s1.id}/approve`).set('Authorization', `Bearer ${admin.token}`);
    await request(app).put(`/api/v1/admin/users/${s2.id}/approve`).set('Authorization', `Bearer ${admin.token}`);

    // Backdate the second row's audit entry to well before the query window.
    await prisma.auditLog.updateMany({
      where: { action: 'APPROVE_STUDENT', resourceId: { not: s1.id } },
      data: { createdAt: new Date(Date.now() - 10 * 86_400_000) },
    });

    const dateFrom = new Date(Date.now() - 86_400_000).toISOString();
    const dateTo = new Date(Date.now() + 86_400_000).toISOString();
    const res = await request(app)
      .get(`/api/v1/admin/audit-logs?action=APPROVE_STUDENT&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .set('Authorization', `Bearer ${admin.token}`);
    // If the date-window filter were dropped, action alone would still match both rows -> total 2.
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].resourceId).toBe(s1.id);
  });

  it('400s on an unparseable date rather than 500ing through Prisma', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .get('/api/v1/admin/audit-logs?dateFrom=not-a-date')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/dateFrom/);
  });
});
