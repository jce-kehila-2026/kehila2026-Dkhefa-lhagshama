/**
 * Firebase Storage Security Rules — unit tests (#89).
 *
 * Covers `storage.rules`:
 *   - /requests/{requestId}/{filename}  (UC-01 attachments)
 *   - catch-all deny
 *
 * Read access requires either ownership of the matching Firestore request doc
 * or the admin custom claim, so these tests seed a request doc in the Firestore
 * emulator first. Write access is allowed for any signed-in user under the 10MB
 * size cap (the doc may not exist yet at upload time).
 *
 * Run against the Storage + Firestore emulators:
 *   npm run test:rules        # from repo root (boots emulators for you)
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

const { doc, setDoc } = require('firebase/firestore');
const {
  ref,
  uploadBytes,
  getBytes,
} = require('firebase/storage');

const PROJECT_ID = 'push-for-fulfillment-test';
const FS_RULES = path.resolve(__dirname, '../../firestore.rules');
const STORAGE_RULES = path.resolve(__dirname, '../../storage.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(FS_RULES, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: fs.readFileSync(STORAGE_RULES, 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

afterEach(async () => {
  if (testEnv) {
    await testEnv.clearStorage();
    await testEnv.clearFirestore();
  }
});

const asUser = (uid, claims) => testEnv.authenticatedContext(uid, claims);
const anon = () => testEnv.unauthenticatedContext();

const smallFile = new Uint8Array([1, 2, 3, 4]);
const META = { contentType: 'application/pdf' };

/** Seed the matching Firestore request doc (acts as the trusted backend). */
const seedRequest = (beneficiaryId) =>
  testEnv.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'requests/req1'), { beneficiaryId }),
  );

describe('/requests/{requestId}/{filename} — uploads', () => {
  test('signed-in user can upload a small file', async () => {
    const storage = asUser('alice').storage();
    await assertSucceeds(
      uploadBytes(ref(storage, 'requests/req1/doc.pdf'), smallFile, META),
    );
  });

  test('anonymous user cannot upload', async () => {
    const storage = anon().storage();
    await assertFails(
      uploadBytes(ref(storage, 'requests/req1/doc.pdf'), smallFile, META),
    );
  });

  test('upload over 10MB is rejected', async () => {
    const storage = asUser('alice').storage();
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    await assertFails(
      uploadBytes(ref(storage, 'requests/req1/big.pdf'), big, META),
    );
  });
});

describe('/requests/{requestId}/{filename} — reads', () => {
  // Read rules call firestore.get(.../requests/{id}).data.beneficiaryId, so the
  // matching Firestore doc must exist *and* carry a beneficiaryId field — a bare
  // firestore.get on a missing doc / missing field throws a "Null value error"
  // in the rules runtime. Seed the doc + upload the object once per test.
  beforeEach(async () => {
    await seedRequest('alice');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), 'requests/req1/doc.pdf'),
        smallFile,
        META,
      );
    });
  });

  test('owner of the request doc can read the file', async () => {
    const storage = asUser('alice').storage();
    await assertSucceeds(getBytes(ref(storage, 'requests/req1/doc.pdf')));
  });

  test('non-owner cannot read the file', async () => {
    const storage = asUser('bob').storage();
    await assertFails(getBytes(ref(storage, 'requests/req1/doc.pdf')));
  });

  test('admin can read the file', async () => {
    const storage = asUser('admin1', { role: 'admin' }).storage();
    await assertSucceeds(getBytes(ref(storage, 'requests/req1/doc.pdf')));
  });
});

describe('catch-all deny', () => {
  test('upload outside /requests is denied', async () => {
    const storage = asUser('alice').storage();
    await assertFails(
      uploadBytes(ref(storage, 'random/path.pdf'), smallFile, META),
    );
  });

  test('read outside /requests is denied', async () => {
    const storage = asUser('alice').storage();
    await assertFails(getBytes(ref(storage, 'random/path.pdf')));
  });
});
