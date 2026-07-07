import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';
import { extendActiveRecurringSlots } from '../services/recurring-slot.service';

beforeEach(truncateAll);
afterAll(disconnect);

describe('POST /api/v1/recurring-slots', () => {
  it('creates a slot and generates 8 weekly occurrences via the existing booking logic', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });

    const res = await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, dayOfWeek: 3, time: '10:00', durationMinutes: 45 });

    expect(res.status).toBe(201);
    expect(res.body.data.slot.dayOfWeek).toBe(3);
    expect(res.body.data.occurrences).toHaveLength(8);
    expect(res.body.data.occurrences.every((o: any) => o.created)).toBe(true);

    const appointments = await prisma.appointment.findMany({ where: { recurringSlotId: res.body.data.slot.id } });
    expect(appointments).toHaveLength(8);
    for (const appt of appointments) {
      expect(appt.requestedTime).toBe('10:00');
      expect(appt.durationMinutes).toBe(45);
      expect(new Date(appt.requestedDate).getDay()).toBe(3);
    }
  });

  it('skips (does not throw for) an occurrence that conflicts with an existing appointment', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const otherStudent = await createUser({ role: Role.STUDENT, email: 'other@example.com' });
    const teacher = await createUser({ role: Role.TEACHER });

    // Book the teacher's very next Wednesday 10:00 with someone else first.
    const now = new Date();
    const nextWed = new Date(now);
    const diff = (3 - now.getDay() + 7) % 7;
    nextWed.setDate(now.getDate() + diff);
    await prisma.appointment.create({
      data: {
        studentId: otherStudent.id,
        teacherId: teacher.id,
        requestedDate: nextWed,
        requestedTime: '10:00',
        status: 'ACCEPTED',
      },
    });

    const res = await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, dayOfWeek: 3, time: '10:00' });

    expect(res.status).toBe(201);
    const [first, ...rest] = res.body.data.occurrences;
    expect(first.created).toBe(false);
    expect(first.skippedReason).toMatch(/overlapping/i);
    expect(rest.every((o: any) => o.created)).toBe(true);
  });

  it('403s a non-student caller', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const res = await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ teacherId: teacher.id, dayOfWeek: 1, time: '10:00' });
    expect(res.status).toBe(403);
  });

  it('400s an invalid teacherId', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const res = await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: student.id, dayOfWeek: 1, time: '10:00' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/recurring-slots', () => {
  it('scopes to the caller: student sees their own, not another student’s', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const otherStudent = await createUser({ role: Role.STUDENT, email: 'other2@example.com' });
    const teacher = await createUser({ role: Role.TEACHER });

    await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, dayOfWeek: 2, time: '09:00' });
    await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${otherStudent.token}`)
      .send({ teacherId: teacher.id, dayOfWeek: 4, time: '11:00' });

    const res = await request(app).get('/api/v1/recurring-slots').set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].studentId).toBe(student.id);
  });
});

describe('PATCH /api/v1/recurring-slots/:id', () => {
  it('updates the template without touching already-generated appointments', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const created = await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, dayOfWeek: 1, time: '09:00' });
    const slotId = created.body.data.slot.id;
    const originalAppointmentDates = (
      await prisma.appointment.findMany({ where: { recurringSlotId: slotId }, orderBy: { requestedDate: 'asc' } })
    ).map((a) => a.requestedTime);

    const res = await request(app)
      .patch(`/api/v1/recurring-slots/${slotId}`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ time: '15:00' });
    expect(res.status).toBe(200);
    expect(res.body.data.time).toBe('15:00');

    const stillGeneratedTimes = (await prisma.appointment.findMany({ where: { recurringSlotId: slotId } })).map(
      (a) => a.requestedTime
    );
    expect(stillGeneratedTimes).toEqual(originalAppointmentDates);
    expect(stillGeneratedTimes.every((t) => t === '09:00')).toBe(true);
  });

  it("404s when the slot isn't the caller's", async () => {
    const student = await createUser({ role: Role.STUDENT });
    const outsider = await createUser({ role: Role.STUDENT, email: 'outsider3@example.com' });
    const teacher = await createUser({ role: Role.TEACHER });
    const created = await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, dayOfWeek: 1, time: '09:00' });

    const res = await request(app)
      .patch(`/api/v1/recurring-slots/${created.body.data.slot.id}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ time: '10:00' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/recurring-slots/:id/cancel', () => {
  it('deactivates the series but leaves already-generated appointments intact', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const created = await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, dayOfWeek: 5, time: '14:00' });
    const slotId = created.body.data.slot.id;

    const res = await request(app)
      .patch(`/api/v1/recurring-slots/${slotId}/cancel`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);

    const appointments = await prisma.appointment.findMany({ where: { recurringSlotId: slotId } });
    expect(appointments).toHaveLength(8);
  });
});

describe('extendActiveRecurringSlots', () => {
  it('generates exactly one occurrence per active slot, 7 days past the latest one', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const created = await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, dayOfWeek: 2, time: '13:00' });
    const slotId = created.body.data.slot.id;

    const before = await prisma.appointment.findMany({ where: { recurringSlotId: slotId } });
    expect(before).toHaveLength(8);
    const latestBefore = before.map((a) => a.requestedDate.getTime()).sort((a, b) => b - a)[0];

    const generated = await extendActiveRecurringSlots();
    expect(generated).toBe(1);

    const after = await prisma.appointment.findMany({ where: { recurringSlotId: slotId } });
    expect(after).toHaveLength(9);
    const latestAfter = after.map((a) => a.requestedDate.getTime()).sort((a, b) => b - a)[0];
    expect(latestAfter - latestBefore).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('does not extend an inactive slot', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const teacher = await createUser({ role: Role.TEACHER });
    const created = await request(app)
      .post('/api/v1/recurring-slots')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ teacherId: teacher.id, dayOfWeek: 6, time: '16:00' });
    const slotId = created.body.data.slot.id;

    await request(app)
      .patch(`/api/v1/recurring-slots/${slotId}/cancel`)
      .set('Authorization', `Bearer ${student.token}`);

    const generated = await extendActiveRecurringSlots();
    expect(generated).toBe(0);

    const appointments = await prisma.appointment.findMany({ where: { recurringSlotId: slotId } });
    expect(appointments).toHaveLength(8);
  });
});
