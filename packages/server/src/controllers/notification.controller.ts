import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error.middleware';
import {
  listNotifications,
  markRead,
  markAllRead,
  unreadCount,
} from '../services/notification.service';
import { paginatedResponse, PaginatedRequest } from '../middleware/pagination.middleware';

export const getNotifications = async (req: PaginatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError(401, 'Authentication required');
    const page = req.pagination?.page ?? 1;
    const limit = req.pagination?.limit ?? 20;
    const { items, total } = await listNotifications(userId, page, limit);
    res.json(paginatedResponse(items, total, page, limit));
  } catch (err) {
    next(err);
  }
};

export const markOneRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError(401, 'Authentication required');
    const id = String(req.params.id);
    try {
      const updated = await markRead(id, userId);
      res.json({ success: true, data: updated });
    } catch (e: unknown) {
      // Service throws plain Error('Notification not found') when id missing or not owned
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (msg === 'Notification not found') {
        throw new AppError(404, 'Notification not found');
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
};

export const markEveryRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError(401, 'Authentication required');
    const { count } = await markAllRead(userId);
    res.json({ success: true, data: { markedRead: count } });
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError(401, 'Authentication required');
    const count = await unreadCount(userId);
    res.json({ success: true, data: { unread: count } });
  } catch (err) {
    next(err);
  }
};
