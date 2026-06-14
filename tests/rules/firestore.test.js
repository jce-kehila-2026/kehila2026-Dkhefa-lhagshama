/**
 * Firestore Security Rules — unit tests (#89).
 *
 * Covers every collection declared in `firestore.rules`:
 *   requests, users, requestEvents, chats, messages,
 *   auditLogs, answers, businesses, categories,
 *   and the catch-all.
 *
 * The client SDK is read-mostly: all trusted writes go through the Express
 * backend (Admin SDK, which bypasses these rules). So most write assertions
 * here verify that the *client* path is denied.
 *
 * Run against the Firestore emulator:
 *   npm run test:rules          # from repo root (boots the emulator for you)
 *   firebase emulators:exec --only firestore "npm test"   # from tests/
 *
 * See tests/README.md for the emulator prerequisites.
 */

const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const { doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');

const PROJECT_ID = 'push-for-fulfillment-test';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

afterEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

// ── helpers ──────────────────────────────────────────────────────────────
const anon = () => testEnv.unauthenticatedContext().firestore();
const asUser = (uid, claims) =>
  testEnv.authenticatedContext(uid, claims).firestore();
const asAdmin = () => asUser('admin1', { role: 'admin' });
const asVolunteer = () => asUser('vol1', { role: 'volunteer' });

/** Seed docs with rules disabled (acts as the trusted backend). */
const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

// ── /requests — UC-01 ──────────────────────────────────────────────────────
describe('/requests', () => {
  beforeEach(() =>
    seed((db) =>
      setDoc(doc(db, 'requests/req1'), {
        beneficiaryId: 'alice',
        handler: 'handler1',
        assignedVolunteerId: 'vol1',
        status: 'new',
      }),
    ),
  );

  test('owner can read own request', async () => {
    await assertSucceeds(getDoc(doc(asUser('alice'), 'requests/req1')));
  });

  // F2-B (commit 7115a8c): direct client-SDK reads are owner-or-admin ONLY.
  // Staff (assigned handler / volunteer) must use GET /api/requests/:id, which
  // projects away the national-ID scan and internal notes the raw doc carries.
  test('assigned handler cannot read directly (server-mediated)', async () => {
    await assertFails(getDoc(doc(asUser('handler1'), 'requests/req1')));
  });

  test('assigned volunteer cannot read directly (server-mediated)', async () => {
    await assertFails(getDoc(doc(asUser('vol1'), 'requests/req1')));
  });

  test('admin can read any request', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'requests/req1')));
  });

  test('unrelated user cannot read', async () => {
    await assertFails(getDoc(doc(asUser('bob'), 'requests/req1')));
  });

  test('anonymous cannot read', async () => {
    await assertFails(getDoc(doc(anon(), 'requests/req1')));
  });

  test('client write is always denied', async () => {
    await assertFails(
      setDoc(doc(asUser('alice'), 'requests/req2'), { beneficiaryId: 'alice' }),
    );
  });

  test('client delete is always denied', async () => {
    await assertFails(deleteDoc(doc(asAdmin(), 'requests/req1')));
  });
});

// ── /users — profile (#63) ──────────────────────────────────────────────────
describe('/users', () => {
  beforeEach(() =>
    seed((db) =>
      setDoc(doc(db, 'users/alice'), { email: 'alice@example.com', role: 'beneficiary' }),
    ),
  );

  test('owner can read own profile', async () => {
    await assertSucceeds(getDoc(doc(asUser('alice'), 'users/alice')));
  });

  test('admin can read any profile', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'users/alice')));
  });

  test('other user cannot read profile', async () => {
    await assertFails(getDoc(doc(asUser('bob'), 'users/alice')));
  });

  test('self-write (role escalation) is denied', async () => {
    await assertFails(
      setDoc(doc(asUser('alice'), 'users/alice'), { role: 'admin' }),
    );
  });
});

// ── /requestEvents — timeline (#65) ────────────────────────────────────────
describe('/requestEvents', () => {
  beforeEach(() =>
    seed(async (db) => {
      // `handler` must be present: the rule dereferences
      // get(/requests/...).data.handler, and a missing field would error.
      await setDoc(doc(db, 'requests/req1'), {
        beneficiaryId: 'alice',
        handler: 'vol1',
      });
      await setDoc(doc(db, 'requestEvents/evPublic'), {
        requestId: 'req1',
        visibility: 'all',
      });
      await setDoc(doc(db, 'requestEvents/evInternal'), {
        requestId: 'req1',
        visibility: 'internal',
      });
    }),
  );

  // F3 (commit 7115a8c): the blanket volunteer grant is gone. Only admins and
  // the parent request's assigned handler see every event (incl. internal).
  test('handler volunteer reads any event (incl. internal)', async () => {
    await assertSucceeds(getDoc(doc(asVolunteer(), 'requestEvents/evInternal')));
    await assertSucceeds(getDoc(doc(asVolunteer(), 'requestEvents/evPublic')));
  });

  test('non-handler volunteer cannot read any event', async () => {
    const otherVol = asUser('vol2', { role: 'volunteer' });
    await assertFails(getDoc(doc(otherVol, 'requestEvents/evInternal')));
    await assertFails(getDoc(doc(otherVol, 'requestEvents/evPublic')));
  });

  test('admin reads any event', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'requestEvents/evInternal')));
  });

  test('owning beneficiary reads visibility=all event', async () => {
    await assertSucceeds(getDoc(doc(asUser('alice'), 'requestEvents/evPublic')));
  });

  test('owning beneficiary cannot read internal event', async () => {
    await assertFails(getDoc(doc(asUser('alice'), 'requestEvents/evInternal')));
  });

  test('unrelated user cannot read public event', async () => {
    await assertFails(getDoc(doc(asUser('bob'), 'requestEvents/evPublic')));
  });

  test('client write is denied', async () => {
    await assertFails(
      setDoc(doc(asVolunteer(), 'requestEvents/evNew'), { requestId: 'req1' }),
    );
  });
});

// ── /chats — UC-04 ──────────────────────────────────────────────────────────
describe('/chats', () => {
  beforeEach(() =>
    seed((db) =>
      setDoc(doc(db, 'chats/chat1'), { participants: ['alice', 'bob'] }),
    ),
  );

  test('participant can read chat', async () => {
    await assertSucceeds(getDoc(doc(asUser('alice'), 'chats/chat1')));
  });

  test('non-participant cannot read chat', async () => {
    await assertFails(getDoc(doc(asUser('carol'), 'chats/chat1')));
  });

  test('admin can read a chat they are not a participant of (oversight)', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'chats/chat1')));
  });

  test('volunteer non-participant still cannot read chat', async () => {
    await assertFails(getDoc(doc(asVolunteer(), 'chats/chat1')));
  });

  test('client write is denied', async () => {
    await assertFails(
      setDoc(doc(asUser('alice'), 'chats/chat2'), { participants: ['alice'] }),
    );
  });

  test('client write is denied even for admin', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'chats/chat1'), { participants: ['alice', 'bob', 'admin1'] }),
    );
  });
});

// ── /messages — UC-04 ───────────────────────────────────────────────────────
describe('/messages', () => {
  beforeEach(() =>
    seed(async (db) => {
      await setDoc(doc(db, 'chats/chat1'), { participants: ['alice', 'bob'] });
      await setDoc(doc(db, 'messages/msg1'), {
        chatId: 'chat1',
        text: 'hi',
        senderId: 'alice',
      });
    }),
  );

  test('participant can read message', async () => {
    await assertSucceeds(getDoc(doc(asUser('bob'), 'messages/msg1')));
  });

  test('non-participant cannot read message', async () => {
    await assertFails(getDoc(doc(asUser('carol'), 'messages/msg1')));
  });

  test('admin can read a message in a chat they are not in (oversight)', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'messages/msg1')));
  });

  test('volunteer non-participant still cannot read message', async () => {
    await assertFails(getDoc(doc(asVolunteer(), 'messages/msg1')));
  });

  test('client write is denied', async () => {
    await assertFails(
      setDoc(doc(asUser('alice'), 'messages/msg2'), { chatId: 'chat1' }),
    );
  });

  test('client write is denied even for admin', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'messages/msg3'), { chatId: 'chat1', text: 'hi' }),
    );
  });
});

// ── /auditLogs ──────────────────────────────────────────────────────────────
describe('/auditLogs', () => {
  beforeEach(() =>
    seed((db) => setDoc(doc(db, 'auditLogs/log1'), { action: 'approve' })),
  );

  test('admin can read audit logs', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'auditLogs/log1')));
  });

  test('non-admin cannot read audit logs', async () => {
    await assertFails(getDoc(doc(asUser('alice'), 'auditLogs/log1')));
  });

  test('client write is denied', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'auditLogs/log2'), { action: 'x' }),
    );
  });
});

// ── /answers — UC-02 ────────────────────────────────────────────────────────
describe('/answers', () => {
  beforeEach(() =>
    seed(async (db) => {
      await setDoc(doc(db, 'answers/approved1'), {
        status: 'approved',
        ownerId: 'owner1',
      });
      await setDoc(doc(db, 'answers/pending1'), {
        status: 'pending',
        ownerId: 'owner1',
      });
    }),
  );

  test('public reads approved answer', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'answers/approved1')));
  });

  test('public cannot read pending answer', async () => {
    await assertFails(getDoc(doc(anon(), 'answers/pending1')));
  });

  test('admin reads pending answer', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'answers/pending1')));
  });

  test('owner can edit own pending answer (content field, stays pending)', async () => {
    await assertSucceeds(
      setDoc(doc(asUser('owner1'), 'answers/pending1'), {
        status: 'pending',
        ownerId: 'owner1',
        // `title` is an allowlisted content field; `name` is not (answers use
        // the bilingual `title`, not `name`).
        title: 'Updated',
      }),
    );
  });

  test('owner cannot change a non-allowlisted field on own pending answer', async () => {
    await assertFails(
      setDoc(doc(asUser('owner1'), 'answers/pending1'), {
        status: 'pending',
        ownerId: 'owner1',
        featured: true,
      }),
    );
  });

  test('owner cannot self-approve own answer', async () => {
    await assertFails(
      setDoc(doc(asUser('owner1'), 'answers/pending1'), {
        status: 'approved',
        ownerId: 'owner1',
      }),
    );
  });

  test('non-owner cannot edit pending answer', async () => {
    await assertFails(
      setDoc(doc(asUser('intruder'), 'answers/pending1'), {
        status: 'pending',
        ownerId: 'intruder',
      }),
    );
  });

  test('client create is denied', async () => {
    await assertFails(
      setDoc(doc(asUser('owner1'), 'answers/new1'), {
        status: 'pending',
        ownerId: 'owner1',
      }),
    );
  });
});

// ── /businesses — UC-03 ─────────────────────────────────────────────────────
describe('/businesses', () => {
  beforeEach(() =>
    seed(async (db) => {
      await setDoc(doc(db, 'businesses/approved1'), {
        status: 'approved',
        ownerId: 'owner1',
      });
      await setDoc(doc(db, 'businesses/pending1'), {
        status: 'pending',
        ownerId: 'owner1',
        name: 'Original',
        rating: 0,
        reviews: 0,
        featured: false,
      });
    }),
  );

  test('public reads approved business', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'businesses/approved1')));
  });

  test('public cannot read pending business', async () => {
    await assertFails(getDoc(doc(anon(), 'businesses/pending1')));
  });

  test('admin reads pending business', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'businesses/pending1')));
  });

  test('owner can edit own pending business (content fields only)', async () => {
    await assertSucceeds(
      setDoc(doc(asUser('owner1'), 'businesses/pending1'), {
        status: 'pending',
        ownerId: 'owner1',
        name: 'Updated',
        // rating/reviews/featured carried through unchanged (no self-inflation).
        rating: 0,
        reviews: 0,
        featured: false,
      }),
    );
  });

  test('owner cannot self-approve own business', async () => {
    await assertFails(
      setDoc(doc(asUser('owner1'), 'businesses/pending1'), {
        status: 'approved',
        ownerId: 'owner1',
      }),
    );
  });

  test('owner cannot inflate rating/reviews/featured on own pending business', async () => {
    await assertFails(
      setDoc(doc(asUser('owner1'), 'businesses/pending1'), {
        status: 'pending',
        ownerId: 'owner1',
        name: 'Original',
        rating: 5,
        reviews: 999,
        featured: true,
      }),
    );
  });

  test('client create is denied', async () => {
    await assertFails(
      setDoc(doc(asUser('owner1'), 'businesses/new1'), {
        status: 'pending',
        ownerId: 'owner1',
      }),
    );
  });
});

// ── /organizations — removed (dead collection) ──────────────────────────────
// Partner organizations live in `answers` (split by orgType); the dedicated
// /organizations rules block was removed, so the collection now falls to the
// catch-all deny: no client read or write, even for admins.
describe('/organizations (removed, fully denied)', () => {
  beforeEach(() =>
    seed(async (db) => {
      await setDoc(doc(db, 'organizations/approved1'), { status: 'approved' });
    }),
  );

  test('anon read is denied (catch-all)', async () => {
    await assertFails(getDoc(doc(anon(), 'organizations/approved1')));
  });

  test('admin read is denied (catch-all)', async () => {
    await assertFails(getDoc(doc(asAdmin(), 'organizations/approved1')));
  });

  test('client write is denied', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'organizations/new1'), { status: 'pending' }),
    );
  });
});

// ── /categories — admin-managed request taxonomy ────────────────────────────
describe('/categories', () => {
  beforeEach(() =>
    seed((db) =>
      setDoc(doc(db, 'categories/education'), {
        nameHe: 'השכלה',
        nameEn: 'Education',
        archived: false,
      }),
    ),
  );

  test('public reads a category unauthenticated', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'categories/education')));
  });

  test('client write is denied even for admin', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'categories/newcat'), {
        nameHe: 'חדש',
        nameEn: 'New',
        archived: false,
      }),
    );
  });

  test('client delete is denied even for admin', async () => {
    await assertFails(deleteDoc(doc(asAdmin(), 'categories/education')));
  });
});

// ── /counters — server-only sequence counters (WS-3) ─────────────────────────
describe('/counters (server-only, fully denied to clients)', () => {
  beforeEach(() =>
    seed((db) => setDoc(doc(db, 'counters/requests'), { next: 7 })),
  );

  test('anon read is denied', async () => {
    await assertFails(getDoc(doc(anon(), 'counters/requests')));
  });

  test('admin read is denied (Admin SDK only)', async () => {
    await assertFails(getDoc(doc(asAdmin(), 'counters/requests')));
  });

  test('volunteer read is denied', async () => {
    await assertFails(getDoc(doc(asVolunteer(), 'counters/requests')));
  });

  test('client write is denied even for admin', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'counters/requests'), { next: 99 }));
  });

  test('volunteer client write is denied (WS-7)', async () => {
    await assertFails(setDoc(doc(asVolunteer(), 'counters/requests'), { next: 99 }));
  });

  // WS-7: the trusted backend (Admin SDK, rules disabled) is the only writer.
  test('the trusted backend (rules disabled) can read + advance the counter', async () => {
    await seed(async (dbx) => {
      await assertSucceeds(getDoc(doc(dbx, 'counters/requests')));
      await assertSucceeds(setDoc(doc(dbx, 'counters/requests'), { next: 2 }));
    });
  });
});

// ── /volunteers — availability fields are server-only (WS-7) ────────────────
describe('/volunteers availability (WS-7)', () => {
  test('a volunteer reads their own doc with availability fields', async () => {
    await seed((dbx) =>
      setDoc(doc(dbx, 'volunteers/vol1'), {
        active: true,
        workStatus: 'unavailable',
        availabilityWindows: [{ day: 1, start: '09:00', end: '17:00' }],
        availableAgainOn: '2026-07-01',
      }),
    );
    await assertSucceeds(getDoc(doc(asVolunteer(), 'volunteers/vol1')));
  });

  test('a volunteer cannot client-write availabilityWindows / availableAgainOn', async () => {
    await seed((dbx) => setDoc(doc(dbx, 'volunteers/vol1'), { active: true }));
    await assertFails(
      setDoc(doc(asVolunteer(), 'volunteers/vol1'), {
        availabilityWindows: [{ day: 2, start: '10:00', end: '12:00' }],
      }),
    );
    await assertFails(
      setDoc(doc(asVolunteer(), 'volunteers/vol1'), { availableAgainOn: '2026-08-01' }),
    );
  });

  test('a volunteer cannot read another volunteer doc', async () => {
    await seed((dbx) => setDoc(doc(dbx, 'volunteers/vol2'), { active: true }));
    await assertFails(getDoc(doc(asVolunteer(), 'volunteers/vol2')));
  });
});

// ── catch-all ───────────────────────────────────────────────────────────────
describe('catch-all deny', () => {
  test('undeclared collection is fully denied', async () => {
    await assertFails(getDoc(doc(asAdmin(), 'secretStuff/x')));
    await assertFails(
      setDoc(doc(asAdmin(), 'secretStuff/x'), { foo: 'bar' }),
    );
  });
});
