import http from 'http';
import { AddressInfo } from 'net';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { setupSocketIO, closeSocketIO } from '../services/socket.service';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

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

function connect(token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = Client(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
    clients.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

function waitFor<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

/** Poll until the async server-side effect lands (max ~3s). */
async function until(cond: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 30; i++) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('condition not met within 3s');
}

async function liveRoom(teacher: TestUser) {
  const room = await prisma.halaqaRoom.create({ data: { teacherId: teacher.id, title: 'live', status: 'LIVE' } });
  return room.id;
}

describe('handshake auth (pinned)', () => {
  it('rejects missing token with Authentication required', async () => {
    await expect(connect()).rejects.toMatchObject({ message: 'Authentication required' });
  });

  it('rejects a garbage token with Invalid or expired token', async () => {
    await expect(connect('not-a-jwt')).rejects.toMatchObject({ message: 'Invalid or expired token' });
  });

  it('accepts a valid JWT', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const socket = await connect(student.token);
    expect(socket.connected).toBe(true);
  });
});

describe('presence: join/leave record attendance and broadcast (pinned)', () => {
  it('join upserts a participant row and notifies existing members; leave sets leftAt and notifies', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const roomId = await liveRoom(teacher);

    const teacherSock = await connect(teacher.token);
    teacherSock.emit('halaqa:join', { roomId });
    await until(async () => (await prisma.halaqaParticipant.count({ where: { roomId } })) === 1);

    const studentSock = await connect(student.token);
    const joined = waitFor<{ roomId: string; userId: string }>(teacherSock, 'halaqa:participant-joined');
    studentSock.emit('halaqa:join', { roomId });
    expect(await joined).toEqual({ roomId, userId: student.id });

    const row = await prisma.halaqaParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: student.id } },
    });
    expect(row?.leftAt).toBeNull();

    const left = waitFor<{ roomId: string; userId: string }>(teacherSock, 'halaqa:participant-left');
    studentSock.emit('halaqa:leave', { roomId });
    expect(await left).toEqual({ roomId, userId: student.id });
    const after = await prisma.halaqaParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: student.id } },
    });
    expect(after?.leftAt).not.toBeNull();
  });

  it('joining an ENDED room emits halaqa:error with the pinned message', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const room = await prisma.halaqaRoom.create({ data: { teacherId: teacher.id, title: 'x', status: 'ENDED' } });
    const sock = await connect(teacher.token);
    const errP = waitFor<{ message: string }>(sock, 'halaqa:error');
    sock.emit('halaqa:join', { roomId: room.id });
    expect(await errP).toEqual({ message: 'Room has ended' });
  });

  it('disconnect auto-leaves: participant row closed and others notified', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const roomId = await liveRoom(teacher);
    const teacherSock = await connect(teacher.token);
    teacherSock.emit('halaqa:join', { roomId });
    await until(async () => (await prisma.halaqaParticipant.count({ where: { roomId } })) === 1);
    const studentSock = await connect(student.token);
    const joined = waitFor(teacherSock, 'halaqa:participant-joined');
    studentSock.emit('halaqa:join', { roomId });
    await joined;

    const left = waitFor<{ roomId: string; userId: string }>(teacherSock, 'halaqa:participant-left');
    studentSock.disconnect();
    expect(await left).toEqual({ roomId, userId: student.id });
  });
});

describe('WebRTC signaling: pure relay stamped with fromUserId (pinned)', () => {
  it('offer, answer and ICE are forwarded to the target personal room without payload inspection', async () => {
    const teacher = await createUser({ role: Role.TEACHER });
    const student = await createUser({ role: Role.STUDENT });
    const roomId = await liveRoom(teacher);
    const a = await connect(teacher.token);
    const b = await connect(student.token);

    const offer = waitFor<{ roomId: string; fromUserId: string; sdp: unknown }>(b, 'halaqa:offer');
    a.emit('halaqa:offer', { roomId, targetUserId: student.id, sdp: { type: 'offer', blob: 'x' } });
    expect(await offer).toEqual({ roomId, fromUserId: teacher.id, sdp: { type: 'offer', blob: 'x' } });

    const answer = waitFor<{ roomId: string; fromUserId: string; sdp: unknown }>(a, 'halaqa:answer');
    b.emit('halaqa:answer', { roomId, targetUserId: teacher.id, sdp: { type: 'answer' } });
    expect(await answer).toEqual({ roomId, fromUserId: student.id, sdp: { type: 'answer' } });

    const ice = waitFor<{ roomId: string; fromUserId: string; candidate: unknown }>(b, 'halaqa:ice-candidate');
    a.emit('halaqa:ice-candidate', { roomId, targetUserId: student.id, candidate: { c: 1 } });
    expect(await ice).toEqual({ roomId, fromUserId: teacher.id, candidate: { c: 1 } });
  });
});
