import { authContracts, createContractClient, ContractClientError } from '@quran-review/shared';

type FetchArgs = { url: string; init: RequestInit };

function stubFetch(status: number, body: unknown, capture: FetchArgs[]) {
  return (async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    capture.push({ url: String(url), init: init ?? {} });
    return {
      status,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
}

describe('createContractClient', () => {
  const loginBody = {
    message: 'Login successful',
    user: {
      id: 'u-1',
      email: 'a@b.c',
      role: 'student',
      firstName: 'A',
      lastName: 'B',
      status: 'active',
    },
    token: 't',
    refreshToken: 'r'.repeat(64),
  };

  it('builds URL/method/headers/body from the contract and parses the typed response', async () => {
    const calls: FetchArgs[] = [];
    const client = createContractClient({
      baseUrl: 'http://api.local',
      fetchImpl: stubFetch(200, loginBody, calls),
    });
    const res = await client.call(authContracts.login, { body: { email: 'a@b.c', password: 'pw' } });
    expect(calls[0].url).toBe('http://api.local/api/v1/auth/login');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: 'a@b.c', password: 'pw' });
    expect(res.status).toBe(200);
    if (res.status === 200) expect(res.body.user.role).toBe('student');
  });

  it('attaches Authorization header when getToken returns a token', async () => {
    const calls: FetchArgs[] = [];
    const client = createContractClient({
      baseUrl: 'http://api.local',
      fetchImpl: stubFetch(204, undefined, calls),
      getToken: () => 'jwt-123',
    });
    const res = await client.call(authContracts.logout);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-123');
    expect(res.status).toBe(204);
  });

  it('declared error statuses come back as typed results, not throws', async () => {
    const client = createContractClient({
      baseUrl: 'http://api.local',
      fetchImpl: stubFetch(401, { success: false, error: 'Invalid credentials' }, []),
    });
    const res = await client.call(authContracts.login, { body: { email: 'a@b.c', password: 'no' } });
    expect(res.status).toBe(401);
    if (res.status === 401) expect(res.body.error).toBe('Invalid credentials');
  });

  it('undeclared statuses throw ContractClientError', async () => {
    const client = createContractClient({
      baseUrl: 'http://api.local',
      fetchImpl: stubFetch(418, { success: false, error: 'teapot' }, []),
    });
    await expect(client.call(authContracts.login, { body: { email: 'a@b.c', password: 'x' } })).rejects.toBeInstanceOf(
      ContractClientError
    );
  });
});
