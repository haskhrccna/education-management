import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

const agent = request.agent(app);

beforeEach(truncateAll);
afterAll(disconnect);

const FAKE_ID = '00000000-0000-4000-8000-000000000000';

async function linkAccepted(student: TestUser, teacher: TestUser) {
  await prisma.appointment.create({
    data: {
      studentId: student.id,
      teacherId: teacher.id,
      requestedDate: new Date(),
      requestedTime: '10:00',
      status: 'ACCEPTED',
    },
  });
}

/** Upload a small valid mp3 as the given student; returns the created recording body. */
async function uploadRecording(student: TestUser) {
  const res = await agent
    .post('/api/v1/recordings')
    .set('Authorization', `Bearer ${student.token}`)
    .field('fileName', 'test.mp3')
    .field('fileSizeBytes', '4')
    .field('contentType', 'audio/mpeg')
    .attach('file', Buffer.from('abcd'), { filename: 'test.mp3', contentType: 'audio/mpeg' });
  expect(res.status).toBe(201);
  return res.body;
}

describe('recordings', () => {
  it('POST 201: multipart upload returns raw Recording (no envelope)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const rec = await uploadRecording(student);
    expect(rec.studentId).toBe(student.id);
    expect(rec.url).toMatch(/^\/uploads\//);
    expect(rec.fileName).toBe('test.mp3');
    expect(rec.contentType).toBe('audio/mpeg');
    expect(rec.success).toBeUndefined();
  });

  it('POST 400: disallowed extension is filtered by multer → Audio file is required', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await agent
      .post('/api/v1/recordings')
      .set('Authorization', `Bearer ${student.token}`)
      .field('fileName', 'x.txt')
      .field('fileSizeBytes', '1')
      .field('contentType', 'text/plain')
      .attach('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'Audio file is required' });
  });

  it('GET scopes by role: student sees own with student include; unlinked teacher sees []; admin sees all', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const unlinkedTeacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });
    await uploadRecording(student);

    const own = await agent.get('/api/v1/recordings').set('Authorization', `Bearer ${student.token}`);
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0].student).toMatchObject({ email: student.email });

    const none = await agent.get('/api/v1/recordings').set('Authorization', `Bearer ${unlinkedTeacher.token}`);
    expect(none.status).toBe(200);
    expect(none.body).toEqual([]);

    const all = await agent.get('/api/v1/recordings').set('Authorization', `Bearer ${admin.token}`);
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(1);
  });

  it('PUT 403 for unlinked teacher; PUT with empty body sets rejectedAt (unvalidated — pinned)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const unlinked = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const rec = await uploadRecording(student);

    const forbidden = await agent
      .put(`/api/v1/recordings/${rec.id}`)
      .set('Authorization', `Bearer ${unlinked.token}`)
      .send({ approved: true });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({ success: false, error: 'No accepted appointment with this student' });

    const rejected = await agent
      .put(`/api/v1/recordings/${rec.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({});
    expect(rejected.status).toBe(200);
    expect(rejected.body.rejectedAt).not.toBeNull();
    expect(rejected.body.approvedAt).toBeNull();
    expect(rejected.body.reviewedBy).toBe(teacher.id);
  });

  it('PUT approve then DELETE by linked teacher → 200 {message}; PUT 404 unknown id', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const rec = await uploadRecording(student);

    const approved = await agent
      .put(`/api/v1/recordings/${rec.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ approved: true, notes: 'nice' });
    expect(approved.status).toBe(200);
    expect(approved.body.approvedAt).not.toBeNull();
    expect(approved.body.reviewNotes).toBe('nice');

    const del = await agent.delete(`/api/v1/recordings/${rec.id}`).set('Authorization', `Bearer ${teacher.token}`);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ message: 'Recording deleted' });

    const gone = await agent
      .put(`/api/v1/recordings/${FAKE_ID}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ approved: true });
    expect(gone.status).toBe(404);
    expect(gone.body).toMatchObject({ success: false, error: 'Recording not found' });
  });
});

describe('reports', () => {
  it('POST 403 for unlinked teacher; 201 raw Report for linked teacher', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });

    const forbidden = await agent
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, summary: 'term summary' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({ success: false, error: 'No accepted appointment with this student' });

    await linkAccepted(student, teacher);
    const created = await agent
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, summary: 'term summary' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ teacherId: teacher.id, studentId: student.id, summary: 'term summary' });
    expect(created.body.pdfUrl).toMatch(/^\/reports\//);
    expect(created.body.success).toBeUndefined();
  });

  it('GET: student sees studentId-scoped list; unrelated teacher sees only their own authored reports', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const otherTeacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    await agent
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, summary: 's' });

    const mine = await agent.get('/api/v1/reports').set('Authorization', `Bearer ${student.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].studentId).toBe(student.id);

    const theirs = await agent.get('/api/v1/reports').set('Authorization', `Bearer ${otherTeacher.token}`);
    expect(theirs.status).toBe(200);
    expect(theirs.body).toEqual([]);
  });
});

describe('files (?token= auth pinned)', () => {
  it('GET /files/recordings/:id with ?token= and no header → 200 attachment', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const rec = await uploadRecording(student);

    const res = await agent.get(`/api/v1/files/recordings/${rec.id}?token=${student.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename=/);
  });

  it('GET /files/recordings/:id → 403 Permission denied for parent; 403 relationship guard for unlinked teacher', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const parent = await createUser({ role: Role.PARENT });
    const unlinkedTeacher = await createUser({ role: Role.TEACHER });
    const rec = await uploadRecording(student);

    const parentRes = await agent
      .get(`/api/v1/files/recordings/${rec.id}`)
      .set('Authorization', `Bearer ${parent.token}`);
    expect(parentRes.status).toBe(403);
    expect(parentRes.body).toMatchObject({ success: false, error: 'Permission denied' });

    const teacherRes = await agent
      .get(`/api/v1/files/recordings/${rec.id}`)
      .set('Authorization', `Bearer ${unlinkedTeacher.token}`);
    expect(teacherRes.status).toBe(403);
    expect(teacherRes.body).toMatchObject({ success: false, error: 'No accepted appointment with this student' });
  });

  it('GET /files/reports/:id as owner student via Bearer → 200 attachment; 404 for unknown ids', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await linkAccepted(student, teacher);
    const created = await agent
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ studentId: student.id, summary: 's' });

    const dl = await agent
      .get(`/api/v1/files/reports/${created.body.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toMatch(/^attachment; filename=/);

    const noRec = await agent
      .get(`/api/v1/files/recordings/${FAKE_ID}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(noRec.status).toBe(404);
    expect(noRec.body).toMatchObject({ success: false, error: 'Recording not found' });

    const noCert = await agent
      .get(`/api/v1/files/certificates/${FAKE_ID}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(noCert.status).toBe(404);
    expect(noCert.body).toMatchObject({ success: false, error: 'Certificate not found' });
  });

  it('GET /files/certificates/:id: owner reaches file check (404 File not found for missing pdf); non-owner student → 403', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const otherStudent = await createUser({ role: Role.STUDENT });
    const cert = await prisma.certificate.create({
      data: { studentId: student.id, pdfUrl: '/certificates/does-not-exist.pdf' },
    });

    const owner = await agent
      .get(`/api/v1/files/certificates/${cert.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(owner.status).toBe(404);
    expect(owner.body).toMatchObject({ success: false, error: 'File not found' });

    const stranger = await agent
      .get(`/api/v1/files/certificates/${cert.id}`)
      .set('Authorization', `Bearer ${otherStudent.token}`);
    expect(stranger.status).toBe(403);
    expect(stranger.body).toMatchObject({ success: false, error: 'Permission denied' });
  });
});

describe('exports (CSV)', () => {
  it('GET /exports/grades as teacher → text/csv attachment with pinned header row', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await agent.get('/api/v1/exports/grades').set('Authorization', `Bearer ${teacher.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="grades.csv"');
    expect(res.text.split('\n')[0]).toBe('studentName,studentEmail,teacherName,subject,grade,type,notes,date');
  });

  it('GET /exports/appointments as teacher → CSV with pinned header row', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await agent.get('/api/v1/exports/appointments').set('Authorization', `Bearer ${teacher.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="appointments.csv"');
    expect(res.text.split('\n')[0]).toBe('studentName,teacherName,date,time,duration,status');
  });

  it('GET /exports/users: teacher → 403 Insufficient permissions; admin → CSV with rows', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });

    const forbidden = await agent.get('/api/v1/exports/users').set('Authorization', `Bearer ${teacher.token}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({ success: false, error: 'Insufficient permissions' });

    const res = await agent.get('/api/v1/exports/users').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="users.csv"');
    const lines = res.text.split('\n');
    expect(lines[0]).toBe('id,name,email,role,status,createdAt');
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe('legacy /api/* mirrors', () => {
  it('GET /api/recordings behaves identically to /api/v1/recordings', async () => {
    const student = await createUser({ role: Role.STUDENT });
    await uploadRecording(student);
    const res = await agent.get('/api/recordings').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /api/files/recordings/:id?token= → 200 attachment', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const rec = await uploadRecording(student);
    const res = await agent.get(`/api/files/recordings/${rec.id}?token=${student.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename=/);
  });

  it('GET /api/exports/grades → 200 CSV', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await agent.get('/api/exports/grades').set('Authorization', `Bearer ${teacher.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="grades.csv"');
  });
});
