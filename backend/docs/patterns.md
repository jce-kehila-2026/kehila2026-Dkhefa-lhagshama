# Backend Patterns — Reference for Vertical-Slice Owners

> Filled in as soon as **UC-01 Submit Request** lands. The first vertical slice acts as the reference pattern; the other 3 owners (UC-02/UC-03 Hamza, UC-04 Mhammad, UC-05 Abdullah) follow the same shape so the codebase stays consistent.

This is a placeholder. After UC-01-c lands (Express `POST /api/requests`), Muhammad Marmash will fill this with:

1. **Route file shape** — imports, router export, middleware order.
2. **Zod input validation pattern** — schema definition + `safeParse` + 400 response shape.
3. **Auth + role-gating pattern** — `authenticate` then `requireRole(...)` if needed.
4. **Firestore write pattern** — using `db()` from `lib/firebaseAdmin`, `serverTimestamp()`, transaction usage.
5. **Audit log pattern** — when to call `writeAuditLog`.
6. **Error response shape** — consistent JSON error format across endpoints.
7. **Frontend fetch pattern** — how the Next.js side attaches the Firebase ID token.

Until this is filled, the only canonical references are:
- [`src/index.ts`](../src/index.ts) — Express bootstrap.
- [`src/middleware/auth.ts`](../src/middleware/auth.ts) — token verify and `requireRole`.
- [`src/lib/firebaseAdmin.ts`](../src/lib/firebaseAdmin.ts) — Admin SDK handles.
- [`src/lib/audit.ts`](../src/lib/audit.ts) — audit log writer.
