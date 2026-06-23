import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { successResponse } from '../lib/response';

export const listCertificates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const callerId = req.userId!;
    const callerRole = req.userRole!;

    let studentId: string | undefined;
    if (callerRole === 'STUDENT') {
      studentId = callerId;
    } else if (callerRole === 'ADMIN') {
      studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
    } else {
      throw new AppError(403, 'Only students and admins can access certificates');
    }

    const certs = await prisma.certificate.findMany({
      where: studentId ? { studentId } : {},
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { issuedAt: 'desc' },
    });

    res.json(successResponse(certs));
  } catch (err) {
    next(err);
  }
};
