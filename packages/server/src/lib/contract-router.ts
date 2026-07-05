import '../types/express';
import { Router, Request, Response, RequestHandler } from 'express';
import { AnyRouteContract, ContractBody, ContractParams, ContractQuery, ContractResponse } from '@quran-review/shared';
import { authenticate, authorize } from '../middleware/auth.middleware';
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
}

export function defineRoute<C extends AnyRouteContract>(contract: C, handler: ContractHandler<C>): ContractRoute<C> {
  return { contract, handler };
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
  for (const { contract, handler } of routes) {
    if (!contract.path.startsWith(opts.mountPrefix)) {
      throw new Error(`Contract path ${contract.path} does not start with mountPrefix ${opts.mountPrefix}`);
    }
    const sub = contract.path.slice(opts.mountPrefix.length) || '/';
    const chain: RequestHandler[] = [];
    if (contract.access !== 'public') chain.push(authenticate);
    if (Array.isArray(contract.access)) chain.push(authorize(...contract.access));
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
        // Fail loud outside production if a handler violates its own contract.
        const schema = (contract.responses as Record<number, { parse: (v: unknown) => unknown }>)[result.status];
        if (config.env !== 'production' && schema && result.status !== 204) {
          schema.parse(result.body);
        }
        if (result.status === 204) {
          res.status(204).send();
          return;
        }
        res.status(result.status).json(result.body);
      } catch (err) {
        next(err);
      }
    });
    const method = contract.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    router[method](sub, ...chain);
  }
  return router;
}
