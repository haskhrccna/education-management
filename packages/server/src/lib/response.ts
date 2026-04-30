export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    requestId?: string;
  };
}

export function successResponse<T>(data: T, meta?: ApiResponse<T>['meta']): ApiResponse<T> {
  return { success: true, data, meta };
}

export function errorResponse(error: string, meta?: ApiResponse['meta']): ApiResponse {
  return { success: false, error, meta };
}
