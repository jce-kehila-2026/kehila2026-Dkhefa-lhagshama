# Rules tests (`tests/`)

Firestore + Storage **security rules** unit tests (#89), written with
[`@firebase/rules-unit-testing`](https://firebase.google.com/docs/rules/unit-tests).

They assert that the client SDK can only do what `firestore.rules` and
`storage.rules` allow — everything trusted is written through the Express
backend (Admin SDK, which bypasses rules).

```
tests/
├── rules/
│   ├── firestore.test.js   # requests, users, requestEvents, chats, messages,
│   │                       # auditLogs, answers, businesses, organizations, catch-all
│   └── storage.test.js     # request attachments + catch-all
├── jest.config.js
└── package.json
```

## Prerequisites

- **Node 18+**
- **Java 11+** — the Firebase emulators are JVM processes
  (`java -version` should print 11 or newer).
- Dependencies installed: `cd tests && npm install`
  (this pulls `firebase-tools`, which provides the emulators).

## Run the tests

From the **repo root**:

```bash
npm run test:rules
```

or equivalently, from `tests/`:

```bash
npm run test:rules          # boots firestore + storage emulators, then runs jest
# or, if the emulators are already running:
npm test
```

`test:rules` wraps jest in `firebase emulators:exec`, which starts the
Firestore (`:8080`) and Storage (`:9199`) emulators, runs the suite, and shuts
them down. The emulator ports match `firebase.json`.

> Note: `firebase emulators:exec` may exit non-zero on its own shutdown path on
> some firebase-tools versions even when every test passed — check the
> `Test Suites: N passed` / `Script exited successfully (code 0)` lines in the
> output to confirm the jest run itself succeeded.

## CI

These tests are emulator-backed (network + JVM), so they are kept out of the
deploy workflow's critical path for now. To wire them into CI, add a job that:

1. `actions/setup-java` (Temurin 11+)
2. `cd tests && npm ci`
3. `npm run test:rules`
