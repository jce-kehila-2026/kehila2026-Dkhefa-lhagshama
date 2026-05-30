import 'dotenv/config';
import { Timestamp } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin, db } from '../src/lib/firebaseAdmin';

initializeFirebaseAdmin();
const firestore = db();

interface TaxonomyEntry {
  id: string;
  nameHe: string;
  nameEn: string;
}

// ─────────────────────────────────────────────────────────────
//  TAXONOMY — categories + regions (read by the seed and the UI)
// ─────────────────────────────────────────────────────────────
const CATEGORIES: TaxonomyEntry[] = [
  { id: 'employment',  nameHe: 'תעסוקה',           nameEn: 'Employment' },
  { id: 'education',   nameHe: 'השכלה',            nameEn: 'Education' },
  { id: 'legal',       nameHe: 'משפטי',            nameEn: 'Legal' },
  { id: 'housing',     nameHe: 'דיור',             nameEn: 'Housing' },
  { id: 'health',      nameHe: 'בריאות',           nameEn: 'Health' },
  { id: 'social',      nameHe: 'שירותים חברתיים',  nameEn: 'Social Services' },
  { id: 'welfare',     nameHe: 'רווחה',            nameEn: 'Welfare' },
  { id: 'absorption',  nameHe: 'קליטת עלייה',      nameEn: 'Immigration & Absorption' },
  { id: 'community',   nameHe: 'קהילה',            nameEn: 'Community' },
  { id: 'youth',       nameHe: 'נוער',             nameEn: 'Youth' },
];

const REGIONS: TaxonomyEntry[] = [
  { id: 'jerusalem',   nameHe: 'ירושלים',          nameEn: 'Jerusalem' },
  { id: 'north',       nameHe: 'צפון',             nameEn: 'North' },
  { id: 'haifa',       nameHe: 'חיפה',             nameEn: 'Haifa' },
  { id: 'tel-aviv',    nameHe: 'תל אביב',          nameEn: 'Tel Aviv' },
  { id: 'center',      nameHe: 'מרכז',             nameEn: 'Center' },
  { id: 'south',       nameHe: 'דרום',             nameEn: 'South' },
  { id: 'negev',       nameHe: 'נגב',              nameEn: 'Negev' },
  { id: 'galilee',     nameHe: 'גליל',             nameEn: 'Galilee' },
  { id: 'sharon',      nameHe: 'שרון',             nameEn: 'Sharon' },
  { id: 'shfela',      nameHe: 'שפלה',             nameEn: 'Lowlands' },
];

// ─────────────────────────────────────────────────────────────
//  ANSWERS — community "answers" directory (UC-02).
//
//  Shape mirrors what GET /api/answers returns (answers.ts) and what
//  DirectoryPage.jsx renders. The route filters on `status === 'approved'`
//  and `orderBy('createdAt','desc')`, with optional equality filters on
//  `category`, `region`, `audience`. So every doc MUST have:
//    status: 'approved', createdAt: <Timestamp>, title, body,
//    category, region, audience, sourceName, sourceUrl.
//
//  `category` values are the NGO_AREAS filter chips in DirectoryPage:
//    education | employment | legal | social | housing
//  (every one of those is covered below). `title`/`body`/`region`/`audience`
//  are single strings that the card renders verbatim, so they are written as
//  bilingual "HE | EN" strings — the same convention used in mockData.js.
// ─────────────────────────────────────────────────────────────
interface AnswerSeed {
  id: string;
  title: string;
  body: string;
  category: string;
  region: string;
  audience: string;
  sourceName: string;
  sourceUrl: string;
}

const ANSWERS: AnswerSeed[] = [
  {
    id: 'answer-rashi-scholarships',
    title: 'מלגות קרן ראשי לסטודנטים | Rashi Foundation Scholarships',
    body: 'מלגות לימוד לסטודנטים ממוצא אתיופי, הכשרות מקצועיות וליווי קריירה אישי. | Tuition scholarships for students of Ethiopian origin, professional training and personal career mentoring.',
    category: 'education',
    region: 'מרכז | Center',
    audience: 'סטודנטים | Students',
    sourceName: 'קרן ראשי | Rashi Foundation',
    sourceUrl: 'https://www.rashi.org.il',
  },
  {
    id: 'answer-fidel-hebrew',
    title: 'תכנית פידל ללימודי עברית | Fidel Hebrew Learning Program',
    body: 'שיעורי עברית, אוריינות והכנה לבחינות לבני הקהילה האתיופית בכל הגילים. | Hebrew classes, literacy and exam preparation for Ethiopian-Israeli community members of all ages.',
    category: 'education',
    region: 'ירושלים | Jerusalem',
    audience: 'עולים חדשים | New immigrants',
    sourceName: 'עמותת פידל | Fidel Association',
    sourceUrl: 'https://www.fidel.org.il',
  },
  {
    id: 'answer-tech-careers',
    title: 'מסלול הייטק לקהילה | Community Tech Careers Track',
    body: 'הכשרת תוכנה, השמה במשרות הייטק וליווי מעסיקים לבוגרי הקהילה. | Software bootcamps, placement in tech jobs and employer mentoring for community graduates.',
    category: 'employment',
    region: 'תל אביב | Tel Aviv',
    audience: 'מחפשי עבודה | Job seekers',
    sourceName: 'טק-קריירה | Tech-Career',
    sourceUrl: 'https://www.techcareer.org.il',
  },
  {
    id: 'answer-employment-center',
    title: 'מרכז הכוון תעסוקתי | Employment Guidance Center',
    body: 'ייעוץ קריירה, כתיבת קורות חיים, הכנה לראיונות והכשרות מקצועיות. | Career counseling, CV writing, interview preparation and vocational training.',
    category: 'employment',
    region: 'חיפה | Haifa',
    audience: 'מבוגרים | Adults',
    sourceName: 'משרד העבודה | Ministry of Labor',
    sourceUrl: 'https://www.gov.il/he/departments/employment',
  },
  {
    id: 'answer-legal-aid',
    title: 'סיוע משפטי חינם | Free Legal Aid Clinic',
    body: 'ייצוג משפטי ללא תשלום, הגנה על זכויות מהגרים וייעוץ בנושאי מעמד ועבודה. | Free legal representation, protection of immigrant rights and counseling on status and labor matters.',
    category: 'legal',
    region: 'מרכז | Center',
    audience: 'כלל הקהילה | General public',
    sourceName: 'איגוד לזכויות אדם | Human Rights Association',
    sourceUrl: 'https://www.humanrights.org.il',
  },
  {
    id: 'answer-rights-bureaucracy',
    title: 'מימוש זכויות מול הרשויות | Rights & Bureaucracy Support',
    body: 'מרכזי סיוע לאזרחים בקשיים מול הבירוקרטיה הממשלתית ומיצוי זכויות. | Support centers helping citizens navigate government bureaucracy and realize their rights.',
    category: 'legal',
    region: 'דרום | South',
    audience: 'משפחות | Families',
    sourceName: 'ידיד | Yedid',
    sourceUrl: 'https://www.yedid.org.il',
  },
  {
    id: 'answer-jdc-welfare',
    title: 'ג׳וינט ישראל — שירותים חברתיים | JDC Israel Social Services',
    body: 'סיוע לאוכלוסיות נזקקות: קשישים, ילדים, אנשים עם מוגבלויות ומשפחות במצוקה. | Aid for vulnerable populations: elderly, children, people with disabilities and families in distress.',
    category: 'social',
    region: 'צפון | North',
    audience: 'קשישים | Elderly',
    sourceName: 'ג׳וינט ישראל | JDC Israel',
    sourceUrl: 'https://www.jdc.org.il',
  },
  {
    id: 'answer-family-support',
    title: 'קבוצות תמיכה למשפחות | Family Support Groups',
    body: 'קבוצות תמיכה, ייעוץ הורי וליווי רגשי לנשים ולמשפחות בקהילה. | Support groups, parental guidance and emotional accompaniment for women and families in the community.',
    category: 'social',
    region: 'נגב | Negev',
    audience: 'נשים | Women',
    sourceName: 'דחיפה להגשמה | Push for Fulfillment',
    sourceUrl: 'https://www.pushforfulfillment.org.il',
  },
  {
    id: 'answer-housing-emergency',
    title: 'סיוע בדיור ועזרה ראשונה | Housing & Emergency Aid',
    body: 'סיוע בדיור, מזון חירום ושירותים לעולים חדשים ולמשפחות במשבר. | Housing assistance, emergency food and services for new immigrants and families in crisis.',
    category: 'housing',
    region: 'שרון | Sharon',
    audience: 'משפחות במשבר | Families in crisis',
    sourceName: 'עמותת בית | Beit Association',
    sourceUrl: 'https://www.beit.org.il',
  },
  {
    id: 'answer-public-housing',
    title: 'זכאות לדיור ציבורי | Public Housing Eligibility',
    body: 'ליווי בהגשת בקשות לדיור ציבורי, סבסוד שכר דירה ומימוש זכויות מול משרד השיכון. | Guidance on public housing applications, rent subsidies and exercising rights with the Housing Ministry.',
    category: 'housing',
    region: 'ירושלים | Jerusalem',
    audience: 'עולים חדשים | New immigrants',
    sourceName: 'משרד הבינוי והשיכון | Ministry of Housing',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_construction_and_housing',
  },
];

// ─────────────────────────────────────────────────────────────
//  BUSINESSES — community-owned businesses directory (UC-03).
//
//  Shape mirrors GET /api/businesses (businesses.ts) + DirectoryPage.jsx.
//  Route filters on `status === 'approved'` and orders by `createdAt desc`.
//  Each doc MUST carry: status:'approved', approved:true, createdAt:<Timestamp>,
//  name, ownerName, phone, category, city, description, featured, rating, reviews.
//
//  `category` spans every business filter chip in DirectoryPage:
//    food | services | health | education | beauty | tech
//  `name`/`description` are bilingual "HE | EN" (mockData.js convention).
// ─────────────────────────────────────────────────────────────
interface BusinessSeed {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  category: string;
  city: string;
  description: string;
  featured: boolean;
  rating: number;
  reviews: number;
}

const BUSINESSES: BusinessSeed[] = [
  {
    id: 'biz-star-of-addis',
    name: 'מסעדת כוכב אדיס | Star of Addis',
    ownerName: 'אלמז טספאי | Almaz Tesfaye',
    phone: '03-555-1234',
    category: 'food',
    city: 'תל אביב | Tel Aviv',
    description: 'מסעדה אתיופית מסורתית. אינג׳רה, תבשילים מסורתיים ואירוח חם ואותנטי. | Traditional Ethiopian restaurant. Injera, traditional stews and warm, authentic hospitality.',
    featured: true,
    rating: 4.8,
    reviews: 42,
  },
  {
    id: 'biz-jimma-cafe',
    name: 'בית קפה ג׳ימה | Jimma Café',
    ownerName: 'דניאל ברహנו | Daniel Berhanu',
    phone: '03-555-2468',
    category: 'food',
    city: 'תל אביב | Tel Aviv',
    description: 'קפה אתיופי מסורתי עם טקס קפה, עוגות ביתיות ואווירה נעימה. | Traditional Ethiopian coffee with a coffee ceremony, homemade cakes and a pleasant atmosphere.',
    featured: false,
    rating: 4.9,
    reviews: 87,
  },
  {
    id: 'biz-shlomo-barber',
    name: 'מספרת שלמה | Shlomo\'s Barber',
    ownerName: 'שלמה מקוריה | Shlomo Makuria',
    phone: '04-555-5678',
    category: 'services',
    city: 'חיפה | Haifa',
    description: 'מספרה מקצועית לכל סוגי השיער. ניסיון של 15 שנה בשיער מתולתל ואפרו. | Professional barbershop for all hair types. 15 years of experience with curly and afro hair.',
    featured: false,
    rating: 4.9,
    reviews: 78,
  },
  {
    id: 'biz-alamo-renovations',
    name: 'שיפוצניק אלעמו | Alamo Renovations',
    ownerName: 'אלעמו דסטה | Alamo Desta',
    phone: '08-555-1357',
    category: 'services',
    city: 'אשדוד | Ashdod',
    description: 'שיפוצים, אינסטלציה ועבודות בנייה. אמין, מקצועי ומחיר הוגן. | Renovations, plumbing and construction work. Reliable, professional and fair priced.',
    featured: false,
    rating: 4.8,
    reviews: 44,
  },
  {
    id: 'biz-dr-lama-clinic',
    name: 'מרפאת ד"ר לאמה | Dr. Lama Clinic',
    ownerName: 'ד"ר לאמה אבבה | Dr. Lama Abebe',
    phone: '02-555-9012',
    category: 'health',
    city: 'ירושלים | Jerusalem',
    description: 'רפואת משפחה ורפואה כללית. שפות: עברית, אמהרית ואנגלית. | Family medicine and general practice. Languages: Hebrew, Amharic and English.',
    featured: true,
    rating: 4.7,
    reviews: 55,
  },
  {
    id: 'biz-tena-physio',
    name: 'קליניקת פיזיותרפיה טנה | Tena Physiotherapy',
    ownerName: 'מולא גרמה | Mulu Germa',
    phone: '04-555-7788',
    category: 'health',
    city: 'חיפה | Haifa',
    description: 'פיזיותרפיה ושיקום, טיפול בכאבי גב וספורט. ליווי אישי בעברית ואמהרית. | Physiotherapy and rehabilitation, back-pain and sports treatment. Personal care in Hebrew and Amharic.',
    featured: false,
    rating: 4.6,
    reviews: 27,
  },
  {
    id: 'biz-ethiopian-art-academy',
    name: 'אקדמיה לאמנות אתיופית | Ethiopian Art Academy',
    ownerName: 'תגיסט וונדה | Tigist Wonde',
    phone: '03-555-3456',
    category: 'education',
    city: 'ראשון לציון | Rishon LeZion',
    description: 'שיעורי ציור, מוסיקה אתיופית, ריקוד ועיצוב לילדים ומבוגרים. | Drawing, Ethiopian music, dance and design classes for children and adults.',
    featured: false,
    rating: 4.6,
    reviews: 31,
  },
  {
    id: 'biz-bridge-tutoring',
    name: 'מרכז למידה גשר | Bridge Tutoring Center',
    ownerName: 'יוסף מנגיסטו | Yosef Mengistu',
    phone: '09-555-4422',
    category: 'education',
    city: 'נתניה | Netanya',
    description: 'שיעורים פרטיים, הכנה לבגרויות וחניכה לתלמידים מהקהילה. | Private lessons, matriculation-exam prep and mentoring for community students.',
    featured: false,
    rating: 4.7,
    reviews: 38,
  },
  {
    id: 'biz-wisa-beauty',
    name: 'סטודיו יופי ויסה | Wisa Beauty Studio',
    ownerName: 'ויסה אסרס | Wisa Asres',
    phone: '04-555-3691',
    category: 'beauty',
    city: 'חיפה | Haifa',
    description: 'טיפולי שיער ועור מותאמים לגווני עור כהים. ניסיון מקצועי בקוסמטיקה לעור אתיופי. | Hair and skin treatments tailored for darker skin tones. Professional experience with Ethiopian-skin cosmetics.',
    featured: false,
    rating: 4.7,
    reviews: 62,
  },
  {
    id: 'biz-addis-digital',
    name: 'אדיס דיגיטל | Addis Digital',
    ownerName: 'אמנואל גברהיות | Emanuel Gebrehiwot',
    phone: '03-555-9911',
    category: 'tech',
    city: 'תל אביב | Tel Aviv',
    description: 'בניית אתרים, אפליקציות ושיווק דיגיטלי לעסקים קטנים בקהילה. | Website and app development plus digital marketing for small community businesses.',
    featured: true,
    rating: 4.8,
    reviews: 21,
  },
];

async function seedTaxonomy(
  collectionName: string,
  entries: TaxonomyEntry[],
): Promise<void> {
  const batch = firestore.batch();
  for (const entry of entries) {
    const ref = firestore.collection(collectionName).doc(entry.id);
    batch.set(ref, { nameHe: entry.nameHe, nameEn: entry.nameEn }, { merge: true });
  }
  await batch.commit();
  console.log(`  ✓ ${collectionName}: ${entries.length} documents seeded`);
}

async function seedAnswers(): Promise<void> {
  const batch = firestore.batch();
  const base = Date.now();
  ANSWERS.forEach((answer, i) => {
    const { id, ...data } = answer;
    const ref = firestore.collection('answers').doc(id);
    // Stagger createdAt so the `orderBy('createdAt','desc')` query is stable and
    // deterministic across re-seeds (earlier array items appear first / newest).
    const createdAt = Timestamp.fromMillis(base - i * 60_000);
    batch.set(
      ref,
      { ...data, status: 'approved', createdAt, updatedAt: createdAt },
      { merge: true },
    );
  });
  await batch.commit();
  console.log(`  ✓ answers: ${ANSWERS.length} approved documents seeded`);
}

async function seedBusinesses(): Promise<void> {
  const batch = firestore.batch();
  const base = Date.now();
  BUSINESSES.forEach((biz, i) => {
    const { id, ...data } = biz;
    const ref = firestore.collection('businesses').doc(id);
    const createdAt = Timestamp.fromMillis(base - i * 60_000);
    batch.set(
      ref,
      {
        ...data,
        approved: true,
        status: 'approved',
        ownerId: `seed-owner-${id}`,
        createdAt,
        updatedAt: createdAt,
      },
      { merge: true },
    );
  });
  await batch.commit();
  console.log(`  ✓ businesses: ${BUSINESSES.length} approved documents seeded`);
}

async function main(): Promise<void> {
  console.log('Seeding Firestore taxonomy + directories...');
  await seedTaxonomy('categories', CATEGORIES);
  await seedTaxonomy('regions', REGIONS);
  await seedAnswers();
  await seedBusinesses();
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
