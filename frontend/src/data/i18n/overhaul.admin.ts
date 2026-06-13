/**
 * Workstream C (admin operational dashboard) translation add-ons.
 * Add keys under `he` and `en` mirrors. Merged into `t.*` by `translations.ts`.
 *
 * Everything here extends the existing `admin` namespace so access stays
 * `t.admin.x` after the deep-merge. Add BOTH he + en for every key.
 */
export const overhaulAdmin = {
  he: {
    admin: {
      // ── Operational dashboard (req 8) ─────────────────────────
      dashOps: {
        kpiEyebrow:      'מצב נוכחי',
        kpiTitle:        'מבט מהיר',
        attentionEyebrow:'דורש פעולה',
        attentionTitle:  'מה דורש תשומת לב',
        attentionEmpty:  'הכול מטופל — אין פריטים פתוחים כרגע.',
        insightsEyebrow: 'מגמות',
        insightsTitle:   'תובנות בקצרה',
        viewInsights:    'לכל התובנות',
        open:            'פתח',
        review:          'בדוק',
        kAwaitingReview: 'ממתין לבדיקה',
        items: {
          unassigned:      'בקשות ממתינות לשיוך',
          awaitingReview:  'בקשות ממתינות לבדיקה',
          pendingVol:      'בקשות הצטרפות מתנדבים',
          withClaims:      'בקשות עם מתנדבים מתעניינים',
          pendingCategory: 'בקשות הרשאת תחום',
        },
      },

      // ── Admin task requests (req 20 + 21) ─────────────────────
      taskForm: {
        create:        'יצירת משימה',
        dialogTitle:   'יצירת בקשת משימה',
        titleLabel:    'כותרת',
        titlePH:       'כותרת קצרה למשימה',
        descLabel:     'תיאור',
        descPH:        'מה צריך להיעשות?',
        categoryLabel: 'קטגוריה',
        categoryPH:    'בחר/י קטגוריה…',
        urgencyLabel:  'דחיפות',
        deadlineLabel: 'מועד אחרון',
        filesLabel:    'קבצים מצורפים (אופציונלי)',
        addFiles:      'הוספת קבצים',
        visibleToVol:  'גלוי למתנדבים',
        removeFile:    'הסרה',
        submit:        'יצירת משימה',
        submitting:    'יוצר…',
        cancel:        'ביטול',
        successToast:  'המשימה נוצרה בהצלחה',
        errorTitle:    'יצירת המשימה נכשלה',
        uploadError:   'המשימה נוצרה אך העלאת חלק מהקבצים נכשלה.',
        validation:    'יש למלא כותרת, תיאור וקטגוריה.',
        badge:         'משימת מנהל',
      },
      urgencyLabels: {
        low:    'רגיל',
        medium: 'בינוני',
        high:   'דחוף',
      },

      // ── Multi-claimant review (req 22) ────────────────────────
      claims: {
        heading:    'מתנדבים שביקשו את הבקשה',
        note:       'הערה',
        noNote:     'ללא הערה',
        claimedAt:  'תאריך בקשה',
        assign:     'שיוך',
        assigning:  'משייך…',
        badge:      'מתנדבים מתעניינים',
        assignSuccess: 'הבקשה שויכה למתנדב',
        assignError:   'השיוך נכשל. נסה/י שוב.',
      },

      // ── Protected admin rows (req 23) ─────────────────────────
      protectedRow: {
        label:   'מוגן',
        tooltip: 'לא ניתן לשנות או להשבית חשבון מנהל.',
      },

      // ── Category permission requests (req 15) ─────────────────
      catReq: {
        heading:  'בקשות הרשאת תחום',
        subtitle: 'מתנדבים שביקשו לקבל הרשאה לטפל בבקשות מתחום מסוים.',
      },

      // ── Age insights (req 24) ─────────────────────────────────
      ageInsights: {
        heading:      'גיל הנעזרים',
        avgLabel:     'גיל ממוצע',
        avgUnit:      'שנים',
        noAge:        'אין נתוני גיל',
        distribution: 'התפלגות גילאים',
        peopleUnit:   'נעזרים',
      },

      // ── Chat oversight (feedback round 2) ─────────────────────
      nav: {
        chats: 'צ׳אטים',
      },
      chats: {
        title:    'צ׳אטים',
        subtitle: 'כל השיחות במערכת: שיחות בקשה ושיחות צוות',
        colKind:         'סוג',
        colTitle:        'שיחה',
        colParticipants: 'משתתפים',
        colLastMessage:  'הודעה אחרונה',
        colStatus:       'סטטוס',
        kindDirect:  'צוות',
        kindRequest: 'בקשה',
        statusActive: 'פעילה',
        statusPaused: 'מושהית',
        untitled:     'שיחה ללא כותרת',
        open:   'פתיחה',
        pause:  'השהיה',
        resume: 'הפעלה מחדש',
        pauseConfirmTitle:  'להשהות את השיחה?',
        pauseConfirmBody:   'משתתפי השיחה לא יוכלו לשלוח הודעות עד שתופעל מחדש.',
        resumeConfirmTitle: 'להפעיל מחדש את השיחה?',
        resumeConfirmBody:  'משתתפי השיחה יוכלו לשלוח הודעות שוב.',
        toggleError: 'עדכון השיחה נכשל. נסו שוב.',
        resumeTerminalError: 'השיחה משויכת לבקשה שהסתיימה ולא ניתן להפעילה מחדש.',
        empty:     'אין שיחות להצגה',
        emptyHint: 'שיחות חדשות יופיעו כאן',
      },
    },
  },
  en: {
    admin: {
      dashOps: {
        kpiEyebrow:      'Current state',
        kpiTitle:        'At a glance',
        attentionEyebrow:'Action needed',
        attentionTitle:  'What needs attention',
        attentionEmpty:  'All clear — nothing open right now.',
        insightsEyebrow: 'Trends',
        insightsTitle:   'Insights at a glance',
        viewInsights:    'View all insights',
        open:            'Open',
        review:          'Review',
        kAwaitingReview: 'Awaiting review',
        items: {
          unassigned:      'Requests awaiting assignment',
          awaitingReview:  'Requests awaiting review',
          pendingVol:      'Volunteer applications',
          withClaims:      'Requests with interested volunteers',
          pendingCategory: 'Category permission requests',
        },
      },
      taskForm: {
        create:        'Create task request',
        dialogTitle:   'Create a task request',
        titleLabel:    'Title',
        titlePH:       'A short title for the task',
        descLabel:     'Description',
        descPH:        'What needs to be done?',
        categoryLabel: 'Category',
        categoryPH:    'Choose a category…',
        urgencyLabel:  'Urgency',
        deadlineLabel: 'Deadline',
        filesLabel:    'Attachments (optional)',
        addFiles:      'Add files',
        visibleToVol:  'Visible to volunteers',
        removeFile:    'Remove',
        submit:        'Create task',
        submitting:    'Creating…',
        cancel:        'Cancel',
        successToast:  'Task created successfully',
        errorTitle:    'Could not create the task',
        uploadError:   'Task created, but some files failed to upload.',
        validation:    'Title, description and category are required.',
        badge:         'From admin · Task',
      },
      urgencyLabels: {
        low:    'Normal',
        medium: 'Medium',
        high:   'Urgent',
      },
      claims: {
        heading:    'Volunteers requesting this',
        note:       'Note',
        noNote:     'No note',
        claimedAt:  'Requested at',
        assign:     'Assign',
        assigning:  'Assigning…',
        badge:      'Interested volunteers',
        assignSuccess: 'Request assigned to volunteer',
        assignError:   'Assignment failed. Please try again.',
      },
      protectedRow: {
        label:   'Protected',
        tooltip: 'Admin accounts cannot be modified or disabled.',
      },

      catReq: {
        heading:  'Category permission requests',
        subtitle: 'Volunteers asking to be approved for requests in a specific field.',
      },
      ageInsights: {
        heading:      'Beneficiary age',
        avgLabel:     'Average age',
        avgUnit:      'years',
        noAge:        'No age data',
        distribution: 'Age distribution',
        peopleUnit:   'Beneficiaries',
      },

      // ── Chat oversight (feedback round 2) ─────────────────────
      nav: {
        chats: 'Chats',
      },
      chats: {
        title:    'Chats',
        subtitle: 'Every conversation on the platform: request chats and staff chats',
        colKind:         'Type',
        colTitle:        'Conversation',
        colParticipants: 'Participants',
        colLastMessage:  'Last message',
        colStatus:       'Status',
        kindDirect:  'Staff',
        kindRequest: 'Request',
        statusActive: 'Active',
        statusPaused: 'Paused',
        untitled:     'Untitled chat',
        open:   'Open',
        pause:  'Pause',
        resume: 'Resume',
        pauseConfirmTitle:  'Pause this chat?',
        pauseConfirmBody:   'Participants will not be able to send messages until it is resumed.',
        resumeConfirmTitle: 'Resume this chat?',
        resumeConfirmBody:  'Participants will be able to send messages again.',
        toggleError: 'Could not update the chat. Please try again.',
        resumeTerminalError: 'This chat belongs to a request that has ended and cannot be resumed.',
        empty:     'No chats to show',
        emptyHint: 'New chats will appear here',
      },
    },
  },
} as const;
