import { z } from 'zod';
import { defineContract, ErrorEnvelope, DateOut } from './types';
import { SendMessageSchema } from '../validators/common';

const MiniUser = z.looseObject({ id: z.string(), firstName: z.string(), lastName: z.string() });

const MessageRow = z.looseObject({
  id: z.string(),
  senderId: z.string(),
  receiverId: z.string(),
  type: z.enum(['TEXT', 'FILE']),
  content: z.string(),
  attachmentUrl: z.string().nullable(),
  readAt: DateOut.nullable(),
  createdAt: DateOut,
});

const ConversationSummary = z.looseObject({
  partner: MiniUser,
  lastMessage: z.looseObject({
    id: z.string(),
    content: z.string(),
    type: z.enum(['TEXT', 'FILE']),
    createdAt: DateOut,
    readAt: DateOut.nullable(),
    sentByMe: z.boolean(),
  }),
  unreadCount: z.number(),
});

const NotificationRow = z.looseObject({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  readAt: DateOut.nullable(),
  createdAt: DateOut,
});

const PaginationMeta = z.looseObject({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export const communicationContracts = {
  listMessages: defineContract({
    method: 'GET',
    path: '/api/v1/messages',
    summary: 'DUAL SHAPE (pinned): no ?partnerId ⇒ conversation summaries; ?partnerId ⇒ raw Message[]',
    access: 'authenticated',
    responses: {
      200: z.union([z.array(ConversationSummary), z.array(MessageRow)]),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  sendMessage: defineContract({
    method: 'POST',
    path: '/api/v1/messages',
    summary:
      'Send within teacher↔student (ACCEPTED appt) or with ADMIN; attachmentUrl passes outside the schema (pinned)',
    access: 'authenticated',
    request: { body: SendMessageSchema },
    responses: {
      201: MessageRow,
      400: ErrorEnvelope,
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  markMessageRead: defineContract({
    method: 'PUT',
    path: '/api/v1/messages/:id/read',
    summary: 'Receiver-only mark read',
    access: 'authenticated',
    responses: {
      200: z.object({ message: z.literal('Marked as read') }),
      401: ErrorEnvelope,
      403: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
  listNotifications: defineContract({
    method: 'GET',
    path: '/api/v1/notifications',
    summary: 'paginatedResponse {data,meta} — deliberately NOT the success envelope (pinned)',
    access: 'authenticated',
    responses: {
      200: z.looseObject({ data: z.array(NotificationRow), meta: PaginationMeta }),
      401: ErrorEnvelope,
    },
  }),
  markAllNotificationsRead: defineContract({
    method: 'POST',
    path: '/api/v1/notifications/read-all',
    summary: 'Bulk mark read',
    access: 'authenticated',
    responses: {
      200: z.object({ success: z.literal(true), data: z.object({ markedRead: z.number() }) }),
      401: ErrorEnvelope,
    },
  }),
  unreadNotificationCount: defineContract({
    method: 'GET',
    path: '/api/v1/notifications/unread-count',
    summary: 'Badge source',
    access: 'authenticated',
    responses: {
      200: z.object({ success: z.literal(true), data: z.object({ unread: z.number() }) }),
      401: ErrorEnvelope,
    },
  }),
  markNotificationRead: defineContract({
    method: 'PATCH',
    path: '/api/v1/notifications/:id/read',
    summary: 'Owner-only; service plain Error("Notification not found") maps to 404 in the handler (pinned)',
    access: 'authenticated',
    responses: {
      200: z.looseObject({ success: z.literal(true), data: NotificationRow }),
      401: ErrorEnvelope,
      404: ErrorEnvelope,
    },
  }),
};
