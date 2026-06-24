/**
 * Demo data reset + comprehensive seed (staging only).
 *
 * Wipes transactional collections, PRESERVES the 4 e2e.* test users + their
 * docs + the answers/businesses directory + the categories taxonomy, then seeds
 * a wide, demo-ready matrix: people (a few real logins + bulk Firestore docs),
 * requests covering every status x key field variant, chats/messages/ratings/
 * timeline events, and a populated approval queue (pending business + pending
 * directory entry + a volunteer pending approval).
 *
 * Design: docs/superpowers/specs/2026-06-15-demo-data-reset-and-seed-design.md
 *
 * SAFETY: takes a JSON backup first (exportFirestore), asserts the project id
 * contains "staging", and refuses to run without --confirm.
 *
 *   cd backend && npx tsx scripts/seedDemoData.ts --confirm
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin, db, auth } from '../src/lib/firebaseAdmin';
import { formatDisplayId } from '../src/lib/displayId';
import { exportFirestore } from './exportFirestore';
import { assertSafeToRun } from './lib/guard';

// ── Constants ──────────────────────────────────────────────────────────────
const E2E_EMAILS = {
  bene: 'e2e.bene@pff.test',
  admin: 'e2e.admin@pff.test',
  volunteer: 'e2e.volunteer@pff.test',
  owner: 'e2e.owner@pff.test',
} as const;

const DEMO_PASSWORD = 'Test1234!';

const CATEGORIES = [
  'employment', 'education', 'legal', 'housing', 'health',
  'social', 'welfare', 'absorption', 'community', 'youth',
] as const;

const STATUSES = ['pending', 'in_progress', 'awaiting_review', 'closed', 'rejected', 'referred'] as const;
const URGENCIES = ['low', 'medium', 'high'] as const;
const LANGS: Array<'he' | 'am' | 'en' | null> = ['he', 'am', 'en', null];
const GENDERS = ['male', 'female', 'other', ''] as const;
const ID_TYPES = ['israeli_id', 'passport', 'none'] as const;

const FIRST_HE = ['דוד', 'מרים', 'יוסף', 'רחל', 'אברהם', 'שרה', 'משה', 'תמר', 'דניאל', 'נועה', 'איתי', 'ליאת'];
const LAST_HE = ['כהן', 'לוי', 'דהן', 'ביטון', 'פרץ', 'מזרחי', 'אבבה', 'טדסה', 'גטה', 'אלמו', 'ימים', 'ברהנה'];
const CITIES = ['חיפה', 'תל אביב', 'ירושלים', 'באר שבע', 'נתניה', 'אשדוד', 'רחובות', 'פתח תקווה', 'קריית גת', 'לוד'];

const pick = <T,>(arr: readonly T[], i: number): T => arr[i % arr.length];
const daysFromNow = (n: number): Date => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const tsDaysAgo = (n: number): Timestamp => Timestamp.fromDate(daysFromNow(-n));

// ── Safety guard ─────────────────────────────────────────────────────────--
// Destructive (wipes collections), so the strict gate: --confirm + a staging
// project, no override. Shared with seed.ts/seedOrgs.ts via scripts/lib/guard.ts.

// ── Batched wipe ─────────────────────────────────────────────────────────--
async function wipeCollection(name: string, preserveIds: Set<string>): Promise<number> {
  const snap = await db().collection(name).get();
  let batch = db().batch();
  let ops = 0;
  let deleted = 0;
  for (const doc of snap.docs) {
    if (preserveIds.has(doc.id)) continue;
    batch.delete(doc.ref);
    ops += 1;
    deleted += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = db().batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  console.log(`  wiped ${name}: ${deleted} deleted, ${preserveIds.size ? `${preserveIds.size} preserved` : '0 preserved'}`);
  return deleted;
}

// ── Bulk writer (≤400/batch) ─────────────────────────────────────────────--
class BatchWriter {
  private batch = db().batch();
  private ops = 0;
  private total = 0;
  set(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>): void {
    this.batch.set(ref, data);
    this.ops += 1;
    this.total += 1;
    if (this.ops >= 400) {
      // commit synchronously-queued; caller awaits flush() at the end
      void this.flushInternal();
    }
  }
  private pending: Promise<void> = Promise.resolve();
  private flushInternal(): Promise<void> {
    const b = this.batch;
    this.batch = db().batch();
    this.ops = 0;
    this.pending = this.pending.then(() => b.commit().then(() => undefined));
    return this.pending;
  }
  async flush(): Promise<number> {
    if (this.ops > 0) await this.flushInternal();
    await this.pending;
    return this.total;
  }
}

// ── People ───────────────────────────────────────────────────────────────--
interface Person { uid: string; name: string; role: string; }

async function getOrCreateAuthUser(email: string, name: string, role: string): Promise<string> {
  let uid: string;
  try {
    uid = (await auth().getUserByEmail(email)).uid;
  } catch {
    uid = (await auth().createUser({ email, password: DEMO_PASSWORD, displayName: name, emailVerified: true })).uid;
  }
  await auth().setCustomUserClaims(uid, { role });
  return uid;
}

async function main(): Promise<void> {
  initializeFirebaseAdmin();
  assertSafeToRun({ action: 'seed demo data', destructive: true });

  // 1. Backup first.
  console.log('\n[1/7] Backing up current data…');
  const backupPath = await exportFirestore();
  console.log(`  backup written: ${backupPath}`);

  // 2. Resolve preserve set.
  console.log('\n[2/7] Resolving preserve set…');
  const e2e: Record<string, string> = {};
  for (const [k, email] of Object.entries(E2E_EMAILS)) {
    try { e2e[k] = (await auth().getUserByEmail(email)).uid; }
    catch { console.warn(`  WARN: ${email} not found in Auth — skipping preserve for it`); }
  }
  const preservedUserIds = new Set(Object.values(e2e));
  const preservedVolIds = new Set(e2e.volunteer ? [e2e.volunteer] : []);
  const answerIds = new Set((await db().collection('answers').get()).docs.map((d) => d.id));
  const businessApprovedIds = new Set(
    (await db().collection('businesses').get()).docs.filter((d) => d.data().status === 'approved').map((d) => d.id),
  );
  const categoryIds = new Set((await db().collection('categories').get()).docs.map((d) => d.id));
  console.log(`  preserve: ${preservedUserIds.size} users, ${preservedVolIds.size} volunteers, ${answerIds.size} answers, ${businessApprovedIds.size} approved businesses, ${categoryIds.size} categories`);

  // 3. Wipe.
  console.log('\n[3/7] Wiping transactional + non-preserved data…');
  for (const c of ['requests', 'chats', 'messages', 'ratings', 'requestEvents', 'volunteerApplications', 'auditLogs']) {
    await wipeCollection(c, new Set());
  }
  await wipeCollection('users', preservedUserIds);
  await wipeCollection('volunteers', preservedVolIds);
  await wipeCollection('businesses', businessApprovedIds); // drop any stray non-approved
  await db().collection('counters').doc('requests').set({ next: 1 });
  console.log('  counters/requests reset to { next: 1 }');

  const w = new BatchWriter();

  // 4. People.
  console.log('\n[4/7] Seeding people…');
  const benes: Person[] = [];
  const volunteers: Person[] = [];

  // Real loginable accounts (pw Test1234!).
  const realAccounts = [
    { email: 'demo.vol1@pff.test', name: 'יואב סגל', role: 'volunteer', workStatus: 'working', langs: ['he', 'am'], cats: ['employment', 'education'] },
    { email: 'demo.vol2@pff.test', name: 'נטע ברק', role: 'volunteer', workStatus: 'free', langs: ['he', 'en'], cats: ['housing', 'legal'] },
    { email: 'demo.bene1@pff.test', name: 'אסתר מנגיסטו', role: 'beneficiary' },
  ];
  for (const a of realAccounts) {
    const uid = await getOrCreateAuthUser(a.email, a.name, a.role);
    w.set(db().collection('users').doc(uid), {
      email: a.email, role: a.role, displayName: a.name, phone: '050-0000000',
      city: pick(CITIES, uid.length), age: 30, gender: '', createdAt: FieldValue.serverTimestamp(),
    });
    if (a.role === 'volunteer') {
      w.set(db().collection('volunteers').doc(uid), {
        uid, name: a.name, active: true, approvedAt: FieldValue.serverTimestamp(),
        workStatus: a.workStatus, languages: a.langs, categories: a.cats,
        availabilityWindows: [{ day: 0, start: '09:00', end: '13:00' }, { day: 3, start: '16:00', end: '20:00' }],
        availableAgainOn: null, requestedCategories: [],
      });
      volunteers.push({ uid, name: a.name, role: 'volunteer' });
    } else {
      benes.push({ uid, name: a.name, role: 'beneficiary' });
    }
    console.log(`  real login: ${a.email} (${a.role})`);
  }
  // The existing e2e accounts are usable too.
  if (e2e.volunteer) volunteers.push({ uid: e2e.volunteer, name: 'E2E Volunteer', role: 'volunteer' });
  if (e2e.bene) benes.push({ uid: e2e.bene, name: 'E2E Beneficiary', role: 'beneficiary' });

  // Firestore-only users (volume).
  for (let i = 0; i < 15; i += 1) {
    const uid = `seed-user-${String(i + 1).padStart(4, '0')}`;
    const name = `${pick(FIRST_HE, i)} ${pick(LAST_HE, i + 3)}`;
    const role = i % 5 === 0 ? 'businessOwner' : 'beneficiary';
    w.set(db().collection('users').doc(uid), {
      email: `${uid}@pff.test`, role, displayName: name,
      phone: `052-${String(1000000 + i)}`, city: pick(CITIES, i), age: 22 + (i * 3) % 45,
      gender: pick(GENDERS, i), createdAt: tsDaysAgo(i * 2),
    });
    if (role === 'beneficiary') benes.push({ uid, name, role });
  }

  // Firestore-only volunteers (matrix variety).
  const workStatuses = ['free', 'working', 'unavailable'] as const;
  for (let i = 0; i < 10; i += 1) {
    const uid = `seed-vol-${String(i + 1).padStart(4, '0')}`;
    const name = `${pick(FIRST_HE, i + 5)} ${pick(LAST_HE, i)}`;
    const ws = pick(workStatuses, i);
    const active = i !== 9; // one deactivated
    const windows = i % 3 === 0 ? [] : [{ day: (i + 1) % 7, start: '08:00', end: '12:00' }, { day: (i + 4) % 7, start: '17:00', end: '21:00' }];
    w.set(db().collection('users').doc(uid), {
      email: `${uid}@pff.test`, role: 'volunteer', displayName: name,
      phone: `053-${String(2000000 + i)}`, city: pick(CITIES, i + 2), age: 25 + (i * 4) % 35,
      gender: pick(GENDERS, i + 1), createdAt: tsDaysAgo(i * 3),
    });
    w.set(db().collection('volunteers').doc(uid), {
      uid, name, active, approvedAt: tsDaysAgo(i * 3),
      workStatus: ws, languages: pick([['he'], ['he', 'am'], ['he', 'en'], ['he', 'am', 'en']], i),
      categories: [pick(CATEGORIES, i), pick(CATEGORIES, i + 4)],
      availabilityWindows: windows,
      availableAgainOn: ws === 'unavailable' ? daysFromNow(10).toISOString().slice(0, 10) : null,
      requestedCategories: [],
      ...(active ? {} : { deactivatedAt: tsDaysAgo(1) }),
    });
    if (active) volunteers.push({ uid, name, role: 'volunteer' });
  }
  console.log(`  seeded ${benes.length} beneficiaries, ${volunteers.length} active volunteers (incl. e2e)`);

  // 5. Requests — smart matrix.
  console.log('\n[5/7] Seeding requests + events…');
  const adminUid = e2e.admin ?? volunteers[0]?.uid ?? 'seed-admin';
  let counter = 1;
  let reqIdx = 0;
  const seededRequests: Array<{ id: string; status: string; beneficiaryId: string; volunteer?: Person }> = [];

  type Overlay = Partial<{
    poolStatus: string; claims: unknown[]; onBehalf: boolean; attachmentPaths: string[];
    deadline: string | null; archived: boolean; assign: boolean; closeRequest: unknown; rate: number;
  }>;

  function buildRequest(status: string, urgency: string, overlay: Overlay = {}): void {
    const id = randomUUID();
    const displayId = formatDisplayId(counter);
    counter += 1;
    const i = reqIdx;
    reqIdx += 1;

    const bene = pick(benes, i);
    const assigned = overlay.assign || ['in_progress', 'awaiting_review', 'closed', 'referred'].includes(status);
    const vol = assigned ? pick(volunteers, i) : undefined;
    const createdDaysAgo = (i % 28) + (status === 'pending' && i % 7 === 0 ? 0 : 0); // some today
    const createdAt = i % 9 === 0 ? Timestamp.now() : tsDaysAgo(createdDaysAgo);

    w.set(db().collection('requests').doc(id), {
      displayId,
      beneficiaryId: bene.uid,
      onBehalf: overlay.onBehalf ?? false,
      firstName: pick(FIRST_HE, i),
      lastName: pick(LAST_HE, i + 1),
      idType: pick(ID_TYPES, i),
      idNumber: pick(ID_TYPES, i) === 'none' ? '' : String(300000000 + i),
      idNote: '',
      phone: `054-${String(3000000 + i)}`,
      email: `${bene.uid}@pff.test`,
      city: pick(CITIES, i),
      age: 20 + (i * 5) % 50,
      gender: pick(GENDERS, i),
      category: pick(CATEGORIES, i),
      description: `בקשת דמו ${displayId} בקטגוריית ${pick(CATEGORIES, i)} — תיאור לדוגמה עם מספיק תווים לולידציה.`,
      urgency,
      deadline: overlay.deadline ?? null,
      preferredLanguage: pick(LANGS, i),
      status,
      handler: assigned ? adminUid : null,
      assignedVolunteerId: assigned && vol ? vol.uid : null,
      assignedVolunteerName: assigned && vol ? vol.name : null,
      assignedAt: assigned ? tsDaysAgo(Math.max(0, createdDaysAgo - 1)) : null,
      notes: assigned ? 'הוקצה למתנדב בדמו.' : '',
      attachmentPaths: overlay.attachmentPaths ?? [],
      poolStatus: overlay.poolStatus ?? 'none',
      claims: overlay.claims ?? [],
      archived: overlay.archived ?? (status === 'referred'),
      ...(overlay.closeRequest ? { closeRequest: overlay.closeRequest } : { closeRequest: null }),
      createdAt,
      updatedAt: createdAt,
    });

    // Timeline events.
    w.set(db().collection('requestEvents').doc(), {
      requestId: id, type: 'created', actorId: bene.uid, visibility: 'all',
      details: { category: pick(CATEGORIES, i), urgency }, createdAt,
    });
    if (assigned && vol) {
      w.set(db().collection('requestEvents').doc(), {
        requestId: id, type: 'assigned', actorId: adminUid, visibility: 'all',
        details: { volunteerId: vol.uid }, createdAt: tsDaysAgo(Math.max(0, createdDaysAgo - 1)),
      });
    }
    if (status !== 'pending') {
      w.set(db().collection('requestEvents').doc(), {
        requestId: id, type: 'status_changed', actorId: adminUid, visibility: 'all',
        details: { to: status }, createdAt: tsDaysAgo(Math.max(0, createdDaysAgo - 2)),
      });
    }

    // Rating on some closed requests.
    if (overlay.rate && status === 'closed') {
      w.set(db().collection('ratings').doc(id), {
        requestId: id, stars: overlay.rate, comment: 'שירות מצוין, תודה רבה!',
        beneficiaryId: bene.uid, volunteerId: vol?.uid ?? null, createdAt,
      });
    }

    seededRequests.push({ id, status, beneficiaryId: bene.uid, volunteer: vol });
  }

  // Base: every status x urgency.
  for (const s of STATUSES) for (const u of URGENCIES) buildRequest(s, u);

  // Overlays.
  buildRequest('pending', 'high', { poolStatus: 'available', claims: [
    { volunteerId: volunteers[0]?.uid, note: 'אשמח לעזור בזה', claimedAt: daysFromNow(-1).toISOString() },
    { volunteerId: volunteers[1]?.uid, note: 'זמין השבוע', claimedAt: daysFromNow(-1).toISOString() },
  ] });
  buildRequest('pending', 'medium', { onBehalf: true });
  buildRequest('pending', 'low', { attachmentPaths: [`requests/demo/${randomUUID()}/document.pdf`] });
  buildRequest('pending', 'high', { deadline: daysFromNow(5).toISOString() });
  buildRequest('in_progress', 'high', { deadline: daysFromNow(2).toISOString() });
  buildRequest('in_progress', 'medium', { closeRequest: {
    proposedBy: adminUid, proposedRole: 'admin', proposedAt: daysFromNow(-1).toISOString(),
    volunteerApproved: true, beneficiaryApproved: false,
  } });
  buildRequest('closed', 'high', { rate: 5 });
  buildRequest('closed', 'medium', { rate: 4 });
  buildRequest('closed', 'low', { rate: 3, archived: true });
  buildRequest('referred', 'medium', { archived: true });

  // Volume pass — fill the high-traffic lists (pending pool, in-progress,
  // closed history) across all categories so admin/volunteer views look real.
  const volumeMix: Array<readonly [string, string]> = [
    ['pending', 'low'], ['pending', 'medium'], ['pending', 'high'],
    ['in_progress', 'medium'], ['in_progress', 'high'],
    ['closed', 'low'], ['closed', 'medium'],
  ];
  for (let i = 0; i < 18; i += 1) {
    const [s, u] = pick(volumeMix, i);
    buildRequest(s, u, s === 'closed' ? { rate: (i % 5) + 1 } : s === 'pending' && i % 4 === 0 ? { poolStatus: 'available' } : {});
  }

  console.log(`  seeded ${seededRequests.length} requests (counter next=${counter})`);
  await db().collection('counters').doc('requests').set({ next: counter });

  // 6. Chats + messages on some assigned/closed requests.
  console.log('\n[6/7] Seeding chats + messages…');
  let chatCount = 0;
  for (const r of seededRequests.filter((x) => x.volunteer && ['in_progress', 'awaiting_review', 'closed'].includes(x.status)).slice(0, 6)) {
    const chatId = randomUUID();
    w.set(db().collection('chats').doc(chatId), {
      participants: [r.beneficiaryId, adminUid, r.volunteer!.uid],
      requestId: r.id, kind: 'request', createdBy: adminUid, title: '',
      active: true, lastMessageAt: FieldValue.serverTimestamp(),
    });
    const lines = [
      { senderId: r.beneficiaryId, content: 'שלום, תודה על העזרה.' },
      { senderId: r.volunteer!.uid, content: 'בשמחה! אטפל בזה היום.' },
      { senderId: 'system', content: '[SYSTEM] המתנדב הוקצה לבקשה.', isSystem: true },
      { senderId: r.beneficiaryId, content: 'מצוין, מעריך מאוד.' },
    ];
    let t = 0;
    for (const l of lines) {
      w.set(db().collection('messages').doc(), {
        chatId, senderId: l.senderId, content: l.content, status: 'sent',
        ...(l.isSystem ? { isSystem: true } : {}),
        timestamp: Timestamp.fromDate(daysFromNow(-1 + t / 24)),
      });
      t += 1;
    }
    chatCount += 1;
  }
  // One admin-created direct chat.
  if (volunteers[0]) {
    const chatId = randomUUID();
    w.set(db().collection('chats').doc(chatId), {
      participants: [adminUid, volunteers[0].uid], requestId: null, kind: 'direct',
      createdBy: adminUid, title: 'תיאום מתנדבים', active: true, lastMessageAt: FieldValue.serverTimestamp(),
    });
    w.set(db().collection('messages').doc(), {
      chatId, senderId: adminUid, content: 'שלום, נוכל לתאם משמרת לשבוע הבא?', status: 'sent',
      timestamp: Timestamp.now(),
    });
    chatCount += 1;
  }
  console.log(`  seeded ${chatCount} chats`);

  // 7. Approval queue.
  console.log('\n[7/7] Seeding approval queue…');
  // Pending business (owned by e2e.owner if present).
  w.set(db().collection('businesses').doc(), {
    name: { he: 'מאפיית הקהילה', en: 'Community Bakery' },
    ownerName: 'טספאי ברהנה', phone: '050-1112222', category: 'food',
    city: { he: 'חיפה', en: 'Haifa' },
    description: { he: 'מאפייה קהילתית המעסיקה בני נוער מהקהילה האתיופית.', en: 'Community bakery employing Ethiopian-Israeli youth.' },
    website: null, tags: { he: [], en: [] },
    ownerId: e2e.owner ?? 'seed-user-0001', approved: false, status: 'pending',
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  // Pending directory entry.
  w.set(db().collection('answers').doc(), {
    title: { he: 'תוכנית מנטורינג חדשה', en: 'New Mentoring Program' },
    body: { he: 'תוכנית ליווי אישי לסטודנטים בני הקהילה — ממתינה לאישור.', en: 'Personal mentoring program for community students — pending approval.' },
    category: 'education', orgType: 'ngo',
    region: { he: 'מרכז', en: 'Center' }, audience: { he: 'נוער', en: 'Youth' },
    sourceName: 'דחיפה להגשמה | Push for Fulfillment', sourceUrl: 'https://www.pushforfulfillment.org.il',
    status: 'pending', approved: false, createdAt: FieldValue.serverTimestamp(),
  });
  // Volunteer pending approval: a volunteerApplications doc + a volunteer with a pending category request.
  w.set(db().collection('volunteerApplications').doc(), {
    uid: 'seed-applicant-0001', status: 'pending',
    firstName: 'מלכה', lastName: 'אדגה', email: 'seed-applicant-0001@pff.test',
    profession: 'עובדת סוציאלית', languages: ['he', 'am'], areasOfHelp: ['welfare', 'social'],
    availability: 'ימי שלישי וחמישי אחה״צ', createdAt: FieldValue.serverTimestamp(),
  });
  console.log('  seeded: 1 pending business, 1 pending directory entry, 1 volunteer application + 1 pending category request');

  const total = await w.flush();

  // Pending category request on an active volunteer — written AFTER the batch
  // flush so the batch's full set() of this volunteer doc doesn't clobber it.
  if (volunteers[0]) {
    await db().collection('volunteers').doc(volunteers[0].uid).set({
      requestedCategories: [{ category: 'legal', note: 'התנדבתי בעבר בתחום', requestedAt: new Date().toISOString(), status: 'pending' }],
    }, { merge: true });
  }

  // Summary.
  console.log('\n──────────── DONE ────────────');
  console.log(`Backup:            ${backupPath}`);
  console.log(`Total docs written: ${total}`);
  console.log(`Requests:          ${seededRequests.length} (statuses: ${STATUSES.join(', ')})`);
  console.log(`Chats:             ${chatCount}`);
  console.log('\nReal logins (password Test1234!):');
  console.log('  e2e.bene@pff.test / e2e.admin@pff.test / e2e.volunteer@pff.test / e2e.owner@pff.test');
  console.log('  demo.vol1@pff.test / demo.vol2@pff.test / demo.bene1@pff.test');
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('seedDemoData failed:', err);
  process.exit(1);
});
