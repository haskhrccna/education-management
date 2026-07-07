import { authContracts, healthContracts, contractRegistry } from '@quran-review/shared';

describe('contract schemas pin current response shapes', () => {
  it('registry has 66 contracts with unique method+path', () => {
    expect(contractRegistry).toHaveLength(66);
    const keys = contractRegistry.map((c) => `${c.method} ${c.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('login 200 schema accepts the observed login body', () => {
    const observed = {
      message: 'Login successful',
      user: {
        id: '9dfad50c-57bb-4a1b-bf1e-98ddbbb9db29',
        email: 'itest-student-1@itest.local',
        role: 'student',
        firstName: 'Itest',
        lastName: 'STUDENT',
        status: 'active',
      },
      token: 'x.y.z',
      refreshToken: 'a'.repeat(64),
    };
    expect(() => authContracts.login.responses[200].parse(observed)).not.toThrow();
  });

  it('register 201 schema requires UPPERCASE role/status (raw Prisma echo)', () => {
    const observed = {
      message: 'Registration successful. Awaiting admin approval.',
      user: {
        id: '9dfad50c-57bb-4a1b-bf1e-98ddbbb9db29',
        email: 'new@itest.local',
        role: 'STUDENT',
        firstName: 'A',
        lastName: 'B',
        status: 'PENDING',
      },
    };
    expect(() => authContracts.register.responses[201].parse(observed)).not.toThrow();
    expect(() =>
      authContracts.register.responses[201].parse({
        ...observed,
        user: { ...observed.user, role: 'student' },
      })
    ).toThrow();
  });

  it('health 200 schema accepts the observed health envelope', () => {
    const observed = {
      success: true,
      data: {
        status: 'healthy',
        timestamp: '2026-07-05T00:00:00.000Z',
        version: '1.0.0',
        checks: {
          database: { status: 'up', latencyMs: 3 },
          memory: { status: 'up', usedMB: 100, totalMB: 200 },
        },
      },
    };
    expect(() => healthContracts.getHealth.responses[200].parse(observed)).not.toThrow();
  });
});
