import 'dotenv/config';
import { initializeFirebaseAdmin, db } from '../src/lib/firebaseAdmin';

initializeFirebaseAdmin();
const firestore = db();

interface TaxonomyEntry {
  id: string;
  nameHe: string;
  nameEn: string;
}

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

async function seedCollection(
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

async function main(): Promise<void> {
  console.log('Seeding Firestore taxonomy...');
  await seedCollection('categories', CATEGORIES);
  await seedCollection('regions', REGIONS);
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
