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

/**
 * Prisma Date fields: the contract router parses the handler result BEFORE
 * res.json() serializes (Date object); the typed client parses AFTER (ISO string).
 * The union satisfies both sides of the wire.
 */
export const DateOut = z.union([z.date(), z.string()]);

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

/** The declared schema for one request slot, with optionality stripped (never if absent). */
type BodySchema<C extends AnyRouteContract> = Exclude<NonNullable<C['request']>['body'], undefined>;
type ParamsSchema<C extends AnyRouteContract> = Exclude<NonNullable<C['request']>['params'], undefined>;
type QuerySchema<C extends AnyRouteContract> = Exclude<NonNullable<C['request']>['query'], undefined>;

// `z.ZodType extends S` detects the uninferred wide default (slot not declared on the contract).
export type ContractBody<C extends AnyRouteContract> = [BodySchema<C>] extends [never]
  ? undefined
  : z.ZodType extends BodySchema<C>
    ? undefined
    : z.infer<BodySchema<C>>;

export type ContractParams<C extends AnyRouteContract> = [ParamsSchema<C>] extends [never]
  ? Record<string, string>
  : z.ZodType extends ParamsSchema<C>
    ? Record<string, string>
    : z.infer<ParamsSchema<C>>;

export type ContractQuery<C extends AnyRouteContract> = [QuerySchema<C>] extends [never]
  ? Record<string, unknown>
  : z.ZodType extends QuerySchema<C>
    ? Record<string, unknown>
    : z.infer<QuerySchema<C>>;
