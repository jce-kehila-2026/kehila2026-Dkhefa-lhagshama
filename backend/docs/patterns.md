# Backend Patterns — Reference for Vertical-Slice Owners

The Express backend follows one shape so every vertical slice (UC-01..UC-05) looks the same. Read this before writing a new route file. `POST /api/requests` is the canonical reference — copy it.

## File layout

```
backend/src/
├── index.ts                # Express bootstrap, mounts routers
├── lib/
│   ├── firebaseAdmin.ts    # initializeFirebaseAdmin(), db(), auth(), storage()
│   └── audit.ts            # writeAuditLog({ actorId, action, entityType, entityId, details })
├── middleware/
│   └── auth.ts             # authenticate, requireRole('admin'|...), req.user = { uid, email, role }
└── routes/
    ├── auth.ts             # POST /api/auth/register     (CC-5)
    ├── requests.ts         # /api/requests/*             (UC-01)
    └── ... your UC here ...
```

## Route file shape

Every route file exports a `Router` and is mounted in `src/index.ts` under `/api/<resource>`.

```ts
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { authenticate, requireRole } from '@/middleware/auth';

const router = Router();

// One zod schema per endpoint, defined at file top.
const createXSchema = z.object({ /* ... */ });

router.post('/', authenticate, /* requireRole('admin') if applicable */, async (req: Request, res: Response) => {
  // 1. Bail if no user (defense in depth — authenticate already checks).
  if (!req.user) { res.status(401).json({ error: 'not_authenticated' }); return; }

  // 2. Validate body with zod.
  const parsed = createXSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  // 3. Do the work (Firestore write, etc.). Use try/catch around create().
  // 4. Fire-and-forget audit log on success.
  // 5. 201 / 200 with minimal payload.
});

export default router;
```

## Zod validation

- One schema per endpoint, at file top.
- Use `.trim().min().max()` on strings; `.coerce.number()` for numeric form fields; `.enum()` for finite vocabularies; `.literal(true)` for consent flags.
- Always use `.safeParse(...)` — never `.parse(...)` — so the handler doesn't throw 500 on bad input.
- Error shape: `{ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors }`.

## Auth + role gating

- `authenticate` is required on every non-public route. It verifies the Firebase ID token from `Authorization: Bearer <token>` and attaches `req.user = { uid, email, role }`.
- For admin-only routes: chain `requireRole('admin')` after `authenticate`.
- For "beneficiary OR volunteer" gating, **don't** use `requireRole` — write an inline check (see `routes/requests.ts`).

## Firestore writes

- Use `db().collection(...).doc(id).create(data)` rather than `.set(data)` when you want to **reject duplicates** loudly. `create()` throws gRPC code 6 (`ALREADY_EXISTS`); convert to 409.
- Use `FieldValue.serverTimestamp()` for `createdAt`/`updatedAt`. Never `new Date()` server-side.
- Reads in routes should respect the security rules logically — if `firestore.rules` denies a read for the caller, the API should also return 403 (defense in depth).

## Audit log

Every server-trusted write should write an audit log entry. Use `writeAuditLog`:

```ts
writeAuditLog({
  actorId: req.user.uid,
  action: 'request.create',         // 'noun.verb' format
  entityType: 'requests',
  entityId: input.requestId,
  details: { /* small JSON */ },
}).catch((err) => console.error('audit failed:', err));
```

Fire-and-forget — never block the response on the audit write. If the log fails the user already got their 201; we just lose one entry.

## Error response shape

Use these consistent shapes so the frontend can react sensibly:

| Status | Body | When |
|---|---|---|
| 400 | `{ error: 'validation', fieldErrors: {...} }` | zod failure |
| 401 | `{ error: 'missing_token' \| 'invalid_token' }` | from `authenticate` |
| 403 | `{ error: 'forbidden', detail?: string }` | role mismatch |
| 404 | `{ error: 'not_found' }` | unknown doc |
| 409 | `{ error: 'duplicate_<resource>_id' }` | Firestore ALREADY_EXISTS |
| 500 | `{ error: 'internal' }` | unexpected — also `console.error` the cause |

## Frontend page structure (Next.js Pages Router)

Each UC has the same shape on the frontend:

```
frontend/
├── pages/<route>.tsx        # Thin wrapper — re-exports the screen
└── src/
    └── screens/<UC>Page.jsx # Implementation (use .tsx if you want types)
```

The `pages/<route>.tsx` file is a one-liner so the route surface stays readable:

```tsx
// frontend/pages/my-requests.tsx
import MyRequestsPage from '@/screens/MyRequestsPage'
export default function Page() { return <MyRequestsPage /> }
```

The screen file is where all the logic lives. Three things every UC screen should do:

1. **Auth-guard the route** with `useAuth()` — if not signed in, redirect to `/login?next=<path>`.
2. **Read translations** via `useLanguage()` — every visible string goes through `t.<scope>` so HE/EN switching works. Add your scope to `frontend/src/data/translations.js` for both `he:` and `en:` blocks.
3. **Call the backend** via `apiFetch` / `apiJson` from `@/lib/apiClient` — never raw `fetch()`.

```tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { apiJson } from '@/lib/apiClient'

export default function ExamplePage() {
  const { t } = useLanguage()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState([])

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(router.pathname)}`)
    }
  }, [authLoading, user, router])

  // Data fetch
  useEffect(() => {
    if (authLoading || !user) return
    let alive = true
    apiJson('/api/<resource>/mine')
      .then(d => { if (alive) setItems(d.items || []) })
      .catch(err => console.error(err))
    return () => { alive = false }
  }, [authLoading, user])

  if (authLoading) return <div>{t.common.loading}</div>
  return <div>{/* render items, use t.<scope>.* for labels */}</div>
}
```

Look at `frontend/src/screens/MyRequestsPage.jsx` for the canonical reference.

## Frontend fetch pattern

The Next.js side uses `apiFetch(path, init)` / `apiJson<T>(path, init)` from `frontend/src/lib/apiClient.ts`. Both automatically attach `Authorization: Bearer ${idToken}` for the signed-in user. **Never call `fetch()` directly** from a Next.js page that hits the backend.

```ts
import { apiFetch, apiJson } from '@/lib/apiClient';

// Fire-and-forget POST with manual response handling:
const res = await apiFetch('/api/requests', {
  method: 'POST',
  body: JSON.stringify(payload),
});
if (!res.ok) { /* show validation/error UX */ }

// Read with auto-throw on non-2xx:
const { items } = await apiJson<{ items: Request[] }>('/api/requests/mine');
```

## End-to-end smoke test — UC-01

Reproducible from the CLI. Boot the backend (`npm run dev` in `backend/`) and the frontend (`npm run dev` in `frontend/`). Then in a browser, register a user via `/register` and copy the ID token from devtools (or call `firebase.auth().currentUser.getIdToken().then(console.log)` in the console).

```bash
TOKEN="<paste-id-token-here>"
REQ_ID=$(node -e "console.log(crypto.randomUUID())")

curl -i -X POST http://localhost:3001/api/requests \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"requestId\":\"$REQ_ID\",
    \"firstName\":\"Test\",\"lastName\":\"User\",
    \"idNumber\":\"123456789\",\"phone\":\"050-0000000\",
    \"email\":\"test@example.com\",\"city\":\"תל אביב\",
    \"age\":30,\"gender\":\"other\",
    \"category\":\"education\",
    \"description\":\"Need help applying for a scholarship.\",
    \"urgency\":\"low\",
    \"consent\":true
  }"
# Expected: HTTP/1.1 201 Created
# {"requestId":"<uuid>"}
```

Then check the Firestore console for `requests/<uuid>` with `status: pending`, `beneficiaryId: <your-uid>`, and `auditLogs/...` for the matching `request.create` entry.

**Failure modes worth testing manually:**

- Omit `Authorization` → 401 `missing_token`.
- Set `consent: false` → 400 `validation` with `fieldErrors.consent`.
- Send a description shorter than 10 chars → 400 `validation`.
- POST the same `requestId` twice → 409 `duplicate_request_id`.
