import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../prisma/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Stub the services notifyUser dynamically imports.
jest.mock('../../services/socket.service', () => ({ sendToUser: jest.fn() }));
jest.mock('../../services/email.service', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/fcm.service', () => ({ sendPushToUser: jest.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../prisma/client';
import { requestLink, approveLink, denyLink, listLinks, getChildren, getChildDashboard } from '../parent.service';

const m = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('parent.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('requestLink', () => {
    it('rejects self-link', async () => {
      await expect(requestLink('user-1', 'user-1')).rejects.toThrow('cannot link to themselves');
      expect(m.parentLink.create).not.toHaveBeenCalled();
    });

    it('rejects when the parent user is missing', async () => {
      m.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'student-1', role: 'STUDENT', deletedAt: null } as any);

      await expect(requestLink('parent-1', 'student-1')).rejects.toThrow('Parent account not found');
    });

    it('rejects when the caller is not a PARENT (caller role != PARENT)', async () => {
      m.user.findUnique
        .mockResolvedValueOnce({ id: 'parent-1', role: 'TEACHER', deletedAt: null } as any)
        .mockResolvedValueOnce({ id: 'student-1', role: 'STUDENT', deletedAt: null } as any);

      await expect(requestLink('parent-1', 'student-1')).rejects.toThrow('Only a parent account');
    });

    it('rejects when the target is not a STUDENT', async () => {
      m.user.findUnique
        .mockResolvedValueOnce({ id: 'parent-1', role: 'PARENT', deletedAt: null } as any)
        .mockResolvedValueOnce({ id: 'target-1', role: 'TEACHER', deletedAt: null } as any);

      await expect(requestLink('parent-1', 'target-1')).rejects.toThrow('must be a student account');
    });

    it('rejects when a link already exists for the pair (idempotency)', async () => {
      m.user.findUnique
        .mockResolvedValueOnce({ id: 'parent-1', role: 'PARENT', deletedAt: null } as any)
        .mockResolvedValueOnce({ id: 'student-1', role: 'STUDENT', deletedAt: null } as any);
      m.parentLink.findUnique.mockResolvedValue({ id: 'link-1', status: 'PENDING' } as any);

      await expect(requestLink('parent-1', 'student-1')).rejects.toThrow('link already exists');
      expect(m.parentLink.create).not.toHaveBeenCalled();
    });

    it('creates a PENDING link when the pair is new', async () => {
      m.user.findUnique
        .mockResolvedValueOnce({ id: 'parent-1', role: 'PARENT', deletedAt: null } as any)
        .mockResolvedValueOnce({ id: 'student-1', role: 'STUDENT', deletedAt: null } as any);
      m.parentLink.findUnique.mockResolvedValue(null);
      m.parentLink.create.mockResolvedValue({
        id: 'link-1',
        parentId: 'parent-1',
        studentId: 'student-1',
        status: 'PENDING',
      } as any);

      const result = await requestLink('parent-1', 'student-1', 'I am the father');

      expect(result.status).toBe('PENDING');
      expect(m.parentLink.create).toHaveBeenCalledWith({
        data: { parentId: 'parent-1', studentId: 'student-1', reason: 'I am the father', status: 'PENDING' },
      });
    });
  });

  describe('approveLink', () => {
    it('rejects when the link is not found', async () => {
      m.parentLink.findUnique.mockResolvedValue(null);
      await expect(approveLink('missing', 'admin-1')).rejects.toThrow('Link request not found');
    });

    it('rejects approving a previously DENIED link', async () => {
      m.parentLink.findUnique.mockResolvedValue({ id: 'link-1', status: 'DENIED' } as any);
      await expect(approveLink('link-1', 'admin-1')).rejects.toThrow('Cannot approve a denied link');
    });

    it('flips PENDING to APPROVED and fires a notification', async () => {
      m.parentLink.findUnique.mockResolvedValue({ id: 'link-1', parentId: 'parent-1', status: 'PENDING' } as any);
      m.parentLink.update.mockResolvedValue({ id: 'link-1', status: 'APPROVED' } as any);

      const result = await approveLink('link-1', 'admin-1');

      expect(result.status).toBe('APPROVED');
      expect(m.parentLink.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: { status: 'APPROVED', decidedAt: expect.any(Date), decidedBy: 'admin-1' },
      });
      expect(m.notification.create).toHaveBeenCalledTimes(1);
      expect(m.notification.create.mock.calls[0][0].data.type).toBe('parent_link_approved');
    });

    it('is idempotent on an already-APPROVED link', async () => {
      m.parentLink.findUnique.mockResolvedValue({ id: 'link-1', status: 'APPROVED' } as any);
      const result = await approveLink('link-1', 'admin-1');
      expect(result.status).toBe('APPROVED');
      expect(m.parentLink.update).not.toHaveBeenCalled();
      expect(m.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('denyLink', () => {
    it('rejects denying a previously APPROVED link', async () => {
      m.parentLink.findUnique.mockResolvedValue({ id: 'link-1', status: 'APPROVED' } as any);
      await expect(denyLink('link-1', 'admin-1')).rejects.toThrow('Cannot deny an approved link');
    });

    it('flips PENDING to DENIED with note', async () => {
      m.parentLink.findUnique.mockResolvedValue({ id: 'link-1', parentId: 'parent-1', status: 'PENDING' } as any);
      m.parentLink.update.mockResolvedValue({ id: 'link-1', status: 'DENIED' } as any);

      const result = await denyLink('link-1', 'admin-1', 'Not the right email');

      expect(result.status).toBe('DENIED');
      expect(m.parentLink.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: { status: 'DENIED', decidedAt: expect.any(Date), decidedBy: 'admin-1' },
      });
      expect(m.notification.create.mock.calls[0][0].data.title).toMatch(/denied/);
    });
  });

  describe('listLinks', () => {
    it('shows all links for ADMIN', async () => {
      m.parentLink.findMany.mockResolvedValue([] as any);
      await listLinks('admin-1', 'ADMIN');
      expect(m.parentLink.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { requestedAt: 'desc' } }));
    });

    it('scopes to the parent for PARENT', async () => {
      m.parentLink.findMany.mockResolvedValue([] as any);
      await listLinks('parent-1', 'PARENT');
      expect(m.parentLink.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { parentId: 'parent-1' } }));
    });
  });

  describe('getChildren', () => {
    it('returns only APPROVED children for the parent', async () => {
      m.parentLink.findMany.mockResolvedValue([
        { id: 'link-1', decidedAt: new Date(), student: { id: 's1', firstName: 'Ali' } },
      ] as any);

      const children = await getChildren('parent-1');

      expect(m.parentLink.findMany).toHaveBeenCalledWith({
        where: { parentId: 'parent-1', status: 'APPROVED' },
        orderBy: { decidedAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              status: true,
              guardianConsentStatus: true,
            },
          },
        },
      });
      expect(children).toHaveLength(1);
      expect(children[0].student.id).toBe('s1');
    });
  });

  describe('getChildDashboard', () => {
    it('rejects when no APPROVED link exists', async () => {
      m.parentLink.findUnique.mockResolvedValue(null);
      await expect(getChildDashboard('parent-1', 'student-1')).rejects.toThrow('No approved link');
    });

    it('rejects when the link is PENDING (not yet APPROVED)', async () => {
      m.parentLink.findUnique.mockResolvedValue({ status: 'PENDING' } as any);
      await expect(getChildDashboard('parent-1', 'student-1')).rejects.toThrow('No approved link');
    });

    it('aggregates the dashboard shape when the link is APPROVED', async () => {
      m.parentLink.findUnique.mockResolvedValue({ status: 'APPROVED' } as any);
      m.user.findUnique.mockResolvedValue({ id: 'student-1', firstName: 'Ali' } as any);
      m.memorizationProgress.findMany.mockResolvedValue([]);
      m.grade.findMany.mockResolvedValue([]);
      m.sessionRecord.findMany.mockResolvedValue([]);
      m.appointment.findMany.mockResolvedValue([]);
      m.revisionSchedule.findMany.mockResolvedValue([]);

      const dashboard = await getChildDashboard('parent-1', 'student-1');

      // Shape contract: all 6 expected keys present
      expect(dashboard).toEqual(
        expect.objectContaining({
          student: expect.any(Object),
          memorization: expect.any(Array),
          grades: expect.any(Array),
          attendance: expect.any(Array),
          upcomingAppointments: expect.any(Array),
          pendingRevisions: expect.any(Array),
        })
      );
      expect(dashboard.student.id).toBe('student-1');

      // All 6 reads ran in parallel
      expect(m.user.findUnique).toHaveBeenCalled();
      expect(m.memorizationProgress.findMany).toHaveBeenCalled();
      expect(m.grade.findMany).toHaveBeenCalled();
      expect(m.sessionRecord.findMany).toHaveBeenCalled();
      expect(m.appointment.findMany).toHaveBeenCalled();
      expect(m.revisionSchedule.findMany).toHaveBeenCalled();
    });

    it('scopes every aggregation to the student', async () => {
      m.parentLink.findUnique.mockResolvedValue({ status: 'APPROVED' } as any);
      m.user.findUnique.mockResolvedValue({ id: 'student-1' } as any);
      m.memorizationProgress.findMany.mockResolvedValue([]);
      m.grade.findMany.mockResolvedValue([]);
      m.sessionRecord.findMany.mockResolvedValue([]);
      m.appointment.findMany.mockResolvedValue([]);
      m.revisionSchedule.findMany.mockResolvedValue([]);

      await getChildDashboard('parent-1', 'student-1');

      expect(m.memorizationProgress.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'student-1' } })
      );
      expect(m.grade.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: 'student-1' } }));
      expect(m.sessionRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } })
      );
      expect(m.revisionSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'student-1', status: 'PENDING' } })
      );
    });
  });
});
