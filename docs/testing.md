# Testing

## Rules unit tests

The Firestore + Storage security rules are covered by unit tests in `tests/`
using `@firebase/rules-unit-testing`. They run against the Firebase emulators
and cover every collection in `firestore.rules` (requests, users,
requestEvents, chats, messages, auditLogs, answers, businesses, organizations,
catch-all) plus the `storage.rules` request-attachment paths.

```
cd tests && npm install   # pulls firebase-tools (provides the emulators)
cd ..                     # back to repo root
npm run test:rules        # boots firestore + storage emulators, then runs jest
```

`test:rules` runs from the repo root and points `emulators:exec` at
`firebase.emulators.json` (a hosting-free config) so it does not try to emulate
the Next.js app. 56 tests, all passing.

Requires **Java 11+** (the emulators are JVM processes). See `tests/README.md`
for details.

## Test plan (wiki)

The full test plan lives in the wiki (`Test-Plan` page), due 24 May 2026.

## E2E / unit (TODO)

Frontend and backend unit/E2E tests are TODO — see issues.
