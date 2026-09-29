import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { Role } from '@prisma/client';
import app from '../app';
import { prisma } from '../prisma/client';
import { setupSocketIO, closeSocketIO } from '../services/socket.service';
import { createUser, TestUser } from './factory';
import { truncateAll, disconnect } from './db';

// A live halaqa room is open to its teacher, an admin, and students with an
// ACCEPTED appointment with that teacher. It used to be open to every
// signed-in user: anyone could list, read and join any teacher's live room.

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

function connect(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = Client(url, { auth: { token }, transports: ['websocket'], reconnection: false });
    clients.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

/** Resolves with the first of `halaqa:error` / a participant row, whichever the join produces. */
async function tryJoin(user: TestUser, roomId: string): Promise<'joined' | 'rejected'> {
  const socket = await connect(user.token);
  const rejected = new Promise<'rejected'>((r) => socket.once('halaqa:error', () => r('rejected')));
  socket.emit('halaqa:join', { roomId });
  const joined = (async (): Promise<'joined'> => {
    for (let i = 0; i < 30; i++) {
      const row = await prisma.halaqaParticipant.findFirst({ where: { roomId, userId: user.id } });
      if (row) return 'joined';
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('neither joined nor rejected within 3s');
  })();
  return Promise.race([rejected, joined]);
}

async function world() {
  const teacher = await createUser({ role: Role.TEACHER });
  const otherTeacher = await createUser({ role: Role.TEACHER });
  const linkedStudent = await createUser({ role: Role.STUDENT });
  const strangerStudent = await createUser({ role: Role.STUDENT });
  const parent = await createUser({ role: Role.PARENT });
  const admin = await createUser({ role: Role.ADMIN });
  await prisma.appointment.create({
    data: {
      studentId: linkedStudent.id,
      teacherId: teacher.id,
      requestedDate: new Date(),
      requestedTime: '10:00',
      status: 'ACCEPTED',
    },
  });
  const room = await prisma.halaqaRoom.create({
    data: { teacherId: teacher.id, title: 'Juz Amma circle', status: 'LIVE' },
  });
  return { teacher, otherTeacher, linkedStudent, strangerStudent, parent, admin, roomId: room.id };
}

const get = (path: string, user: TestUser) => request(app).get(path).set('Authorization', `Bearer ${user.token}`);
const roomIds = (res: request.Response) => (res.body.data as { id: string }[]).map((r) => r.id);

describe('GET /halaqa lists only rooms the caller may join', () => {
  it('outsiders see none of this teacher’s rooms; members, the teacher and admins do', async () => {
    const w = await world();
    for (const outsider of [w.strangerStudent, w.parent, w.otherTeacher]) {
      const res = await get('/api/v1/halaqa', outsider);
      expect(res.status).toBe(200);
      expect(roomIds(res)).not.toContain(w.roomId);
    }
    for (const member of [w.linkedStudent, w.teacher, w.admin]) {
      const res = await get('/api/v1/halaqa', member);
      expect(res.status).toBe(200);
      expect(roomIds(res)).toContain(w.roomId);
    }
  });
});

describe('GET /halaqa/:id', () => {
  it('404s for outsiders (no existence leak) and returns the room to members', async () => {
    const w = await world();
    for (const outsider of [w.strangerStudent, w.parent, w.otherTeacher]) {
      expect((await get(`/api/v1/halaqa/${w.roomId}`, outsider)).status).toBe(404);
    }
    for (const member of [w.linkedStudent, w.teacher, w.admin]) {
      expect((await get(`/api/v1/halaqa/${w.roomId}`, member)).status).toBe(200);
    }
  });
});

describe('socket halaqa:join', () => {
  it('rejects an unlinked student and a parent, with no participant row written', async () => {
    const w = await world();
    expect(await tryJoin(w.strangerStudent, w.roomId)).toBe('rejected');
    expect(await tryJoin(w.parent, w.roomId)).toBe('rejected');
    expect(await prisma.halaqaParticipant.count({ where: { roomId: w.roomId } })).toBe(0);
  });

  it('lets the linked student and the room teacher join', async () => {
    const w = await world();
    expect(await tryJoin(w.linkedStudent, w.roomId)).toBe('joined');
    expect(await tryJoin(w.teacher, w.roomId)).toBe('joined');
  });
});
