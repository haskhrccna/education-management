import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

async function approvedLink(parentId: string, studentId: string, adminToken: string) {
  const link = await prisma.parentLink.create({ data: { parentId, studentId } });
  await request(app)
    .patch(`/api/v1/parents/links/${link.id}/decision`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'APPROVE' });
}

describe('GET /api/v1/parents/children/:studentId/reports', () => {
  it("lists the child's reports for an approved-link parent", async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    await approvedLink(parent.id, student.id, admin.token);
    await prisma.report.create({
      data: { teacherId: teacher.id, studentId: student.id, pdfUrl: 'reports/x.pdf', summary: 'Q1' },
    });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/reports`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ studentId: student.id, summary: 'Q1' });
  });

  it('403s a parent with no approved link to this student', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/reports`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.status).toBe(403);
  });

  it('401s an unauthenticated request', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app).get(`/api/v1/parents/children/${student.id}/reports`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/parents/children/:studentId/recordings', () => {
  it("lists the child's recordings for an approved-link parent", async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    await approvedLink(parent.id, student.id, admin.token);
    await prisma.recording.create({
      data: {
        studentId: student.id,
        url: 'uploads/x.m4a',
        fileName: 'x.m4a',
        fileSizeBytes: 1024,
        contentType: 'audio/m4a',
      },
    });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/recordings`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ studentId: student.id, fileName: 'x.m4a' });
  });

  it('403s a parent with no approved link to this student', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });

    const res = await request(app)
      .get(`/api/v1/parents/children/${student.id}/recordings`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(res.status).toBe(403);
  });
});

describe('file downloads — parent authorization', () => {
  it('lets an approved-link parent download a report file (via ?token=, matching WebBrowser.openBrowserAsync)', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    await approvedLink(parent.id, student.id, admin.token);
    const report = await prisma.report.create({
      data: { teacherId: teacher.id, studentId: student.id, pdfUrl: 'reports/does-not-exist.pdf', summary: 'x' },
    });

    const res = await request(app).get(`/api/v1/files/reports/${report.id}?token=${parent.token}`);
    // The fixture file genuinely doesn't exist on disk, so this asserts we get
    // PAST authorization (404 "File not found") rather than 403 "Permission
    // denied" — the two are distinguishable and this is the one that matters.
    expect(res.status).toBe(404);
    expect(res.body.error).not.toMatch(/permission/i);
  });

  it('403s a parent with no approved link from downloading a report file', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const report = await prisma.report.create({
      data: { teacherId: teacher.id, studentId: student.id, pdfUrl: 'reports/does-not-exist.pdf', summary: 'x' },
    });

    const res = await request(app).get(`/api/v1/files/reports/${report.id}?token=${parent.token}`);
    expect(res.status).toBe(403);
  });

  it('lets an approved-link parent past authorization for a recording file', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const admin = await createUser({ role: Role.ADMIN });
    await approvedLink(parent.id, student.id, admin.token);
    const recording = await prisma.recording.create({
      data: {
        studentId: student.id,
        url: 'uploads/does-not-exist.m4a',
        fileName: 'does-not-exist.m4a',
        fileSizeBytes: 1,
        contentType: 'audio/m4a',
      },
    });

    const res = await request(app).get(`/api/v1/files/recordings/${recording.id}?token=${parent.token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).not.toMatch(/permission/i);
  });
});
