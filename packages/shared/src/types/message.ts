import { MessageType } from '../enums/messageType';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  type: MessageType;
  content: string;
  attachmentUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface SendMessageInput {
  receiverId: string;
  type: MessageType.TEXT | MessageType.FILE;
  content: string;
  attachmentUrl?: string;
}
