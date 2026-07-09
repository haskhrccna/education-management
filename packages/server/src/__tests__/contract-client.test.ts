import {
  authContracts,
  createContractClient,
  ContractClientError,
  defineContract,
  rawResponse,
  UserRole,
} from '@quran-review/shared';

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

  it('raw statuses hand back the unconsumed Response without calling json()', async () => {
    const jsonSpy = jest.fn();
    const csvContract = defineContract({
      method: 'GET',
      path: '/api/v1/exports/grades',
      summary: 'raw client test',
      access: [UserRole.TEACHER],
      responses: { 200: rawResponse('text/csv') },
    });
    const fakeResponse = { status: 200, json: jsonSpy, text: async () => 'a,b\n1,2' } as unknown as Response;
    const client = createContractClient({
      baseUrl: 'http://api.local',
      fetchImpl: (async () => fakeResponse) as typeof fetch,
    });
    const res = await client.call(csvContract);
    expect(res.status).toBe(200);
    expect(res.body).toBe(fakeResponse);
    expect(jsonSpy).not.toHaveBeenCalled();
    if (res.status === 200) expect(await res.body.text()).toBe('a,b\n1,2');
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
