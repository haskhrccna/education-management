import {
  AnyRouteContract,
  ContractBody,
  ContractClientResponse,
  ContractParams,
  ContractQuery,
  isRawResponse,
} from './types';

export class ContractClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(`Undeclared response status ${status}`);
    this.name = 'ContractClientError';
  }
}

export interface ContractClientOptions {
  /** Origin only, no trailing slash — contract paths are absolute (e.g. '/api/v1/auth/login'). */
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getToken?: () => string | null | undefined;
}

export interface CallArgs<C extends AnyRouteContract> {
  body?: ContractBody<C>;
  params?: ContractParams<C>;
  query?: ContractQuery<C>;
}

export function createContractClient(opts: ContractClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async call<C extends AnyRouteContract>(contract: C, args: CallArgs<C> = {}): Promise<ContractClientResponse<C>> {
      let path = contract.path;
      for (const [key, value] of Object.entries((args.params ?? {}) as Record<string, string>)) {
        path = path.replace(`:${key}`, encodeURIComponent(value));
      }
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries((args.query ?? {}) as Record<string, unknown>)) {
        if (value !== undefined) query.append(key, String(value));
      }
      const qs = query.toString().length > 0 ? `?${query.toString()}` : '';

      const headers: Record<string, string> = {};
      if (args.body !== undefined) headers['Content-Type'] = 'application/json';
      const token = opts.getToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await doFetch(`${opts.baseUrl}${path}${qs}`, {
        method: contract.method,
        headers,
        body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
      });

      const schema = (contract.responses as Record<number, { parse: (v: unknown) => unknown }>)[res.status];
      if (!schema) {
        const raw = await res.json().catch(() => undefined);
        throw new ContractClientError(res.status, raw);
      }
      // Raw statuses: hand back the unconsumed Response (file/CSV payloads).
      if (isRawResponse(schema)) {
        return { status: res.status, body: res } as ContractClientResponse<C>;
      }
      const raw = res.status === 204 ? undefined : await res.json();
      return { status: res.status, body: schema.parse(raw) } as ContractClientResponse<C>;
    },
  };
}
