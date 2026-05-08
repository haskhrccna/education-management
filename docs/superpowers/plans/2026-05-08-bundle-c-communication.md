# Bundle C: Communication System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the existing messaging backend as a mobile UI — direct messaging for students/teachers plus admin broadcast, with unread badge on all three home screen headers.

**Architecture:** Mobile-only changes. All backend endpoints already exist. Add two API functions, extend the existing hook, add a new conversation hook, create 3 new screens, add 💬 icon to 3 home screens, add 13 i18n keys.

**Tech Stack:** Expo Router (file-based routing), react-i18next, Zustand (useAuthStore, useSettingsStore), react-native core components, existing `messagesApi` and `useMessages` hook.

---

## Task 1: i18n Keys

**Files:**
- Modify: `mobile/src/i18n/index.ts`

- [ ] **Step 1: Add 13 translation keys to arTranslations**

Open `mobile/src/i18n/index.ts`. Find `const arTranslations = {` and add these entries (end of the object is fine):

```typescript
messages: 'رسائل',
conversations: 'المحادثات',
typeMessage: 'اكتب رسالة...',
noConversations: 'لا توجد رسائل',
noConversationsDesc: 'ستظهر محادثاتك هنا',
broadcastMessage: 'إرسال إشعار عام',
broadcastRecipients: 'المستلمون',
allUsers: 'جميع المستخدمين',
studentsOnly: 'الطلاب فقط',
teachersOnly: 'المعلمون فقط',
broadcastSent: 'تم الإرسال بنجاح',
sendBroadcast: 'إرسال',
messageLabel: 'رسالة',
```

- [ ] **Step 2: Add the same 13 keys to enTranslations**

Find `const enTranslations = {` and add:

```typescript
messages: 'Messages',
conversations: 'Conversations',
typeMessage: 'Type a message...',
noConversations: 'No messages yet',
noConversationsDesc: 'Your conversations will appear here',
broadcastMessage: 'Broadcast Message',
broadcastRecipients: 'Recipients',
allUsers: 'All Users',
studentsOnly: 'Students Only',
teachersOnly: 'Teachers Only',
broadcastSent: 'Broadcast sent successfully',
sendBroadcast: 'Send',
messageLabel: 'Message',
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to i18n.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/i18n/index.ts
git commit -m "feat(i18n): add messaging translation keys (Bundle C)"
```

---

## Task 2: API Layer — Add getThread and broadcast

**Files:**
- Modify: `mobile/src/api/messages.ts`

- [ ] **Step 1: Read the current file**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/mobile/src/api/messages.ts
```

Note the exact shape of the exported object (contains `getConversations`, `send`, `markRead`).

- [ ] **Step 2: Add getThread and broadcast functions**

Locate the closing `}` of the exported object. Add before it:

```typescript
getThread: async (partnerId: string) => {
  const res = await apiClient.get('/messages', { params: { partnerId } });
  return res.data;
},
broadcast: async (content: string, targetRole?: 'STUDENT' | 'TEACHER') => {
  await apiClient.post('/admin/broadcast', { content, targetRole });
},
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/api/messages.ts
git commit -m "feat(messages): add getThread and broadcast API functions"
```

---

## Task 3: useMessages Hook — Add unreadCount

**Files:**
- Modify: `mobile/src/hooks/useMessages.ts`

- [ ] **Step 1: Read the current file**

```bash
cat -n /Users/haskhr/Documents/opencode/education_management/mobile/src/hooks/useMessages.ts
```

Note what is currently returned and what imports exist.

- [ ] **Step 2: Import useAuthStore**

At the top of the file, add (if not already present):

```typescript
import { useAuthStore } from '../auth/store';
```

- [ ] **Step 3: Derive unreadCount inside the hook**

Inside the hook body (after the `messages` state is declared), add:

```typescript
const { user } = useAuthStore();
const unreadCount = messages.filter(
  (m: any) => !m.readAt && m.receiverId === user?.id
).length;
```

- [ ] **Step 4: Add unreadCount to the return value**

Find the `return { ... }` statement and add `unreadCount`:

```typescript
return { messages, isLoading, error, fetchMessages, sendMessage, unreadCount };
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/hooks/useMessages.ts
git commit -m "feat(messages): expose unreadCount from useMessages hook"
```

---

## Task 4: New Hook — useConversation

**Files:**
- Create: `mobile/src/hooks/useConversation.ts`

- [ ] **Step 1: Create the file**

```typescript
import { useState, useCallback } from 'react';
import { messagesApi } from '../api/messages';
import { useAuthStore } from '../auth/store';

export function useConversation(partnerId: string) {
  const [thread, setThread] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const fetchThread = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await messagesApi.getThread(partnerId);
      // Mark received unread messages as read (fire-and-forget)
      data
        .filter((m: any) => !m.readAt && m.receiverId === user?.id)
        .forEach((m: any) => messagesApi.markRead(m.id).catch(() => {}));
      setThread([...data].reverse()); // chronological order
    } catch {
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [partnerId, user?.id]);

  const sendMessage = useCallback(async (content: string) => {
    await messagesApi.send(partnerId, content, 'TEXT');
    await fetchThread();
  }, [partnerId, fetchThread]);

  return { thread, isLoading, error, fetchThread, sendMessage };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/hooks/useConversation.ts
git commit -m "feat(messages): add useConversation hook for chat thread"
```

---

## Task 5: Screen — Conversations List

**Files:**
- Create: `mobile/app/messages/index.tsx`

- [ ] **Step 1: Create the conversations list screen**

```typescript
import React, { useEffect } from 'react';
import {
  SafeAreaView, FlatList, TouchableOpacity,
  Text, View, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';
import { useMessages } from '@/src/hooks/useMessages';

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const { messages, isLoading, fetchMessages } = useMessages();

  useEffect(() => { fetchMessages(); }, []);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backBtn: { marginRight: SPACING.sm, padding: 4 },
    backText: { fontSize: 20, color: COLORS.primary },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: COLORS.primary,
      alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm,
    },
    avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    preview: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
    unreadDot: {
      width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary,
    },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
    emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
    emptyDesc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  });

  const renderItem = ({ item }: { item: any }) => {
    const partner = item.partner;
    const initial = partner.firstName?.[0]?.toUpperCase() || '?';
    const partnerName = `${partner.firstName} ${partner.lastName}`;
    const hasUnread = (item.unreadCount ?? 0) > 0;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push({
          pathname: '/messages/conversation',
          params: { partnerId: partner.id, partnerName },
        })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{partnerName}</Text>
          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessage?.content ?? ''}
          </Text>
        </View>
        {hasUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('messages')}</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>{t('noConversations')}</Text>
          <Text style={styles.emptyDesc}>{t('noConversationsDesc')}</Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.partner.id}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/messages/index.tsx
git commit -m "feat(messages): add conversations list screen"
```

---

## Task 6: Screen — Chat Thread

**Files:**
- Create: `mobile/app/messages/conversation.tsx`

- [ ] **Step 1: Create the chat thread screen**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView, FlatList, TouchableOpacity, Text, View,
  TextInput, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';
import { useConversation } from '@/src/hooks/useConversation';
import { useAuthStore } from '@/src/auth/store';

export default function ConversationScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const { partnerId, partnerName } = useLocalSearchParams<{ partnerId: string; partnerName: string }>();
  const { user } = useAuthStore();
  const { thread, isLoading, error, fetchThread, sendMessage } = useConversation(partnerId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => { fetchThread(); }, []);
  useEffect(() => {
    if (thread.length > 0) listRef.current?.scrollToEnd({ animated: false });
  }, [thread.length]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    try {
      await sendMessage(content);
    } catch {
      Alert.alert('Error', 'Failed to send message');
      setDraft(content);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backBtn: { marginRight: SPACING.sm, padding: 4 },
    backText: { fontSize: 20, color: COLORS.primary },
    headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    bubble: {
      maxWidth: '75%', padding: SPACING.sm, marginHorizontal: SPACING.md,
      marginVertical: 3, borderRadius: RADIUS.md,
    },
    myBubble: { alignSelf: 'flex-end', backgroundColor: COLORS.primary },
    theirBubble: { alignSelf: 'flex-start', backgroundColor: COLORS.card },
    myText: { color: '#fff', fontSize: 14 },
    theirText: { color: COLORS.text, fontSize: 14 },
    timestamp: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, textAlign: 'right' },
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end',
      padding: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    textInput: {
      flex: 1, minHeight: 36, maxHeight: 120,
      backgroundColor: COLORS.background, borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
      color: COLORS.text, fontSize: 14, marginRight: SPACING.xs,
    },
    sendBtn: {
      backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    },
    sendText: { color: '#fff', fontWeight: '700' },
    errorText: { textAlign: 'center', color: '#ef4444', marginTop: SPACING.md },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{partnerName}</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
        ) : error ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchThread} style={{ marginTop: SPACING.sm, alignItems: 'center' }}>
              <Text style={{ color: COLORS.primary }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={thread}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isMine = item.senderId === user?.id;
              const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
                  <Text style={isMine ? styles.myText : styles.theirText}>{item.content}</Text>
                  <Text style={styles.timestamp}>{time}</Text>
                </View>
              );
            }}
          />
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('typeMessage')}
            placeholderTextColor={COLORS.textSecondary}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: draft.trim() ? 1 : 0.5 }]}
            onPress={handleSend}
            disabled={!draft.trim()}
          >
            <Text style={styles.sendText}>{t('sendBroadcast')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/messages/conversation.tsx
git commit -m "feat(messages): add chat thread screen with keyboard-aware input"
```

---

## Task 7: Screen — Admin Broadcast

**Files:**
- Create: `mobile/app/admin/broadcast.tsx`

- [ ] **Step 1: Create the broadcast screen**

```typescript
import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/src/settings/store';
import { getColors, SPACING, RADIUS } from '@/constants/theme';
import { messagesApi } from '@/src/api/messages';

type TargetRole = 'ALL' | 'STUDENT' | 'TEACHER';

export default function BroadcastScreen() {
  const { t } = useTranslation();
  const { theme, darkMode } = useSettingsStore();
  const COLORS = getColors(theme, darkMode);
  const [target, setTarget] = useState<TargetRole>('ALL');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!content.trim()) return;
    setIsSending(true);
    try {
      const targetRole = target === 'ALL' ? undefined : target;
      await messagesApi.broadcast(content.trim(), targetRole as 'STUDENT' | 'TEACHER' | undefined);
      Alert.alert(t('broadcastSent'), '', [{ text: 'OK', onPress: () => router.back() }]);
    } catch {
      Alert.alert('Error', 'Failed to send broadcast');
    } finally {
      setIsSending(false);
    }
  };

  const chips: { key: TargetRole; label: string }[] = [
    { key: 'ALL', label: t('allUsers') },
    { key: 'STUDENT', label: t('studentsOnly') },
    { key: 'TEACHER', label: t('teachersOnly') },
  ];

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backBtn: { marginRight: SPACING.sm, padding: 4 },
    backText: { fontSize: 20, color: COLORS.primary },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    body: { padding: SPACING.md, gap: SPACING.md },
    sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
    chipsRow: { flexDirection: 'row', gap: SPACING.xs },
    chip: {
      paddingHorizontal: SPACING.sm, paddingVertical: 6,
      borderRadius: 99, borderWidth: 1.5, borderColor: COLORS.border,
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 13, color: COLORS.text },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    textInput: {
      backgroundColor: COLORS.card, borderRadius: RADIUS.md,
      padding: SPACING.sm, color: COLORS.text, fontSize: 15,
      minHeight: 120, textAlignVertical: 'top',
      borderWidth: 1, borderColor: COLORS.border,
    },
    sendBtn: {
      backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
      padding: SPACING.sm, alignItems: 'center',
    },
    sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('broadcastMessage')}</Text>
      </View>
      <View style={styles.body}>
        <View>
          <Text style={styles.sectionLabel}>{t('broadcastRecipients')}</Text>
          <View style={styles.chipsRow}>
            {chips.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, target === c.key && styles.chipActive]}
                onPress={() => setTarget(c.key)}
              >
                <Text style={[styles.chipText, target === c.key && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View>
          <Text style={styles.sectionLabel}>{t('messageLabel')}</Text>
          <TextInput
            style={styles.textInput}
            value={content}
            onChangeText={setContent}
            placeholder={t('typeMessage')}
            placeholderTextColor={COLORS.textSecondary}
            multiline
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { opacity: content.trim() && !isSending ? 1 : 0.5 }]}
          onPress={handleSend}
          disabled={!content.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendBtnText}>{t('sendBroadcast')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/admin/broadcast.tsx
git commit -m "feat(messages): add admin broadcast compose screen"
```

---

## Task 8: Header Icons — All Three Home Screens

**Files:**
- Modify: `mobile/app/student/home.tsx`
- Modify: `mobile/app/teacher/home.tsx`
- Modify: `mobile/app/admin/home.tsx`

### 8a: Student Home

- [ ] **Step 1: Read current student home header area**

```bash
grep -n "router\|iconBtn\|logout\|useMessages\|header" /Users/haskhr/Documents/opencode/education_management/mobile/app/student/home.tsx | head -40
```

- [ ] **Step 2: Add useMessages import and call**

At the top of `student/home.tsx`, add:

```typescript
import { useMessages } from '@/src/hooks/useMessages';
```

Inside the component body, add:

```typescript
const { unreadCount } = useMessages();
```

- [ ] **Step 3: Add badge styles to StyleSheet**

In the `StyleSheet.create({...})` object, add:

```typescript
msgIconBtn: {
  width: 32, height: 32, backgroundColor: 'rgba(255,255,255,0.2)',
  borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  marginRight: 6,
},
msgIconText: { fontSize: 16 },
msgBadge: {
  position: 'absolute', top: -4, right: -4,
  minWidth: 16, height: 16, borderRadius: 8,
  backgroundColor: '#ef4444',
  alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
},
msgBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
```

- [ ] **Step 4: Add 💬 icon to header JSX before existing icons**

In the header row (before logout/grades icons), add:

```tsx
<TouchableOpacity
  style={styles.msgIconBtn}
  onPress={() => router.push('/messages')}
>
  <Text style={styles.msgIconText}>💬</Text>
  {unreadCount > 0 && (
    <View style={[styles.msgBadge, { position: 'absolute', top: -4, right: -4 }]}>
      <Text style={styles.msgBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
    </View>
  )}
</TouchableOpacity>
```

### 8b: Teacher Home

- [ ] **Step 5: Read current teacher home header area**

```bash
grep -n "router\|iconBtn\|logout\|useMessages\|header" /Users/haskhr/Documents/opencode/education_management/mobile/app/teacher/home.tsx | head -40
```

- [ ] **Step 6: Apply same 💬 pattern to teacher home**

Repeat steps 2–4 for `mobile/app/teacher/home.tsx`. Same imports, same `const { unreadCount } = useMessages()`, same styles object additions, same JSX.

### 8c: Admin Home

- [ ] **Step 7: Read current admin home header area**

```bash
grep -n "router\|iconBtn\|logout\|useMessages\|broadcast\|header" /Users/haskhr/Documents/opencode/education_management/mobile/app/admin/home.tsx | head -40
```

- [ ] **Step 8: Apply 💬 pattern to admin home**

Repeat steps 2–4 for `mobile/app/admin/home.tsx`.

- [ ] **Step 9: Add 📢 broadcast icon to admin header**

In the admin header JSX, after the 💬 button, add:

```tsx
<TouchableOpacity
  style={styles.msgIconBtn}
  onPress={() => router.push('/admin/broadcast')}
>
  <Text style={styles.msgIconText}>📢</Text>
</TouchableOpacity>
```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd /Users/haskhr/Documents/opencode/education_management/mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add mobile/app/student/home.tsx mobile/app/teacher/home.tsx mobile/app/admin/home.tsx
git commit -m "feat(messages): add 💬 header icon with unread badge to all home screens"
```

---

## Self-Review Checklist

After all tasks complete, verify:

1. **Spec coverage:**
   - [ ] `getThread` + `broadcast` added to `mobile/src/api/messages.ts`
   - [ ] `unreadCount` exported from `useMessages`
   - [ ] `useConversation` hook created at `mobile/src/hooks/useConversation.ts`
   - [ ] `/messages` screen lists conversations
   - [ ] `/messages/conversation` shows chat thread
   - [ ] `/admin/broadcast` composes + sends broadcast
   - [ ] 💬 icon on student, teacher, admin home screens
   - [ ] 📢 icon on admin home only
   - [ ] 13 i18n keys added to both `arTranslations` and `enTranslations`

2. **Manual test:**
   - Login as `student@education.com` → see 💬 in header → tap → conversations list renders
   - Login as `teacher@education.com` → same 💬 icon flow
   - Login as `admin@education.com` → see 💬 + 📢 → tap 📢 → broadcast screen with chips
