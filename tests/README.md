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
firebase.emulators.json     # (repo root) hosting-free emulator config
```

56 tests, all passing.

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

This wraps jest in `firebase emulators:exec`, starting the Firestore (`:8080`)
and Storage (`:9199`) emulators, running the suite, then shutting them down.

It points `emulators:exec` at `firebase.emulators.json` (a hosting-free copy of
the Firestore/Storage config). The root `firebase.json` uses framework-aware
hosting (`hosting.source: frontend`), which would otherwise make
`emulators:exec` try to emulate the Next.js app and fail. The emulator ports
match `firebase.json`.

If the emulators are already running, you can run jest directly from `tests/`:

```bash
cd tests && npm test
```

> Note: `firebase emulators:exec` may exit non-zero on its own shutdown path on
> some firebase-tools versions even when every test passed — check the
> `Test Suites: N passed` / `Script exited successfully (code 0)` lines in the
> output to confirm the jest run itself succeeded.

## CI

These run in `.github/workflows/ci.yml` (job `rules`): it installs Java +
firebase-tools, `npm install` in `tests/`, then `npm run test:rules`.
