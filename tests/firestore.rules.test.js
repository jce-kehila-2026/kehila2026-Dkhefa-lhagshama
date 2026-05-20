/**
 * Firestore security rules unit tests.
 *
 * Tests:
 *   - /requests: owner, handler, admin can read; strangers cannot.
 *   - /chats:    participants can read; non-participants cannot (Risk-#5).
 *   - /messages: participants of the parent chat can read; strangers cannot.
 *   - Writes to all collections are denied to clients.
 *
 * Run via: firebase emulators:exec --only firestore "npm test"
 * The emulator is pointed at the root firestore.rules file.
 */

const { readFileSync } = require("fs");
const { resolve } = require("path");

const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "demo-test";
const RULES_PATH = resolve(__dirname, "../firestore.rules");

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "localhost",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ── helpers ──────────────────────────────────────────────────────────────

function authed(uid, tokenOverrides = {}) {
  return testEnv.authenticatedContext(uid, tokenOverrides);
}

function anon() {
  return testEnv.unauthenticatedContext();
}

async function seedDoc(collection, id, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(collection).doc(id).set(data);
  });
}

// ── /requests ────────────────────────────────────────────────────────────

describe("/requests", () => {
  const REQUEST_ID = "req-001";
  const BENEFICIARY = "uid-bene";
  const HANDLER = "uid-handler";
  const STRANGER = "uid-stranger";

  beforeEach(async () => {
    await seedDoc("requests", REQUEST_ID, {
      beneficiaryId: BENEFICIARY,
      handler: HANDLER,
      category: "education",
      status: "pending",
    });
  });

  test("beneficiary can read own request", async () => {
    const db = authed(BENEFICIARY).firestore();
    await assertSucceeds(db.collection("requests").doc(REQUEST_ID).get());
  });

  test("handler can read assigned request", async () => {
    const db = authed(HANDLER).firestore();
    await assertSucceeds(db.collection("requests").doc(REQUEST_ID).get());
  });

  test("admin can read any request", async () => {
    const db = authed("uid-admin", { role: "admin" }).firestore();
    await assertSucceeds(db.collection("requests").doc(REQUEST_ID).get());
  });

  test("stranger cannot read a request", async () => {
    const db = authed(STRANGER).firestore();
    await assertFails(db.collection("requests").doc(REQUEST_ID).get());
  });

  test("unauthenticated user cannot read a request", async () => {
    const db = anon().firestore();
    await assertFails(db.collection("requests").doc(REQUEST_ID).get());
  });

  test("client cannot write a request", async () => {
    const db = authed(BENEFICIARY).firestore();
    await assertFails(
      db.collection("requests").doc("req-new").set({ beneficiaryId: BENEFICIARY })
    );
  });
});

// ── /chats (Risk-#5 mitigation) ──────────────────────────────────────────

describe("/chats", () => {
  const CHAT_ID = "chat-001";
  const PARTICIPANT_A = "uid-partA";
  const PARTICIPANT_B = "uid-partB";
  const OUTSIDER = "uid-outsider";

  beforeEach(async () => {
    await seedDoc("chats", CHAT_ID, {
      requestId: "req-001",
      participants: [PARTICIPANT_A, PARTICIPANT_B],
      lastMessageAt: new Date(),
    });
  });

  test("participant A can read the chat", async () => {
    const db = authed(PARTICIPANT_A).firestore();
    await assertSucceeds(db.collection("chats").doc(CHAT_ID).get());
  });

  test("participant B can read the chat", async () => {
    const db = authed(PARTICIPANT_B).firestore();
    await assertSucceeds(db.collection("chats").doc(CHAT_ID).get());
  });

  test("non-participant is denied read", async () => {
    const db = authed(OUTSIDER).firestore();
    await assertFails(db.collection("chats").doc(CHAT_ID).get());
  });

  test("unauthenticated user is denied read", async () => {
    const db = anon().firestore();
    await assertFails(db.collection("chats").doc(CHAT_ID).get());
  });

  test("client cannot create a chat", async () => {
    const db = authed(PARTICIPANT_A).firestore();
    await assertFails(
      db.collection("chats").doc("chat-new").set({
        participants: [PARTICIPANT_A],
        requestId: "req-x",
        lastMessageAt: new Date(),
      })
    );
  });
});

// ── /messages ────────────────────────────────────────────────────────────

describe("/messages", () => {
  const CHAT_ID = "chat-002";
  const MSG_ID = "msg-001";
  const PARTICIPANT_A = "uid-msgPartA";
  const PARTICIPANT_B = "uid-msgPartB";
  const OUTSIDER = "uid-msgOutsider";

  beforeEach(async () => {
    await seedDoc("chats", CHAT_ID, {
      requestId: "req-002",
      participants: [PARTICIPANT_A, PARTICIPANT_B],
      lastMessageAt: new Date(),
    });
    await seedDoc("messages", MSG_ID, {
      chatId: CHAT_ID,
      senderId: PARTICIPANT_A,
      content: "Hello",
      timestamp: new Date(),
      status: "sent",
    });
  });

  test("participant can read a message", async () => {
    const db = authed(PARTICIPANT_A).firestore();
    await assertSucceeds(db.collection("messages").doc(MSG_ID).get());
  });

  test("non-participant is denied reading a message", async () => {
    const db = authed(OUTSIDER).firestore();
    await assertFails(db.collection("messages").doc(MSG_ID).get());
  });

  test("unauthenticated user is denied reading a message", async () => {
    const db = anon().firestore();
    await assertFails(db.collection("messages").doc(MSG_ID).get());
  });

  test("client cannot write a message", async () => {
    const db = authed(PARTICIPANT_A).firestore();
    await assertFails(
      db.collection("messages").doc("msg-new").set({
        chatId: CHAT_ID,
        senderId: PARTICIPANT_A,
        content: "Hi",
        timestamp: new Date(),
        status: "sent",
      })
    );
  });
});
