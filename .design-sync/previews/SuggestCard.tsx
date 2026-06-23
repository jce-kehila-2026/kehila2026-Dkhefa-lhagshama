import { SuggestCard } from 'push-for-fulfillment-frontend'
import type { Suggestion } from '@/types'

const wrap = { padding: 16, maxWidth: 640 } as const

const heItems: Suggestion[] = [
  {
    id: 'sug-1',
    title: { he: 'בנק המזון לישראל — לקט', en: 'Leket Israel Food Bank' },
    sourceName: { he: 'לקט ישראל', en: 'Leket Israel' },
    sourceUrl: 'https://www.leket.org',
    phone: '09-744-1212',
    category: 'food',
    orgType: 'ngo',
  },
  {
    id: 'sug-2',
    title: { he: 'סיוע משפטי לדיור — קו לעובד', en: 'Housing legal aid clinic' },
    sourceName: { he: 'קו לעובד', en: 'Kav LaOved' },
    email: 'info@kavlaoved.org.il',
    category: 'legal',
    orgType: 'partner',
  },
  {
    id: 'sug-3',
    title: { he: 'מרכז חלוקת רהיטים בחיפה', en: 'Haifa furniture distribution' },
    sourceName: { he: 'יד שרה — סניף חיפה', en: 'Yad Sarah, Haifa' },
    category: 'furniture',
    orgType: 'ngo',
  },
]

const enItems: Suggestion[] = [
  {
    id: 'sug-en-1',
    title: 'Free after-school tutoring',
    sourceName: 'Pelech Community Center',
    sourceUrl: 'https://www.example.org/tutoring',
    phone: '03-555-0182',
    category: 'tutoring',
    orgType: 'ngo',
  },
  {
    id: 'sug-en-2',
    title: 'Winter clothing drive',
    sourceName: 'Latet — Israeli Humanitarian Aid',
    email: 'volunteer@latet.org.il',
    category: 'clothing',
    orgType: 'partner',
  },
]

export function Hebrew() {
  return (
    <div style={wrap}>
      <SuggestCard
        items={heItems}
        lang="he"
        heading="הצעות מהקהילה"
        subtitle="ארגונים מאושרים שעשויים לעזור בבקשה שלכם בזמן שאנחנו מחפשים מתנדב מתאים."
        openLabel="לאתר"
        callLabel="חיוג"
        emailLabel="מייל"
        directoryLabel="במדריך"
        dismissLabel="סגירה"
        onDismiss={() => {}}
      />
    </div>
  )
}

export function English() {
  return (
    <div style={wrap}>
      <SuggestCard
        items={enItems}
        lang="en"
        heading="Community suggestions"
        subtitle="Approved organizations that may be able to help while we find a volunteer for you."
        openLabel="Open"
        callLabel="Call"
        emailLabel="Email"
        directoryLabel="In directory"
        dismissLabel="Dismiss"
        onDismiss={() => {}}
      />
    </div>
  )
}
