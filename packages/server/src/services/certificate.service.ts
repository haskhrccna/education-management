import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

/** Role-scoped certificate listing — moved verbatim from certificate.controller. */
export const listCertificates = async (callerId: string, callerRole: string | undefined, studentIdFilter?: string) => {
  let studentId: string | undefined;
  if (callerRole === 'STUDENT') {
    studentId = callerId;
  } else if (callerRole === 'ADMIN') {
    studentId = studentIdFilter;
  } else {
    throw new AppError(403, 'Only students and admins can access certificates');
  }

  return prisma.certificate.findMany({
    where: studentId ? { studentId } : {},
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { issuedAt: 'desc' },
  });
};
