import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { Role } from '@prisma/client';
import app from '../app';
import { config } from '../config';
import { prisma } from '../prisma/client';
import { setupSocketIO, closeSocketIO } from '../services/socket.service';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

// 1. The socket handshake must apply the same account checks as HTTP, and a
//    connection must end when its token expires or the account is banned,
//    deleted or has its password changed.
// 2. WebRTC signalling is relayed only between two sockets in the same room.

let server: http.Server;
let url: string;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  server = http.createServer(app);
  setupSocketIO(server);
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(truncateAll);
afterEach(() => {
  for (const c of clients.splice(0)) c.disconnect();
});
afterAll(async () => {
  await closeSocketIO();
  await new Promise<void>((r) => server.close(() => r()));
  await disconnect();
});

function open(token: string): ClientSocket {
  const socket = Client(url, { auth: { token }, transports: ['websocket'], reconnection: false });
  clients.push(socket);
  return socket;
}
const connect = (token: string) =>
  new Promise<ClientSocket>((resolve, reject) => {
    const s = open(token);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
const refused = (token: string) =>
  new Promise<string>((resolve, reject) => {
    const s = open(token);
    s.on('connect', () => reject(new Error('connected, expected refusal')));
    s.on('connect_error', (e) => resolve(e.message));
  });
const disconnectedWithin = (s: ClientSocket, ms: number) =>
  new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), ms);
    s.once('disconnect', () => {
      clearTimeout(t);
      resolve(true);
    });
  });
/** Resolves with the event payload, or null if nothing arrives within `ms`. */
const receives = <T>(s: ClientSocket, event: string, ms = 500) =>
  new Promise<T | null>((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    s.once(event, (p: T) => {
      clearTimeout(t);
      resolve(p);
    });
  });
async function join(s: ClientSocket, userId: string, roomId: string) {
  s.emit('halaqa:join', { roomId });
  for (let i = 0; i < 30; i++) {
    if (await prisma.halaqaParticipant.findFirst({ where: { roomId, userId, leftAt: null } })) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('join did not land');
}
const link = (studentId: string, teacherId: string) =>
  prisma.appointment.create({
    data: { studentId, teacherId, requestedDate: new Date(), requestedTime: '10:00', status: 'ACCEPTED' },
  });

describe('socket handshake validates the account, not just the signature', () => {
  it('refuses a banned user', async () => {
    const u = await createUser({ role: Role.STUDENT });
    await prisma.user.update({ where: { id: u.id }, data: { status: 'BANNED' } });
    expect(await refused(u.token)).toMatch(/banned/i);
  });

  it('refuses a deleted user', async () => {
    const u = await createUser({ role: Role.STUDENT });
    await prisma.user.update({ where: { id: u.id }, data: { deletedAt: new Date() } });
    expect(await refused(u.token)).toMatch(/deleted/i);
  });

  it('refuses a token issued before the last password change', async () => {
    const u = await createUser({ role: Role.STUDENT });
    await prisma.user.update({ where: { id: u.id }, data: { passwordChangedAt: new Date(Date.now() + 5000) } });
    expect(await refused(u.token)).toMatch(/password/i);
  });
});

describe('live connections end when the session does', () => {
  it('disconnects when the token expires', async () => {
    const u = await createUser({ role: Role.STUDENT });
    const shortLived = jwt.sign({ userId: u.id, role: u.role }, config.jwtSecret, { expiresIn: 2 });
    const s = await connect(shortLived);
    expect(await disconnectedWithin(s, 4000)).toBe(true);
  });

  it('disconnects a user the moment an admin bans them', async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const u = await createUser({ role: Role.STUDENT });
    const s = await connect(u.token);
    const gone = disconnectedWithin(s, 3000);
    const res = await request(app)
      .put(`/api/v1/admin/users/${u.id}/deactivate`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(await gone).toBe(true);
  });

  it("disconnects the user's live connections when they change their password", async () => {
    const u = await createUser({ role: Role.STUDENT });
    const s = await connect(u.token);
    const gone = disconnectedWithin(s, 3000);
    const res = await request(app)
      .put('/api/v1/users/change-password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ currentPassword: 'Test1234!', newPassword: 'NewPass5678!' });
    expect(res.status).toBe(200);
    expect(await gone).toBe(true);
  });
});

describe('halaqa signalling stays inside the room', () => {
  async function room() {
    const teacher = await createUser({ role: Role.TEACHER });
    const a = await createUser({ role: Role.STUDENT });
    const b = await createUser({ role: Role.STUDENT });
    const outsider = await createUser({ role: Role.STUDENT });
    await link(a.id, teacher.id);
    await link(b.id, teacher.id);
    const r = await prisma.halaqaRoom.create({ data: { teacherId: teacher.id, title: 'r', status: 'LIVE' } });
    return { teacher, a, b, outsider, roomId: r.id };
  }
  const offer = (s: ClientSocket, roomId: string, target: string) =>
    s.emit('halaqa:offer', { roomId, targetUserId: target, sdp: { type: 'offer', sdp: 'x' } });

  it('relays an offer between two members of the room', async () => {
    const w = await room();
    const [sa, sb] = await Promise.all([connect(w.a.token), connect(w.b.token)]);
    await join(sa, w.a.id, w.roomId);
    await join(sb, w.b.id, w.roomId);
    const got = receives<{ fromUserId: string }>(sb, 'halaqa:offer');
    offer(sa, w.roomId, w.b.id);
    expect((await got)?.fromUserId).toBe(w.a.id);
  });

  it('drops an offer from a sender who is not in the room', async () => {
    const w = await room();
    const [sb, so] = await Promise.all([connect(w.b.token), connect(w.outsider.token)]);
    await join(sb, w.b.id, w.roomId);
    const got = receives(sb, 'halaqa:offer');
    offer(so, w.roomId, w.b.id);
    expect(await got).toBeNull();
  });

  it('drops an offer to a target who is connected but not in the room', async () => {
    const w = await room();
    const [sa, sb] = await Promise.all([connect(w.a.token), connect(w.b.token)]);
    await join(sa, w.a.id, w.roomId);
    const got = receives(sb, 'halaqa:offer');
    offer(sa, w.roomId, w.b.id);
    expect(await got).toBeNull();
  });

  it('cannot use a room name as the target to broadcast to the whole room', async () => {
    const w = await room();
    const [sa, sb] = await Promise.all([connect(w.a.token), connect(w.b.token)]);
    await join(sa, w.a.id, w.roomId);
    await join(sb, w.b.id, w.roomId);
    const got = receives(sb, 'halaqa:offer');
    offer(sa, w.roomId, `halaqa:${w.roomId}`);
    expect(await got).toBeNull();
  });
});
