import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';
import { uploadRecording } from '../services/recording.service';

beforeEach(truncateAll);
afterAll(disconnect);

describe('guardian consent opens on link approval', () => {
  it('sets guardianConsentStatus to PENDING once the link is approved, and not before', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });

    const beforeApproval = await prisma.user.findUnique({
      where: { id: student.id },
      select: { guardianConsentStatus: true },
    });
    expect(beforeApproval?.guardianConsentStatus).toBeNull();

    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });

    const afterApproval = await prisma.user.findUnique({
      where: { id: student.id },
      select: { guardianConsentStatus: true },
    });
    expect(afterApproval?.guardianConsentStatus).toBe('PENDING');
  });
});

describe('revoking a link and guardian consent (fix-pass-2 Important 2)', () => {
  it('resets guardianConsentStatus to null when the only approved link is revoked while consent is still PENDING', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });

    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });

    const afterApproval = await prisma.user.findUnique({
      where: { id: student.id },
      select: { guardianConsentStatus: true },
    });
    expect(afterApproval?.guardianConsentStatus).toBe('PENDING');

    const revoke = await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'REVOKE' });
    expect(revoke.status).toBe(200);

    const afterRevoke = await prisma.user.findUnique({
      where: { id: student.id },
      select: { guardianConsentStatus: true },
    });
    expect(afterRevoke?.guardianConsentStatus).toBeNull();
  });

  it('does not touch guardianConsentStatus when another APPROVED link still exists for the same student', async () => {
    const parentA = await createUser({ role: Role.PARENT });
    const parentB = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const linkA = await prisma.parentLink.create({ data: { parentId: parentA.id, studentId: student.id } });
    const linkB = await prisma.parentLink.create({ data: { parentId: parentB.id, studentId: student.id } });

    await request(app)
      .patch(`/api/v1/parents/links/${linkA.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });
    await request(app)
      .patch(`/api/v1/parents/links/${linkB.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });

    const afterApprovals = await prisma.user.findUnique({
      where: { id: student.id },
      select: { guardianConsentStatus: true },
    });
    expect(afterApprovals?.guardianConsentStatus).toBe('PENDING');

    const revokeA = await request(app)
      .patch(`/api/v1/parents/links/${linkA.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'REVOKE' });
    expect(revokeA.status).toBe(200);

    // linkB is still APPROVED, so consent must stay PENDING — not reset to
    // null, which would strand a still-active guardian's consent request.
    const afterRevokeA = await prisma.user.findUnique({
      where: { id: student.id },
      select: { guardianConsentStatus: true },
    });
    expect(afterRevokeA?.guardianConsentStatus).toBe('PENDING');
  });

  it('does not touch guardianConsentStatus when it is already GRANTED', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });
    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });
    await request(app)
      .patch(`/api/v1/parent-links/${link.id}/consent`)
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ granted: true });

    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'REVOKE' });

    const afterRevoke = await prisma.user.findUnique({
      where: { id: student.id },
      select: { guardianConsentStatus: true },
    });
    expect(afterRevoke?.guardianConsentStatus).toBe('GRANTED');
  });
});

describe('PATCH /api/v1/parent-links/:id/consent', () => {
  it('lets the linked parent grant consent', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });
    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });

    const res = await request(app)
      .patch(`/api/v1/parent-links/${link.id}/consent`)
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ granted: true });

    expect(res.status).toBe(200);
    expect(res.body.guardianConsentStatus).toBe('GRANTED');
  });

  it('404s for a parent who does not own the link', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const otherParent = await createUser({ role: Role.PARENT, email: 'other-parent@example.com' });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });
    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });

    const res = await request(app)
      .patch(`/api/v1/parent-links/${link.id}/consent`)
      .set('Authorization', `Bearer ${otherParent.token}`)
      .send({ granted: true });
    expect(res.status).toBe(404);
  });

  it('409s before the link itself is approved', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });

    const res = await request(app)
      .patch(`/api/v1/parent-links/${link.id}/consent`)
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ granted: true });
    expect(res.status).toBe(409);
  });
});

describe('recording uploads are gated by guardian consent', () => {
  it('is unaffected for a student with no parent link at all', async () => {
    const student = await createUser({ role: Role.STUDENT });
    await expect(uploadRecording(student.id, 'test.m4a', 1024, 'audio/m4a')).resolves.toBeDefined();
  });

  it('blocks uploads once a link exists and consent is PENDING', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });
    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });

    await expect(uploadRecording(student.id, 'test.m4a', 1024, 'audio/m4a')).rejects.toThrow(/guardian must consent/i);
  });

  it('unblocks uploads once consent is GRANTED', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });
    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });
    await request(app)
      .patch(`/api/v1/parent-links/${link.id}/consent`)
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ granted: true });

    await expect(uploadRecording(student.id, 'test.m4a', 1024, 'audio/m4a')).resolves.toBeDefined();
  });

  it('stays blocked once consent is DECLINED', async () => {
    const parent = await createUser({ role: Role.PARENT });
    const student = await createUser({ role: Role.STUDENT });
    const admin = await createUser({ role: Role.ADMIN });
    const link = await prisma.parentLink.create({ data: { parentId: parent.id, studentId: student.id } });
    await request(app)
      .patch(`/api/v1/parents/links/${link.id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'APPROVE' });
    await request(app)
      .patch(`/api/v1/parent-links/${link.id}/consent`)
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ granted: false });

    await expect(uploadRecording(student.id, 'test.m4a', 1024, 'audio/m4a')).rejects.toThrow(/guardian must consent/i);
  });
});
