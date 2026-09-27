/**
 * i18n add-on bundle for the workstream-A "public polish" surfaces (home,
 * directory, volunteer, donate). One of several `overhaul.*` shards that
 * translations.ts deep-merges into the shared `t.*` tree, so this file stays
 * scoped to its own workstream and avoids edit collisions in the big central
 * translations file.
 *
 * invariant: `he` and `en` are parallel key-for-key mirrors (every HE key has an
 * EN twin and vice versa) so the HE/EN language switch never yields a missing
 * string. `as const` keeps key/value literals narrow for type-safe `t.*` lookups.
 */
export const overhaulPublic = {
  he: {
    // /donate — bank-transfer details (values live in data/donation.ts).
    donate: {
      navLink: 'תרומה',
      homeCta: 'תרמו לעמותה',
      eyebrow: 'תרומה',
      title: 'תמכו בפעילות העמותה',
      lede: 'התרומות מאפשרות לנו להמשיך ללוות משפחות, סטודנטים ותלמידים בקהילה.',
      howTo: 'אפשר לתרום בהעברה בנקאית דרך אפליקציית הבנק שלכם, לפי הפרטים הבאים:',
      detailsTitle: 'פרטי החשבון',
      copy: 'העתקה',
      copied: 'הועתק',
      copyAria: (label: string) => `העתקת ${label}`,
      copiedAnnounce: (label: string) => `${label} הועתק ללוח`,
      copyFailed: 'לא ניתן להעתיק. אפשר לסמן ולהעתיק ידנית.',
      questions: 'יש שאלה לגבי התרומה? אפשר לפנות אלינו בטלפון או במייל שבתחתית העמוד.',
      fields: {
        accountName: 'שם החשבון',
        bank: 'בנק',
        branch: 'סניף',
        accountNumber: 'מספר חשבון',
      },
    },
  },
  en: {
    donate: {
      navLink: 'Donate',
      homeCta: 'Donate to the NGO',
      eyebrow: 'Donate',
      title: 'Support our work',
      lede: 'Donations let us keep supporting families, students and pupils in the community.',
      howTo: 'You can donate by bank transfer through your own banking app, using the details below:',
      detailsTitle: 'Account details',
      copy: 'Copy',
      copied: 'Copied',
      copyAria: (label: string) => `Copy ${label}`,
      copiedAnnounce: (label: string) => `${label} copied to clipboard`,
      copyFailed: 'Could not copy. You can select the text and copy it manually.',
      questions: 'Questions about donating? Reach us by phone or email at the bottom of the page.',
      fields: {
        accountName: 'Account name',
        bank: 'Bank',
        branch: 'Branch',
        accountNumber: 'Account number',
      },
    },
  },
} as const;
