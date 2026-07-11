import request from 'supertest';
import crypto from 'crypto';
import { Role, UserStatus } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';

beforeEach(truncateAll);
afterAll(disconnect);

const PW = 'Str0ngPass!x';

describe('POST /api/v1/auth/register', () => {
  it('201: creates a PENDING student, raw {message,user} echo (UPPERCASE enums)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'new@example.com',
      password: PW,
      role: 'student',
      firstName: 'New',
      lastName: 'Student',
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Registration successful. Awaiting admin approval.');
    expect(res.body.user).toMatchObject({ email: 'new@example.com', role: 'STUDENT', status: 'PENDING' });
    expect(res.body.user.id).toEqual(expect.any(String));
  });

  it('409 on duplicate email', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).post('/api/v1/auth/register').send({
      email: u.email,
      password: PW,
      role: 'student',
      firstName: 'Dup',
      lastName: 'Dup',
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: 'Email already registered' });
  });

  it("400: role 'parent' is rejected by validation (dead controller branch stays dead)", async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'p@example.com',
      password: PW,
      role: 'parent',
      firstName: 'P',
      lastName: 'P',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^Validation failed: role:/);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('200: lowercase role/status, token works on a protected route', async () => {
    const u = await createUser({ role: Role.TEACHER, password: PW });
    const res = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.user).toMatchObject({ id: u.id, email: u.email, role: 'teacher', status: 'active' });
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));

    const me = await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
  });

  it('401 on wrong password', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const res = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'WrongPass1!' });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: 'Invalid credentials' });
  });

  it('403 when status is not ACTIVE', async () => {
    const u = await createUser({ role: Role.STUDENT, status: UserStatus.PENDING, password: PW });
    const res = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Account is not active. Please wait for admin approval.');
  });
});

describe('POST /api/v1/auth/refresh (rotation)', () => {
  it('rotates: new pair works, the old refresh token is dead', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const login = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });
    const first = login.body.refreshToken;

    const rot = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(rot.status).toBe(200);
    expect(rot.body.token).toEqual(expect.any(String));
    expect(rot.body.refreshToken).toEqual(expect.any(String));
    expect(rot.body.refreshToken).not.toBe(first);

    const replay = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(replay.status).toBe(401);
    expect(replay.body.error).toBe('Invalid refresh token');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('204 and the stored refresh token is invalidated', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    const login = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });

    const out = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${login.body.token}`);
    expect(out.status).toBe(204);

    const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(refresh.status).toBe(401);
  });
});

describe('verify-email / resend-verification', () => {
  it('POST /verify-email → 200 {message, UPPERCASE status}', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).post('/api/v1/auth/verify-email').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Email verified', status: 'ACTIVE' });
  });

  it('POST /resend-verification → 200 message (email send is a no-op in test)', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const res = await request(app).post('/api/v1/auth/resend-verification').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Verification email resent' });
  });
});

describe('forgot-password / reset-password', () => {
  it('forgot-password answers 200 with the same message whether or not the email exists', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const known = await request(app).post('/api/v1/auth/forgot-password').send({ email: u.email });
    const unknown = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(known.body.message).toBe('If that email is registered, a password reset link has been sent');
  });

  it('reset-password: seeded token resets, old sessions die, new password logs in', async () => {
    const u = await createUser({ role: Role.STUDENT, password: PW });
    // The emailed token is not observable black-box — seed its hash directly.
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordResetToken: hash, passwordResetExpiry: new Date(Date.now() + 3_600_000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, newPassword: 'N3wPass!word' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Password reset successfully' });

    const oldLogin = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: PW });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'N3wPass!word' });
    expect(newLogin.status).toBe(200);
  });

  it('400 on an invalid reset token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'deadbeef'.repeat(8), newPassword: 'N3wPass!word' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid or expired reset token');
  });
});
