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

// successResponse was removed in M13: contract-module handlers build their
// envelopes inline, so the last production caller disappeared with the
// legacy controllers.

export function errorResponse(error: string, meta?: ApiResponse['meta']): ApiResponse {
  return { success: false, error, meta };
}
