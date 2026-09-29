import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

// Changing the password must sign out every other device. Old access tokens
// were already rejected (passwordChangedAt), but the refresh token survived,
// so a stolen one kept minting access tokens for 7 days.

beforeEach(truncateAll);
afterAll(disconnect);

const login = (email: string, password: string) => request(app).post('/api/v1/auth/login').send({ email, password });

describe('PUT /users/change-password revokes other sessions', () => {
  it("another device's refresh token stops working; the changing device keeps a working session", async () => {
    const user = await createUser({ role: Role.STUDENT });
    const phone = await login(user.email, 'Test1234!'); // the device that changes the password
    const laptop = await login(user.email, 'Test1234!'); // another signed-in device
    expect(phone.status).toBe(200);
    expect(laptop.status).toBe(200);

    const change = await request(app)
      .put('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${laptop.body.token}`)
      .send({ currentPassword: 'Test1234!', newPassword: 'NewPass5678!' });
    expect(change.status).toBe(200);
    expect(change.body.token).toEqual(expect.any(String));
    expect(change.body.refreshToken).toEqual(expect.any(String));

    // Every refresh token issued before the change is dead.
    for (const old of [phone.body.refreshToken, laptop.body.refreshToken]) {
      expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: old })).status).toBe(401);
    }

    // The changing device carries on with the pair it was just given.
    expect(
      (await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${change.body.token}`)).status
    ).toBe(200);
    expect(
      (await request(app).post('/api/v1/auth/refresh').send({ refreshToken: change.body.refreshToken })).status
    ).toBe(200);

    // And the new password is the one that works.
    expect((await login(user.email, 'Test1234!')).status).toBe(401);
    expect((await login(user.email, 'NewPass5678!')).status).toBe(200);
  });
});
