import { z } from 'zod';
import { UserRole } from '../enums/roles';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** 'public' | 'authenticated' | explicit UPPERCASE role allow-list (same values authorize() compares). */
export type ContractAccess = 'public' | 'authenticated' | UserRole[];

/** Every non-2xx error body in this API (errorHandler + 404 handler shape, pinned by M0). */
export const ErrorEnvelope = z.object({
  success: z.literal(false),
  error: z.string(),
  meta: z.object({ requestId: z.string().optional() }).optional(),
});

export interface RouteContract<
  TParams extends z.ZodType = z.ZodType,
  TQuery extends z.ZodType = z.ZodType,
  TBody extends z.ZodType = z.ZodType,
  TResponses extends Record<number, z.ZodType> = Record<number, z.ZodType>,
> {
  method: HttpMethod;
  /** Full canonical path (e.g. '/api/v1/auth/login', '/api/health'); params as :name. */
  path: string;
  summary: string;
  access: ContractAccess;
  request?: { params?: TParams; query?: TQuery; body?: TBody };
  /** Response schema per status code. 204 uses z.undefined(). */
  responses: TResponses;
}

/** Widened alias for registries and generic helpers. */
export type AnyRouteContract = RouteContract<z.ZodType, z.ZodType, z.ZodType, Record<number, z.ZodType>>;

/** Identity helper that preserves literal types for inference. */
export const defineContract = <
  TParams extends z.ZodType,
  TQuery extends z.ZodType,
  TBody extends z.ZodType,
  TResponses extends Record<number, z.ZodType>,
>(
  c: RouteContract<TParams, TQuery, TBody, TResponses>
): RouteContract<TParams, TQuery, TBody, TResponses> => c;

/** Discriminated union of { status, body } for every declared response. */
export type ContractResponse<C extends AnyRouteContract> = {
  [S in keyof C['responses'] & number]: { status: S; body: z.infer<C['responses'][S]> };
}[keyof C['responses'] & number];

export type ContractBody<C extends AnyRouteContract> = C['request'] extends { body: infer B extends z.ZodType }
  ? z.infer<B>
  : undefined;

export type ContractParams<C extends AnyRouteContract> = C['request'] extends {
  params: infer P extends z.ZodType;
}
  ? z.infer<P>
  : Record<string, string>;

export type ContractQuery<C extends AnyRouteContract> = C['request'] extends { query: infer Q extends z.ZodType }
  ? z.infer<Q>
  : Record<string, unknown>;
