# Bundle C: Communication System — Design Spec
**Date:** 2026-05-08
**Scope:** Mobile-only (UI). Backend API + service layer already complete. Zero backend changes.

---

## Goal

Surface the existing messaging backend as a usable UI. Students and teachers can message each other directly; admins can send broadcasts to all users or by role. Unread count badge appears in the 💬 header icon on all three home screens.

---

## Navigation

**Option B — Header Icon** (chosen).

A 💬 icon with an unread badge is added to the header of all three home screens (`student/home.tsx`, `teacher/home.tsx`, `admin/home.tsx`). Tapping it navigates to `/messages`. The admin home also gets a separate broadcast button (megaphone icon) in its header that navigates to `/admin/broadcast`.

---

## Architecture

### Existing backend endpoints (no changes needed)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/messages` | List conversations (no `?partnerId`) |
| GET | `/api/v1/messages?partnerId=:id` | Load thread with one user |
| POST | `/api/v1/messages` | Send a message `{ receiverId, content, type }` |
| PUT | `/api/v1/messages/:id/read` | Mark one message read |
| POST | `/api/v1/admin/broadcast` | Send broadcast `{ content, targetRole? }` |

### Existing mobile API layer (`mobile/src/api/messages.ts`)

Currently has: `getConversations()`, `send(receiverId, content, type)`, `markRead(messageId)`.
Missing: `getThread(partnerId)` and `broadcast(content, targetRole?)` — add these two functions.

### Existing hook (`mobile/src/hooks/useMessages.ts`)

Currently has: `messages`, `isLoading`, `error`, `fetchMessages`, `sendMessage`.
Missing: `unreadCount` derived from messages where `!m.readAt && m.receiverId === currentUserId`.

---

## Files Changed

| File | Action |
|------|--------|
| `mobile/src/api/messages.ts` | Add `getThread`, `broadcast` |
| `mobile/src/hooks/useMessages.ts` | Add `unreadCount` export |
| `mobile/src/hooks/useConversation.ts` | **New** — thread hook for single conversation |
| `mobile/app/messages/index.tsx` | **New** — conversations list screen |
| `mobile/app/messages/conversation.tsx` | **New** — chat thread screen |
| `mobile/app/admin/broadcast.tsx` | **New** — admin broadcast compose screen |
| `mobile/app/student/home.tsx` | Add 💬 icon + unread badge to header |
| `mobile/app/teacher/home.tsx` | Add 💬 icon + unread badge to header |
| `mobile/app/admin/home.tsx` | Add 💬 icon + unread badge + 📢 icon to header |
| `mobile/src/i18n/index.ts` | Add 13 new translation keys |

---

## API Layer Additions

**File:** `mobile/src/api/messages.ts`

Add to the exported object:

```typescript
getThread: async (partnerId: string): Promise<Message[]> => {
  const res = await apiClient.get('/messages', { params: { partnerId } });
  return res.data;
},
broadcast: async (content: string, targetRole?: 'STUDENT' | 'TEACHER'): Promise<void> => {
  await apiClient.post('/admin/broadcast', { content, targetRole });
},
```

---

## New Hook — useConversation

**File:** `mobile/src/hooks/useConversation.ts`

Single-conversation hook used by `messages/conversation.tsx`.

```typescript
import { useState, useCallback } from 'react';
import { messagesApi } from '../api/messages';

export function useConversation(partnerId: string) {
  const [thread, setThread] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThread = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await messagesApi.getThread(partnerId);
      // mark unread messages as read (fire-and-forget)
      data
        .filter((m: any) => !m.readAt && m.receiverId === partnerId)
        .forEach((m: any) => messagesApi.markRead(m.id).catch(() => {}));
      setThread(data.reverse()); // chronological order
    } catch {
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [partnerId]);

  const sendMessage = useCallback(async (content: string) => {
    await messagesApi.send(partnerId, content, 'TEXT');
    await fetchThread();
  }, [partnerId, fetchThread]);

  return { thread, isLoading, error, fetchThread, sendMessage };
}
```

---

## Unread Count in useMessages

**File:** `mobile/src/hooks/useMessages.ts`

Add import for auth store and derive `unreadCount`:

```typescript
import { useAuthStore } from '../auth/store';

// Inside the hook, after messages state:
const { user } = useAuthStore();
const unreadCount = messages.filter(
  (m: any) => !m.readAt && m.receiverId === user?.id
).length;

// Add to return:
return { messages, isLoading, error, fetchMessages, sendMessage, unreadCount };
```

---

## Screen: Conversations List

**File:** `mobile/app/messages/index.tsx`

- `SafeAreaView` with `COLORS.background`
- Header: back arrow + title `t('messages')`
- `FlatList` of conversations from `useMessages().messages`
- Each row: avatar (initials from `partner.firstName[0]`), partner full name, last message preview, timestamp, unread dot if `unreadCount > 0`
- Tapping a row → `router.push({ pathname: '/messages/conversation', params: { partnerId: item.partner.id, partnerName } })`
- Empty state: icon + `t('noConversations')` + `t('noConversationsDesc')`

```tsx
import { SafeAreaView, FlatList, TouchableOpacity, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/src/settings/store';
import { getColors } from '@/constants/theme';
import { useMessages } from '@/src/hooks/useMessages';

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const { messages, isLoading, fetchMessages, unreadCount } = useMessages();

  // messages from useMessages are conversations (grouped by partner)
  // ...render FlatList
}
```

---

## Screen: Chat Thread

**File:** `mobile/app/messages/conversation.tsx`

- Receives `partnerId` and `partnerName` from route params
- Uses `useConversation(partnerId)`
- `FlatList` of messages, newest at bottom (`inverted` false, scroll to end on mount)
- My messages: right-aligned bubble (COLORS.primary bg, white text)
- Their messages: left-aligned bubble (COLORS.card bg, default text)
- Timestamp in small text below each bubble
- `KeyboardAvoidingView` wraps everything so input stays above keyboard
- Text input + send button at bottom
- Calls `fetchThread()` on mount

---

## Screen: Admin Broadcast

**File:** `mobile/app/admin/broadcast.tsx`

- `SafeAreaView` with `COLORS.background`
- Header: back arrow + title `t('broadcastMessage')`
- Recipient chips: `t('allUsers')` | `t('studentsOnly')` | `t('teachersOnly')` — single-select, styled like filter chips
- `TextInput` multiline for message body
- Send button: calls `messagesApi.broadcast(content, targetRole)`, shows success alert `t('broadcastSent')`, then `router.back()`

---

## Home Screen Header Updates

All three home screens get the same header icon pattern:

```tsx
// In header right side, alongside existing icons:
<TouchableOpacity onPress={() => router.push('/messages')} style={styles.iconBtn}>
  <Text style={styles.iconText}>💬</Text>
  {unreadCount > 0 && (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
    </View>
  )}
</TouchableOpacity>
```

Admin home additionally gets:
```tsx
<TouchableOpacity onPress={() => router.push('/admin/broadcast')} style={styles.iconBtn}>
  <Text style={styles.iconText}>📢</Text>
</TouchableOpacity>
```

Badge styles:
```typescript
badge: {
  position: 'absolute', top: -4, right: -4,
  minWidth: 16, height: 16, borderRadius: 8,
  backgroundColor: '#ef4444',
  alignItems: 'center', justifyContent: 'center',
  paddingHorizontal: 3,
},
badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
```

`unreadCount` comes from `useMessages().unreadCount`.

---

## i18n Changes

**File:** `mobile/src/i18n/index.ts`

Add to both `arTranslations` and `enTranslations`:

| Key | Arabic | English |
|-----|--------|---------|
| `messages` | `رسائل` | `Messages` |
| `conversations` | `المحادثات` | `Conversations` |
| `typeMessage` | `اكتب رسالة...` | `Type a message...` |
| `noConversations` | `لا توجد رسائل` | `No messages yet` |
| `noConversationsDesc` | `ستظهر محادثاتك هنا` | `Your conversations will appear here` |
| `broadcastMessage` | `إرسال إشعار عام` | `Broadcast Message` |
| `broadcastRecipients` | `المستلمون` | `Recipients` |
| `allUsers` | `جميع المستخدمين` | `All Users` |
| `studentsOnly` | `الطلاب فقط` | `Students Only` |
| `teachersOnly` | `المعلمون فقط` | `Teachers Only` |
| `broadcastSent` | `تم الإرسال بنجاح` | `Broadcast sent successfully` |
| `sendBroadcast` | `إرسال` | `Send` |
| `messageLabel` | `رسالة` | `Message` |

---

## Error Handling

- Network errors in conversation screens: show inline error text with retry button
- Send failure: show alert, do not clear the composed message
- Broadcast failure: show alert, stay on compose screen
- Empty message body: disable send button when `content.trim() === ''`

---

## Testing

Manual happy-path on iOS simulator:

1. **student@education.com** — home screen shows 💬 icon; if unread messages exist, red badge appears; tap → conversations list; tap conversation → thread loads, messages display correctly; compose and send a message
2. **teacher@education.com** — same 💬 icon flow; teacher can see/reply to student messages
3. **admin@education.com** — 💬 icon + 📢 icon both visible; tap 📢 → broadcast screen; select "Students Only"; type message; send → success alert; tap 💬 → conversations list shows any direct messages

No backend tests required — zero backend changes.
