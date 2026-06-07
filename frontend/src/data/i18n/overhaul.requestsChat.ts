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
      // req 26 — file attachments on chat messages
      attachFile:   'צירוף קובץ',
      uploading:    'מעלה…',
      download:     'הורדה',
      openFile:     'פתח/י קובץ',
      fileTooLarge: 'הקובץ גדול מדי (עד 10MB).',
      badFileType:  'סוג קובץ לא נתמך. ניתן לצרף PDF, ‏JPEG, ‏PNG או DOCX.',
      uploadFailed: 'העלאת הקובץ נכשלה. נסו שוב.',
      downloadFailed: 'הורדת הקובץ נכשלה. נסו שוב.',
      // req 25 — mutual-consent close handshake
      requestClose:       'בקשה לסגירה',
      otherAskedToClose:  (name: string) => `${name} ביקש/ה לסגור את הפנייה`,
      confirmClose:       'אישור סגירה',
      declineClose:       'דחייה',
      cancelCloseRequest: 'ביטול בקשת הסגירה',
      waitingToClose:     'ממתינים לאישור הצד השני לסגירה',
      closeRequestError:  'הפעולה נכשלה. נסו שוב.',
      closed:             'הפנייה נסגרה',
      // generic fallback name used when the other party's name is unknown
      otherPartyFallback: 'הצד השני',
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
      // req 26 — file attachments on chat messages
      attachFile:   'Attach file',
      uploading:    'Uploading…',
      download:     'Download',
      openFile:     'Open file',
      fileTooLarge: 'File is too large (10MB max).',
      badFileType:  'Unsupported file type. Attach a PDF, JPEG, PNG, or DOCX.',
      uploadFailed: 'File upload failed. Please try again.',
      downloadFailed: 'Could not download the file. Please try again.',
      // req 25 — mutual-consent close handshake
      requestClose:       'Request to close',
      otherAskedToClose:  (name: string) => `${name} asked to close this request`,
      confirmClose:       'Confirm close',
      declineClose:       'Decline',
      cancelCloseRequest: 'Cancel close request',
      waitingToClose:     'Waiting for the other party to confirm',
      closeRequestError:  'That action failed. Please try again.',
      closed:             'Request closed',
      otherPartyFallback: 'The other party',
    },
  },
} as const
