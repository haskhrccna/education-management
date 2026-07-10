import { communicationContracts } from '@quran-review/shared';
import * as messageService from '../../services/message.service';
import { paginate, PaginatedRequest } from '../../middleware/pagination.middleware';
import { defineRoute, buildContractRouter } from '../../lib/contract-router';

const listMessages = defineRoute(
  communicationContracts.listMessages,
  async ({ query, userId, req }) => {
    const { limit = 20, skip = 0 } = (req as PaginatedRequest).pagination || {};
    const partnerId = query.partnerId as string | undefined;
    if (partnerId) {
      const messages = await messageService.getMessagesWithUser(userId!, partnerId, skip, limit);
      return { status: 200 as const, body: messages };
    }
    const conversations = await messageService.getConversations(userId!);
    return { status: 200 as const, body: conversations };
  },
  { pre: [paginate(20, 100)] }
);

const sendMessage = defineRoute(communicationContracts.sendMessage, async ({ body, userId, req }) => {
  // attachmentUrl deliberately read from req.body: validate() does not strip it,
  // and the legacy controller consumed it despite it being outside the schema (pinned).
  const attachmentUrl = (req.body as { attachmentUrl?: string }).attachmentUrl;
  const message = await messageService.sendMessage(
    userId!,
    body.receiverId,
    (body.type || 'TEXT') as 'TEXT' | 'FILE',
    body.content,
    attachmentUrl
  );
  return { status: 201 as const, body: message };
});

const markMessageRead = defineRoute(communicationContracts.markMessageRead, async ({ params, userId }) => {
  await messageService.markAsRead(String(params.id), userId!);
  return { status: 200 as const, body: { message: 'Marked as read' as const } };
});

export const messagesRouter = buildContractRouter([listMessages, sendMessage, markMessageRead], {
  mountPrefix: '/api/v1/messages',
});
