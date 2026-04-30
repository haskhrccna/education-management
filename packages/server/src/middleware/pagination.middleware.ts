import { Request, Response, NextFunction } from 'express';

export interface PaginatedRequest extends Request {
  pagination?: {
    page: number;
    limit: number;
    skip: number;
  };
}

export const paginate = (defaultLimit: number = 20, maxLimit: number = 100) => {
  return (req: PaginatedRequest, _res: Response, next: NextFunction): void => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit as string) || defaultLimit));
    req.pagination = { page, limit, skip: (page - 1) * limit };
    next();
  };
};

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}
