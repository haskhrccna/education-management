import { Request, Response, NextFunction } from 'express';
import * as messageService from '../services/message.service';
import { AppError } from '../middleware/error.middleware';

export const getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const messages = await messageService.getConversations(req.userId!);
    res.json(messages);
  } catch (err) {
    next(err);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { receiverId, type, content, attachmentUrl } = req.body as any;
    if (!receiverId || !content) throw new AppError(400, 'receiverId and content required');
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
