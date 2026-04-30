import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
        res.status(400).json({ error: 'Validation failed', details: messages });
        return;
      }
      res.status(400).json({ error: 'Invalid input' });
    }
  };
};
