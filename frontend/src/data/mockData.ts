// ─────────────────────────────────────────────────────────────
//  MOCK DATA  –  Volunteer roster, success stories, headline stats
// ─────────────────────────────────────────────────────────────
//  Static HE/EN fixtures for the few surfaces that have no live API backing.
//  Every list-screen (requests, directory, users, insights) reads from the
//  Express API; what remains here is read-only demo content:
//    - mockVolunteers → AppContext.volunteers (public VolunteerPage roster)
//    - mockStories    → HomePage success-story gallery
//    - mockStats      → HomePage + LoginPage headline stat strip
//  All three are imported (not mutated) by their consumers, so treat as const.

import type { Volunteer, Story } from '@/types'

/** Headline KPI counters shown on the homepage / login stat strip. */
export interface MockStats {
  beneficiaries: number
  volunteers: number
  satisfaction: number
  yearsActive: number
}

// public volunteer roster shown on VolunteerPage (via AppContext). each entry
// carries parallel HE/EN fields; `areas` maps to the category filter chips and
// `status`/`assignedTo` drive the available-vs-assigned badge.
export const mockVolunteers: Volunteer[] = [
  {
    id: 1,
    name: 'יהודית לוי',
    nameEn: 'Judith Levi',
    initials: 'יל',
    profession: 'עורכת דין, זכויות אדם',
    professionEn: 'Lawyer, Human Rights',
    areas: ['legal', 'social'],
    availability: '4-8 שעות/שבוע',
    availabilityEn: '4-8 hrs/week',
    city: 'תל אביב',
    cityEn: 'Tel Aviv',
    status: 'available',
    joinedDate: '2023-03',
    assignedTo: null,
  },
  {
    id: 2,
    name: 'אמנואל גברהיות',
    nameEn: 'Emanuel Gebrehiwot',
    initials: 'אג',
    profession: 'מהנדס תוכנה, חינוך טכנולוגי',
    professionEn: 'Software Engineer, Tech Education',
    areas: ['education', 'employment'],
    availability: '2-4 שעות/שבוע',
    availabilityEn: '2-4 hrs/week',
    city: 'חיפה',
    cityEn: 'Haifa',
    status: 'assigned',
    joinedDate: '2023-06',
    assignedTo: 'PFF-2024-0245',
  },
  {
    id: 3,
    name: 'שירה מזרחי',
    nameEn: 'Shira Mizrahi',
    initials: 'שמ',
    profession: 'פסיכולוגית קלינית, ייעוץ אישי',
    professionEn: 'Clinical Psychologist, Personal Counseling',
    areas: ['social'],
    availability: '8+ שעות/שבוע',
    availabilityEn: '8+ hrs/week',
    city: 'ירושלים',
    cityEn: 'Jerusalem',
    status: 'available',
    joinedDate: '2022-11',
    assignedTo: null,
  },
  {
    id: 4,
    name: 'ברוך טלהון',
    nameEn: 'Baruch Telhon',
    initials: 'בט',
    profession: 'מנהל עסקים, יזמות',
    professionEn: 'Business Manager, Entrepreneurship',
    areas: ['employment'],
    availability: '4-8 שעות/שבוע',
    availabilityEn: '4-8 hrs/week',
    city: 'נתניה',
    cityEn: 'Netanya',
    status: 'available',
    joinedDate: '2024-01',
    assignedTo: null,
  },
  {
    id: 5,
    name: 'ד"ר מיכל כהן',
    nameEn: 'Dr. Michal Cohen',
    initials: 'מכ',
    profession: 'רופאה, בריאות הציבור',
    professionEn: 'Physician, Public Health',
    areas: ['social', 'education'],
    availability: '2-4 שעות/שבוע',
    availabilityEn: '2-4 hrs/week',
    city: 'באר שבע',
    cityEn: 'Beer Sheva',
    status: 'available',
    joinedDate: '2023-09',
    assignedTo: null,
  },
  {
    id: 6,
    name: 'יוסף מנגיסטו',
    nameEn: 'Yosef Mengistu',
    initials: 'ימ',
    profession: 'מורה, חינוך מיוחד',
    professionEn: 'Teacher, Special Education',
    areas: ['education', 'social'],
    availability: '4-8 שעות/שבוע',
    availabilityEn: '4-8 hrs/week',
    city: 'אשדוד',
    cityEn: 'Ashdod',
    status: 'available',
    joinedDate: '2023-05',
    assignedTo: null,
  },
]

// The one real success story handed over by the NPO: its sponsorship of 7
// students at a school in Ethiopia (unnamed at the NGO's request). The quote is
// sourced from the school's letter of appreciation. The gallery still supports N stories,
// so further real stories can be appended here later.
export const mockStories: Story[] = [
  {
    id: 1,
    name: 'בית ספר באתיופיה',
    nameEn: 'A school in Ethiopia',
    role: 'חסות ל-7 תלמידים נזקקים, אתיופיה',
    roleEn: 'Sponsoring 7 students in need, Ethiopia',
    quote: 'התלמידים מאושרים ולומדים בבית הספר בזכות התמיכה של דחיפה להגשמה.',
    quoteEn: 'The students are happy and learning at school thanks to Push for Fulfillment\'s support.',
    rating: 5,
    image: 'story1',
  },
]

export const mockStats: MockStats = {
  beneficiaries: 500,
  volunteers: 83,
  satisfaction: 97,
  yearsActive: 2,
}
