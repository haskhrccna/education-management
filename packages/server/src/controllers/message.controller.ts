import { Request, Response, NextFunction } from 'express';
import * as messageService from '../services/message.service';
import { PaginatedRequest } from '../middleware/pagination.middleware';

export const getMessages = async (req: PaginatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { limit = 20, skip = 0 } = req.pagination || {};
    const partnerId = req.query.partnerId as string | undefined;

    if (partnerId) {
      const messages = await messageService.getMessagesWithUser(req.userId!, partnerId, skip, limit);
      res.json(messages);
    } else {
      const conversations = await messageService.getConversations(req.userId!);
      res.json(conversations);
    }
  } catch (err) {
    next(err);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { receiverId, type, content, attachmentUrl } = req.body;
    const message = await messageService.sendMessage(req.userId!, receiverId, type || 'TEXT', content, attachmentUrl);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

export const markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const messageId = String(req.params.id);
    await messageService.markAsRead(messageId, req.userId!);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
};
