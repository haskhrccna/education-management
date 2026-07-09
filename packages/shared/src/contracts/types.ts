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

/**
 * Marks a response status as raw/non-JSON (file streams, CSV): the handler
 * writes to `res` itself and returns { status, handled: true }; the router
 * skips schema parsing and res.json() for it.
 */
export interface RawResponseMarker {
  readonly raw: true;
  readonly contentType: string;
}
export const rawResponse = (contentType: string): RawResponseMarker => ({ raw: true, contentType });
export const isRawResponse = (v: unknown): v is RawResponseMarker =>
  typeof v === 'object' && v !== null && (v as RawResponseMarker).raw === true;

export type ResponseSchema = z.ZodType | RawResponseMarker;

export interface RouteContract<
  TParams extends z.ZodType = z.ZodType,
  TQuery extends z.ZodType = z.ZodType,
  TBody extends z.ZodType = z.ZodType,
  TResponses extends Record<number, ResponseSchema> = Record<number, ResponseSchema>,
> {
  method: HttpMethod;
  /** Full canonical path (e.g. '/api/v1/auth/login', '/api/health'); params as :name. */
  path: string;
  summary: string;
  access: ContractAccess;
  /** 'headerOrQueryToken' selects fileAuthenticate (Bearer header OR ?token= — the pinned file-download auth). */
  authVia?: 'header' | 'headerOrQueryToken';
  request?: { params?: TParams; query?: TQuery; body?: TBody };
  /** Response schema per status code. 204 uses z.undefined(); raw statuses use rawResponse(contentType). */
  responses: TResponses;
}

/** Widened alias for registries and generic helpers. */
export type AnyRouteContract = RouteContract<z.ZodType, z.ZodType, z.ZodType, Record<number, ResponseSchema>>;

/** Identity helper that preserves literal types for inference. */
export const defineContract = <
  TParams extends z.ZodType,
  TQuery extends z.ZodType,
  TBody extends z.ZodType,
  TResponses extends Record<number, ResponseSchema>,
>(
  c: RouteContract<TParams, TQuery, TBody, TResponses>
): RouteContract<TParams, TQuery, TBody, TResponses> => c;

/**
 * Discriminated union of every declared response. JSON statuses are
 * { status, body }; raw statuses are { status, handled: true } — the handler
 * has already written the response to `res` itself.
 */
export type ContractResponse<C extends AnyRouteContract> = {
  [S in keyof C['responses'] & number]: C['responses'][S] extends RawResponseMarker
    ? { status: S; handled: true }
    : { status: S; body: z.infer<Extract<C['responses'][S], z.ZodType>> };
}[keyof C['responses'] & number];

/**
 * Client-side view of the same union: raw statuses resolve to the unconsumed
 * fetch Response so the caller decides how to read the payload.
 */
export type ContractClientResponse<C extends AnyRouteContract> = {
  [S in keyof C['responses'] & number]: C['responses'][S] extends RawResponseMarker
    ? { status: S; body: Response }
    : { status: S; body: z.infer<Extract<C['responses'][S], z.ZodType>> };
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
