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
      // role-based fallback for the "X asked to close" copy (closeRequest.proposedRole)
      proposerVolunteer:   'המתנדב/ת',
      proposerBeneficiary: 'הפונה',
      // ── feedback round 2 — direct (staff/group) chats ──────────────
      directChatFallback: 'שיחת צוות',
      newChat:            'שיחה חדשה',
      newChatTitle:       'יצירת שיחה חדשה',
      newChatMembersLabel:'בחרו משתתפים',
      newChatSearchPH:    'חיפוש לפי שם או אימייל…',
      newChatTitleLabel:  'כותרת (אופציונלי)',
      newChatTitlePH:     'למשל: תיאום מתנדבים',
      newChatCreate:      'יצירת שיחה',
      newChatCreating:    'יוצר…',
      newChatNoUsers:     'לא נמצאו משתמשים.',
      newChatLoadError:   'טעינת המשתמשים נכשלה. נסו שוב.',
      newChatError:       'יצירת השיחה נכשלה. נסו שוב.',
      newChatMinOne:      'יש לבחור לפחות משתתף/ת אחד/ת.',
      // participants rail + management
      participantsTitle:  'משתתפי השיחה',
      youTag:             'אני',
      addPerson:          'הוספת משתתף/ת',
      addingPerson:       'מוסיף…',
      addPersonError:     'הוספת המשתתף/ת נכשלה. נסו שוב.',
      removePerson:       'הסרה מהשיחה',
      removeConfirmTitle: 'להסיר את המשתתף/ת מהשיחה?',
      removeConfirmBody:  (name: string) => `${name} לא יוכל/תוכל עוד לצפות בשיחה או לכתוב בה.`,
      removePersonError:  'הסרת המשתתף/ת נכשלה. נסו שוב.',
      protectedParticipant: 'לא ניתן להסיר את הפונה או את המתנדב/ת המשויכים לבקשה.',
      // admin oversight: viewing without membership + read-only states
      staffViewNote:      'מצב צפייה לצוות. כדי לכתוב בשיחה יש להצטרף אליה.',
      joinChat:           'הצטרפות לשיחה',
      joining:            'מצטרף/ת…',
      joinError:          'ההצטרפות לשיחה נכשלה. נסו שוב.',
      chatPausedNote:     'השיחה הושהתה על ידי הצוות וזמינה לקריאה בלבד.',
      chatEndedNote:      'הפנייה הסתיימה והשיחה זמינה לקריאה בלבד.',
      // server-posted system notes ('[SYSTEM] <marker>' content markers)
      system: {
        chatCreated:        'השיחה נוצרה',
        participantAdded:   (name: string) => `${name} צורף/ה לשיחה`,
        participantRemoved: (name: string) => `${name} הוסר/ה מהשיחה`,
        chatPaused:         'השיחה הושהתה על ידי הצוות',
        chatResumed:        'השיחה הופעלה מחדש',
        volunteerAssigned:  'מתנדב/ת שויך/ה לבקשה שלך',
      },
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
      // role-based fallback for the "X asked to close" copy (closeRequest.proposedRole)
      proposerVolunteer:   'The volunteer',
      proposerBeneficiary: 'The beneficiary',
      // ── feedback round 2 — direct (staff/group) chats ──────────────
      directChatFallback: 'Staff chat',
      newChat:            'New chat',
      newChatTitle:       'Start a new chat',
      newChatMembersLabel:'Choose participants',
      newChatSearchPH:    'Search by name or email…',
      newChatTitleLabel:  'Title (optional)',
      newChatTitlePH:     'e.g. Volunteer coordination',
      newChatCreate:      'Create chat',
      newChatCreating:    'Creating…',
      newChatNoUsers:     'No users found.',
      newChatLoadError:   'Could not load users. Please try again.',
      newChatError:       'Could not create the chat. Please try again.',
      newChatMinOne:      'Select at least one participant.',
      // participants rail + management
      participantsTitle:  'In this chat',
      youTag:             'you',
      addPerson:          'Add person',
      addingPerson:       'Adding…',
      addPersonError:     'Could not add the participant. Please try again.',
      removePerson:       'Remove from chat',
      removeConfirmTitle: 'Remove this participant?',
      removeConfirmBody:  (name: string) => `${name} will no longer be able to view or write in this chat.`,
      removePersonError:  'Could not remove the participant. Please try again.',
      protectedParticipant: "The request's beneficiary and assigned volunteer cannot be removed.",
      // admin oversight: viewing without membership + read-only states
      staffViewNote:      'Viewing as staff. Join the chat to write.',
      joinChat:           'Join chat',
      joining:            'Joining…',
      joinError:          'Could not join the chat. Please try again.',
      chatPausedNote:     'This chat was paused by the team and is read-only.',
      chatEndedNote:      'This request has ended; the chat is read-only.',
      // server-posted system notes ('[SYSTEM] <marker>' content markers)
      system: {
        chatCreated:        'Chat created',
        participantAdded:   (name: string) => `${name} was added to the chat`,
        participantRemoved: (name: string) => `${name} was removed from the chat`,
        chatPaused:         'The chat was paused by the team',
        chatResumed:        'The chat was resumed',
        volunteerAssigned:  'A volunteer has been assigned to your request',
      },
    },
  },
} as const
