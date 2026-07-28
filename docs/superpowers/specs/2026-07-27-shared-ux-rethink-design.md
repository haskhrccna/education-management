# F10c: Shared UX Rethink — Design Spec

**Date:** 2026-07-27
**Scope:** Mobile only — `mobile/app/notifications.tsx`, `mobile/app/messages/index.tsx`, `mobile/app/messages/conversation.tsx`. No server changes.
**Cluster:** Shared (2 areas) — one of three F10 specs (Admin / Parent / Shared). Carried from `docs/superpowers/specs/2026-07-14-10x-value-stage-2-design.md` §Stage 5, AC5.4.

---

## Goal

Fix the one concrete functional gap in this cluster — a `new_message` notification opens the conversation list instead of the specific conversation — and bring `messages/index.tsx`, `messages/conversation.tsx`, and `notifications.tsx` up to `DESIGN.md` standards. No structural/IA change: these three screens already do one job each.

## Current State (confirmed by code audit)

`notifications.tsx`'s `handlePress` switch (lines 60-92) routes most notification types to a specific destination (`new_grade` → grade screen, `appointment_update` → appointments, `teacher_change_decision` → teacher-change screen, `badge_earned` → student home, `parent_link_approved` → role home) but `new_message` routes to `/messages` — the conversation **list**, not the conversation itself.

**Confirmed the data needed for the fix already exists:** `message.service.ts`'s `sendMessage()` creates the `Message` row with `senderId` on it and calls `notifyNewMessage(receiverId, message)`, so the full message object — including `senderId` — is what gets stored in the `Notification.data` JSON column (`packages/server/prisma/schema.prisma:517-531`, `Notification.data Json?`). The `senderId` needed to deep-link is already present in the notification payload; no server or schema change is required, only reading it correctly on the mobile side.

`GET /api/v1/messages?partnerId=<id>` already returns `getMessagesWithUser()` (per CLAUDE.md's documented dual-response-shape) — the exact call `messages/conversation.tsx` needs, keyed on the sender's id.

## Architecture

### `notifications.tsx` — deep-link fix

In `handlePress`'s `new_message` case: extract `senderId` from the notification's `data` payload and navigate to `/messages/conversation?partnerId=<senderId>` instead of `/messages`. This matches the pattern the other cases already use (routing to a specific destination using data on the notification, not a generic list). No new API calls — the data is already fetched with the notification list.

### `messages/index.tsx`, `messages/conversation.tsx` — visual polish only

No structural change. Apply the DESIGN.md audit below.

## Visual pass (all three screens)

- **Unread status**: `messages/index.tsx`'s conversation-summary rows show `unreadCount` — replace any bold-text-only or color-only treatment with a proper status pill (icon + color) per the Status-Is-Not-Only-Color Rule.
- **Gold-discipline check**: notification "new"/unread indicators must NOT use Illumination Gold — an unread notification is not an earned achievement, so gold there would be a Rationed Gold Rule violation. Audit `notifications.tsx`'s unread-item styling specifically for this during implementation; if gold is currently used, replace with primary green or a neutral "new" tint.
- **Avatar/card consistency**: conversation rows and message bubbles adopt the same avatar treatment used elsewhere (e.g. parent home, admin approvals) rather than a one-off style local to messages.
- **Timestamp hierarchy**: timestamps use `ink-secondary`, not full-weight `ink`, matching DESIGN.md's typography hierarchy for supporting text.
- Cards/rows: hairline border + `sm` shadow, 16px padding, `rounded.md` — consistent with every other screen in the app.

### Bottom-nav unread badge is wired to the wrong source (added 2026-07-28, reproduced on device)

`BottomNav.tsx:215` reads `const { unreadCount } = useNotifications()` — unread **notifications** — and line 238 renders that number as the badge on the **messages** tab (`unreadCount > 0 && tab.id === 'messages'`). Any unread notification of any type therefore inflates the message badge.

Verified live as admin: the API reported `unreadCount: 0` on the only conversation while the notifications endpoint reported 1 unread; the messages tab showed a "1" badge, which disappeared the moment that notification was marked read.

Fix: the messages badge must count unread **messages** (sum of `unreadCount` across the conversation summaries `getConversations()` already returns). If a notifications badge is also wanted, it belongs on a notifications entry point, not the messages tab. This is squarely AC5.4 territory — a badge that says "you have a message" when you don't is the clearest possible violation of "messages and notifications feel like one product."

### Server-generated notification text is English-only (added 2026-07-28, reproduced on device)

`notification.service.ts` builds notification `title`/`body` as English template literals (e.g. ``title: `New message from ${message.sender?.firstName}` ``). The Arabic-first notification center renders them verbatim — observed as "New message from Ahmad" / "Received" inside an otherwise fully-Arabic screen, violating PRODUCT.md's "Arabic-first, not Arabic-also".

**This is a server-side change and therefore outside this spec's stated mobile-only scope.** It is recorded here so it is not lost, but it should be scheduled as its own item rather than absorbed silently: the fix requires deciding where localization happens (store a message key + params on `Notification.data` and translate at render time on the mobile side, versus translating server-side against a stored user locale). That decision affects push payloads too, since FCM notifications are composed from the same strings.

## Files Changed

| File | Action |
|---|---|
| `mobile/app/notifications.tsx` | Fix `new_message` case in `handlePress` to deep-link via `partnerId`; visual polish (gold-discipline check on unread indicator) |
| `mobile/app/messages/index.tsx` | Visual polish: status pill for unread count, avatar/timestamp consistency |
| `mobile/app/messages/conversation.tsx` | Visual polish: message bubble/avatar consistency |
| `mobile/src/components/BottomNav.tsx` | Fix the messages-tab badge to count unread messages, not unread notifications |

## Out of Scope

- Merging notifications into the messages screen as a unified inbox — AC5.4 asks for cross-linking ("feel like one product"), not a merge; the two remain separate screens with one deep-link between them.
- Any change to `getConversations()`/`getMessagesWithUser()` response shapes — CLAUDE.md-documented dual-shape behavior stays exactly as-is; mobile consumers already handle it correctly per that doc.
- Push-notification payload changes — the deep-link fix uses data already present in the in-app notification list; FCM push payload content is unaffected.
- **Localizing server-generated notification `title`/`body`** — the gap is documented above, but the fix is server-side and needs its own scoping decision (see that section). Do not absorb it into this cluster's mobile-only work.

## Testing

1. Trigger a `new_message` notification (as receiver), tap it, verify navigation lands on `messages/conversation` with the correct `partnerId` (the actual sender), not the conversation list.
2. Verify all other notification-type routes in `handlePress` are unchanged (regression check — this is a one-case fix, not a rewrite of the switch).
3. Badge correctness: with ≥1 unread **notification** and **zero** unread messages, the messages tab shows **no** badge (this exact state is reproducible from the seed data and is what the current code gets wrong).
4. Badge correctness, positive path: send an unread message to the logged-in user and verify the messages tab badge equals the number of conversations with unread messages (or total unread, whichever the implementation picks — state which in the plan).
5. Visual: unread conversation rows show an icon+color pill, not color-only or bold-only.
6. Visual: no gold appears on any unread/new indicator across the three screens (grep + manual check during implementation).
7. All three screens pass the mobile gates (contrast, i18n completeness, `AppText` scale) per AC5.5.
