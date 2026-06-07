/**
 * Workstream B (my-requests ↔ chat) translation add-ons.
 * Add keys under `he` and `en` mirrors. Merged into `t.*` by `translations.ts`
 * via `deepMerge`, so these extend the existing `myRequests` / `chat`
 * namespaces (access stays `t.myRequests.x` / `t.chat.x`).
 */
export const overhaulRequestsChat = {
  he: {
    myRequests: {
      // req 11 — raw request id moved into the expanded detail panel
      requestId: 'מספר בקשה',
      // req 12 — open this request's chat from the card footer
      openChat: 'פתח/י שיחה',
      // req 9 — highlight banner shown on the focused card (?focus=<id>)
      focusedBadge: 'הבקשה שביקשת',
      // req 10 — kanban-style status columns for active requests
      columns: {
        open:       'פתוחות / דורשות טיפול',
        inProgress: 'בטיפול',
        done:       'הושלמו',
        empty:      'אין בקשות בעמודה זו',
      },
    },
    chat: {
      // req 13a — chat-window "back to list" button label
      allActiveChats: 'כל השיחות הפעילות',
      // req 13b — active / past split on the chat list
      activeTab:   'שיחות פעילות',
      pastTab:     'שיחות שהסתיימו',
      activeEmpty: 'אין שיחות פעילות כרגע.',
      pastEmpty:   'אין שיחות שהסתיימו.',
      pastBadge:   'הסתיימה',
      // req 9 — open the linked request from the chat window header
      openRequest: 'פתח/י את הבקשה',
    },
  },
  en: {
    myRequests: {
      requestId: 'Request ID',
      openChat: 'Open chat',
      focusedBadge: 'The request you opened',
      columns: {
        open:       'Open / needs work',
        inProgress: 'In progress',
        done:       'Done',
        empty:      'No requests in this column',
      },
    },
    chat: {
      allActiveChats: 'All active chats',
      activeTab:   'Active chats',
      pastTab:     'Past chats',
      activeEmpty: 'No active chats right now.',
      pastEmpty:   'No past chats.',
      pastBadge:   'Closed',
      openRequest: 'Open request',
    },
  },
} as const
