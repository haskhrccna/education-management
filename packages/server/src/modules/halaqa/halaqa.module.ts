import { halaqaContracts } from '@quran-review/shared';
import * as halaqaService from '../../services/halaqa.service';
import { AppError } from '../../middleware/error.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listGroups = defineRoute(halaqaContracts.listGroups, async ({ userId }) => {
  const groups = await halaqaService.listGroups(userId!);
  return { status: 200 as const, body: { success: true as const, data: groups } };
});

const createGroup = defineRoute(halaqaContracts.createGroup, async ({ userId, userRole, req }) => {
  if (userRole !== 'TEACHER' && userRole !== 'ADMIN') {
    throw new AppError(403, 'Only teachers can create halaqa groups');
  }
  const { title, attendanceThreshold } = (req.body ?? {}) as { title?: string; attendanceThreshold?: number };
  if (!title || !title.trim()) throw new AppError(400, 'title is required');
  if (typeof attendanceThreshold !== 'number') throw new AppError(400, 'attendanceThreshold is required');
  const group = await halaqaService.createGroup(userId!, title.trim(), attendanceThreshold);
  return { status: 201 as const, body: { success: true as const, data: group } };
});

const getGroup = defineRoute(halaqaContracts.getGroup, async ({ userId, userRole, params }) => {
  const group = await halaqaService.getGroup(String(params.id), userId!, userRole!);
  return { status: 200 as const, body: { success: true as const, data: group } };
});

const listRooms = defineRoute(halaqaContracts.listRooms, async ({ query }) => {
  const status = typeof query.status === 'string' ? query.status : undefined;
  const rooms = await halaqaService.listRooms(status);
  return { status: 200 as const, body: { success: true as const, data: rooms } };
});

const createRoom = defineRoute(halaqaContracts.createRoom, async ({ userId, userRole, req }) => {
  if (userRole !== 'TEACHER' && userRole !== 'ADMIN') throw new AppError(403, 'Only teachers can create rooms');
  const { title, groupId } = (req.body ?? {}) as { title?: string; groupId?: string };
  if (!title || !title.trim()) throw new AppError(400, 'title is required');
  const room = await halaqaService.createRoom(userId!, title.trim(), groupId);
  return { status: 201 as const, body: { success: true as const, data: room } };
});

const getRoom = defineRoute(halaqaContracts.getRoom, async ({ params }) => {
  const room = await halaqaService.getRoom(String(params.id));
  return { status: 200 as const, body: { success: true as const, data: room } };
});

const startRoom = defineRoute(halaqaContracts.startRoom, async ({ userId, params }) => {
  const room = await halaqaService.startRoom(String(params.id), userId!);
  return { status: 200 as const, body: { success: true as const, data: room } };
});

const endRoom = defineRoute(halaqaContracts.endRoom, async ({ userId, userRole, params }) => {
  const room = await halaqaService.endRoom(String(params.id), userId!, userRole!);
  return { status: 200 as const, body: { success: true as const, data: room } };
});

// Groups before rooms: '/groups' must register ahead of '/:id' (legacy router pinned this ordering).
export const halaqaRouter = buildContractRouter(
  [listGroups, createGroup, getGroup, listRooms, createRoom, getRoom, startRoom, endRoom],
  { mountPrefix: '/api/v1/halaqa' }
);
