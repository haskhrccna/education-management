import { Request, Response, NextFunction } from 'express';
import * as revisionService from '../services/revision.service';
import type { RevisionStatus } from '../services/revision.service';

export const getMyRevisions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const surahId = req.query.surahId ? parseInt(req.query.surahId as string, 10) : undefined;
    if (surahId && isNaN(surahId)) {
      res.status(400).json({ success: false, error: 'Invalid surahId' });
      return;
    }
    const revisions = await revisionService.getRevisions(req.userId!, req.userRole as 'STUDENT' | 'TEACHER', surahId);
    res.json(revisions);
  } catch (err) {
    next(err);
  }
};

export const createRevision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { studentId, surahId, scheduledFor } = req.body;
    if (!studentId) throw new Error('studentId is required');
    if (!surahId || typeof surahId !== 'number') throw new Error('surahId is required');
    if (!scheduledFor) throw new Error('scheduledFor is required');

    const revision = await revisionService.createRevision(
      req.userId!,
      studentId as string,
      surahId as number,
      new Date(scheduledFor as string)
    );
    res.status(201).json(revision);
  } catch (err) {
    next(err);
  }
};

export const markRevision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.body.status as RevisionStatus;
    if (!status) throw new Error('status is required');

    const revision = await revisionService.updateRevision(
      String(req.params.id),
      req.userId!,
      req.userRole as 'STUDENT' | 'TEACHER' | 'ADMIN',
      status
    );
    res.json(revision);
  } catch (err) {
    next(err);
  }
};

export const deleteRevision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await revisionService.deleteRevision(
      String(req.params.id),
      req.userId!,
      req.userRole as 'STUDENT' | 'TEACHER' | 'ADMIN'
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
