import '../types/express';
import { Router, Request, Response, RequestHandler } from 'express';
import {
  AnyRouteContract,
  ContractBody,
  ContractParams,
  ContractQuery,
  ContractResponse,
  isRawResponse,
} from '@quran-review/shared';
import { authenticate, authorize, fileAuthenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { config } from '../config';

export interface HandlerCtx<C extends AnyRouteContract> {
  body: ContractBody<C>;
  params: ContractParams<C>;
  query: ContractQuery<C>;
  /** Set by authenticate for non-public contracts (mirrors req.userId / req.userRole). */
  userId?: string;
  userRole?: string;
  req: Request;
  res: Response;
}

export type ContractHandler<C extends AnyRouteContract> = (ctx: HandlerCtx<C>) => Promise<ContractResponse<C>>;

export interface ContractRoute<C extends AnyRouteContract = AnyRouteContract> {
  contract: C;
  handler: ContractHandler<C>;
  /** Extra middleware (e.g. rate limiters) run after access checks, before body validation. */
  pre?: RequestHandler[];
}

export function defineRoute<C extends AnyRouteContract>(
  contract: C,
  handler: ContractHandler<C>,
  opts: { pre?: RequestHandler[] } = {}
): ContractRoute<C> {
  return { contract, handler, pre: opts.pre };
}

/**
 * Builds an Express router from contract routes. Reuses the existing
 * authenticate/authorize/validate middleware so every error body stays
 * byte-identical to the M0 characterization pins.
 */
// Array<ContractRoute<any>> (not ContractRoute[]): handler is contravariant in C,
// so ContractRoute<SpecificContract> is not assignable to ContractRoute<AnyRouteContract>
// under strictFunctionTypes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildContractRouter(routes: Array<ContractRoute<any>>, opts: { mountPrefix: string }): Router {
  const router = Router();
  for (const { contract, handler, pre } of routes) {
    if (!contract.path.startsWith(opts.mountPrefix)) {
      throw new Error(`Contract path ${contract.path} does not start with mountPrefix ${opts.mountPrefix}`);
    }
    const sub = contract.path.slice(opts.mountPrefix.length) || '/';
    const chain: RequestHandler[] = [];
    if (contract.access !== 'public') {
      chain.push(contract.authVia === 'headerOrQueryToken' ? fileAuthenticate : authenticate);
    }
    if (Array.isArray(contract.access)) chain.push(authorize(...contract.access));
    if (pre) chain.push(...pre);
    if (contract.request?.body) chain.push(validate(contract.request.body));
    // Explicit annotations: RequestHandler's own req is core.Request, which the
    // 'express' module augmentation (userId/userRole) does not reach.
    chain.push(async (req: Request, res: Response, next) => {
      try {
        const result = await handler({
          body: req.body,
          params: req.params as never,
          query: req.query as never,
          userId: req.userId,
          userRole: req.userRole,
          req,
          res,
        });
        // Raw responses: the handler already streamed/sent via res (sendFile, CSV).
        if ('handled' in result && result.handled) {
          return;
        }
        const { status, body } = result as { status: number; body: unknown };
        // Fail loud outside production if a handler violates its own contract.
        const schema = (contract.responses as Record<number, { parse: (v: unknown) => unknown }>)[status];
        if (config.env !== 'production' && schema && !isRawResponse(schema) && status !== 204) {
          schema.parse(body);
        }
        if (status === 204) {
          res.status(204).send();
          return;
        }
        res.status(status).json(body);
      } catch (err) {
        next(err);
      }
    });
    const method = contract.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    router[method](sub, ...chain);
  }
  return router;
}
