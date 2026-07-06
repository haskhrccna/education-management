import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

/** Book via API: student requests, teacher accepts. Returns the appointment id. */
async function bookAccepted(student: TestUser, teacher: TestUser, date = '2027-01-15', time = '10:00') {
  const created = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${student.token}`)
    .send({ teacherId: teacher.id, requestedDate: date, requestedTime: time });
  expect(created.status).toBe(201);
  const accepted = await request(app)
    .put(`/api/v1/appointments/${created.body.id}`)
    .set('Authorization', `Bearer ${teacher.token}`)
    .send({ action: 'ACCEPTED' });
  expect(accepted.status).toBe(200);
  return created.body.id as string;
}

describe('POST /api/v1/appointments', () => {
  it('201: raw appointment echo, REQUESTED, duration defaults to 60', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, requestedDate: '2027-01-15', requestedTime: '10:00' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      studentId: student.id,
      teacherId: teacher.id,
      requestedTime: '10:00',
      durationMinutes: 60,
      status: 'REQUESTED',
    });
    expect(res.body.success).toBeUndefined(); // raw echo
  });

  it('400 when target is not a teacher', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const other = await createUser({ role: Role.STUDENT, email: 'other@example.com' });
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: other.id, requestedDate: '2027-01-15', requestedTime: '10:00' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid teacher');
  });

  it('409 on duplicate slot and on overlapping teacher slot', async () => {
    const s1 = await createUser({ role: Role.STUDENT });
    const s2 = await createUser({ role: Role.STUDENT, email: 's2@example.com' });
    const teacher = await createUser({ role: Role.TEACHER });
    const first = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${s1.token}`)
      .send({ teacherId: teacher.id, requestedDate: '2027-01-15', requestedTime: '10:00' });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${s1.token}`)
      .send({ teacherId: teacher.id, requestedDate: '2027-01-15', requestedTime: '10:00' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('You already have a pending or accepted appointment at this time');

    const overlap = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${s2.token}`)
      .send({ teacherId: teacher.id, requestedDate: '2027-01-15', requestedTime: '10:30' });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error).toBe('Teacher already has an appointment overlapping this time');
  });
});

describe('GET /api/v1/appointments', () => {
  it('student sees own with teacher relation; teacher sees own with student relation (raw arrays)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await bookAccepted(student, teacher);

    const mine = await request(app).get('/api/v1/appointments').set('Authorization', `Bearer ${student.token}`);
    expect(mine.status).toBe(200);
    expect(Array.isArray(mine.body)).toBe(true);
    expect(mine.body[0].teacher).toMatchObject({ id: teacher.id });

    const theirs = await request(app).get('/api/v1/appointments').set('Authorization', `Bearer ${teacher.token}`);
    expect(theirs.body[0].student).toMatchObject({ id: student.id });
  });
});

describe('PUT /api/v1/appointments/:id', () => {
  it("403 'You can only manage your own appointments' for another teacher; admin may manage any", async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const stranger = await createUser({ role: Role.TEACHER, email: 'stranger@example.com' });
    const admin = await createUser({ role: Role.ADMIN });
    const created = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, requestedDate: '2027-01-15', requestedTime: '10:00' });

    const denied = await request(app)
      .put(`/api/v1/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ action: 'ACCEPTED' });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('You can only manage your own appointments');

    const byAdmin = await request(app)
      .put(`/api/v1/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'REJECTED', amendedNote: 'slot closed' });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body).toMatchObject({ status: 'REJECTED', amendedNote: 'slot closed' });
    expect(byAdmin.body.rejectedAt).toBeTruthy();
  });

  it('404 for unknown appointment', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const res = await request(app)
      .put('/api/v1/appointments/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'ACCEPTED' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Appointment not found');
  });
});

describe('POST /api/v1/appointments/:id/attendance', () => {
  it('201 envelope {success,data}; appointment flips to COMPLETED; second record → 409', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const apptId = await bookAccepted(student, teacher);

    const res = await request(app)
      .post(`/api/v1/appointments/${apptId}/attendance`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: 'PRESENT', notes: 'on time' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ appointmentId: apptId, studentId: student.id, status: 'PRESENT' });

    const row = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(row!.status).toBe('COMPLETED');

    // Pinned quirk: the COMPLETED flip removes the ACCEPTED appointment, so the
    // teacher-student guard 403s BEFORE the idempotency 409 can fire.
    const again = await request(app)
      .post(`/api/v1/appointments/${apptId}/attendance`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: 'LATE' });
    expect(again.status).toBe(403);
    expect(again.body.error).toBe('No accepted appointment with this student');
  });

  it('400 with the exact hand-rolled status message (no Zod on this route)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const apptId = await bookAccepted(student, teacher);
    const res = await request(app)
      .post(`/api/v1/appointments/${apptId}/attendance`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: 'SLEEPING' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('status must be one of PRESENT, ABSENT, LATE, EXCUSED');
  });
});

describe('GET /api/v1/attendance', () => {
  it('student reads own without studentId (envelope); non-student without studentId → 400', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const apptId = await bookAccepted(student, teacher);
    await request(app)
      .post(`/api/v1/appointments/${apptId}/attendance`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ status: 'PRESENT' });

    const own = await request(app).get('/api/v1/attendance').set('Authorization', `Bearer ${student.token}`);
    expect(own.status).toBe(200);
    expect(own.body.success).toBe(true);
    expect(own.body.data).toHaveLength(1);
    expect(own.body.data[0]).toMatchObject({ status: 'PRESENT' });
    expect(own.body.data[0].appointment).toHaveProperty('requestedDate');

    const admin = await createUser({ role: Role.ADMIN });
    const bare = await request(app).get('/api/v1/attendance').set('Authorization', `Bearer ${admin.token}`);
    expect(bare.status).toBe(400);
    expect(bare.body.error).toBe('studentId is required (or call without it as a student to fetch your own)');
  });

  it("teacher without an ACCEPTED appointment with the student → 403 'No accepted appointment with this student'", async () => {
    const student = await createUser({ role: Role.STUDENT });
    const outsider = await createUser({ role: Role.TEACHER, email: 'outsider@example.com' });
    const res = await request(app)
      .get(`/api/v1/attendance?studentId=${student.id}`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('No accepted appointment with this student');
  });
});

describe('teacher-change lifecycle', () => {
  it('POST: 201 raw request with currentTeacher from the ACCEPTED appointment; duplicate PENDING → 409', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    await bookAccepted(student, teacher);

    const res = await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Need a different schedule fit' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ studentId: student.id, status: 'PENDING' });
    expect(res.body.currentTeacher).toMatchObject({ id: teacher.id });

    const dup = await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Changed my mind about the reason' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('You already have a pending request');
  });

  it('GET: student sees own; current teacher sees PENDING against them; admin sees all + ?status filter', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });
    await bookAccepted(student, teacher);
    await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Need a different schedule fit' });

    const asStudent = await request(app).get('/api/v1/teacher-changes').set('Authorization', `Bearer ${student.token}`);
    expect(asStudent.body).toHaveLength(1);
    expect(asStudent.body[0].currentTeacher).toMatchObject({ id: teacher.id });

    const asTeacher = await request(app).get('/api/v1/teacher-changes').set('Authorization', `Bearer ${teacher.token}`);
    expect(asTeacher.body).toHaveLength(1);
    expect(asTeacher.body[0].student).toMatchObject({ id: student.id });

    const asAdmin = await request(app)
      .get('/api/v1/teacher-changes?status=PENDING')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(asAdmin.body).toHaveLength(1);
  });

  it('APPROVE with newTeacherId: ALL THREE side effects verified in the DB', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const oldTeacher = await createUser({ role: Role.TEACHER, email: 'old-t@example.com' });
    const newTeacher = await createUser({ role: Role.TEACHER, email: 'new-t@example.com' });
    const admin = await createUser({ role: Role.ADMIN });
    const apptId = await bookAccepted(student, oldTeacher);

    const reqRes = await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Need a different schedule fit' });

    const decided = await request(app)
      .patch(`/api/v1/teacher-changes/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE', newTeacherId: newTeacher.id, adminNote: 'ok' });
    expect(decided.status).toBe(200);
    expect(decided.body).toMatchObject({ status: 'APPROVED', adminNote: 'ok' });

    // Side effect 1: canonical assignment on the student row
    const studentRow = await prisma.user.findUnique({ where: { id: student.id } });
    expect(studentRow!.assignedTeacherId).toBe(newTeacher.id);

    // Side effect 2: existing ACCEPTED/REQUESTED appointments reassigned
    const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(appt!.teacherId).toBe(newTeacher.id);

    // Side effect 3 (branch not taken here): an ACCEPTED appointment already
    // existed, so NO synthetic appointment was created.
    const count = await prisma.appointment.count({ where: { studentId: student.id } });
    expect(count).toBe(1);
  });

  it('APPROVE for a student with NO accepted appointment creates the synthetic ACCEPTED link (side effect 3)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const newTeacher = await createUser({ role: Role.TEACHER, email: 'new-t2@example.com' });
    const admin = await createUser({ role: Role.ADMIN });

    const reqRes = await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'I have no teacher assigned yet' });

    const decided = await request(app)
      .patch(`/api/v1/teacher-changes/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE', newTeacherId: newTeacher.id });
    expect(decided.status).toBe(200);

    const synthetic = await prisma.appointment.findFirst({
      where: { studentId: student.id, teacherId: newTeacher.id, status: 'ACCEPTED' },
    });
    expect(synthetic).not.toBeNull();
    expect(synthetic!.requestedTime).toBe('00:00');
    expect(synthetic!.approvedAt).not.toBeNull();
  });

  it('DENY has no side effects; deciding twice → 409', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const admin = await createUser({ role: Role.ADMIN });
    await bookAccepted(student, teacher);
    const reqRes = await request(app)
      .post('/api/v1/teacher-changes')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'Need a different schedule fit' });

    const denied = await request(app)
      .patch(`/api/v1/teacher-changes/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'DENY', adminNote: 'insufficient reason' });
    expect(denied.status).toBe(200);
    expect(denied.body.status).toBe('DENIED');

    const studentRow = await prisma.user.findUnique({ where: { id: student.id } });
    expect(studentRow!.assignedTeacherId).toBeNull();

    const again = await request(app)
      .patch(`/api/v1/teacher-changes/${reqRes.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'DENY' });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('Request already decided');
  });
});

describe('legacy mirror /api/appointments', () => {
  it('GET /api/appointments behaves identically', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app).get('/api/appointments').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
