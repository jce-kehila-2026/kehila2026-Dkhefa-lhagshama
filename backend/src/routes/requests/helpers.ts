/**
 * Shared helpers for the /api/requests Express handlers (UC-01 request intake +
 * lifecycle). Three concerns: rebuilding the `attachments` array on a request
 * from Storage objects, a transaction-scoped error type used to abort a state
 * transition with a specific HTTP status, and allocating the friendly REQ-####
 * reference. Collaborates with Firestore + Storage (firebaseAdmin) and the
 * displayId formatter; imported by the route modules under routes/requests/.
 * Mechanical extraction from the former single-file routes/requests.ts, logic
 * unchanged.
 */
import { FieldValue } from 'firebase-admin/firestore';

import { db, storage } from '@/lib/firebaseAdmin';
import { formatDisplayId } from '@/lib/displayId';

/** Structured attachment metadata persisted on `requests.attachments`. */
interface AttachmentMeta {
  name: string;
  path: string;
  type: string | null;
  size: number | null;
  uploadedBy: string | null;
  volunteerVisible: boolean;
}

/**
 * Reconcile `requests.attachments` from the Storage objects under
 * requests/{requestId}/ (Note 1 / review r6).
 *
 * In the UC-01 beneficiary flow, files are uploaded in step 3 BEFORE the
 * request doc exists (the client generates `requestId` up front). The upload
 * route's `attachments` write is an `.update()` that therefore throws
 * NOT_FOUND and is swallowed — so a freshly-created doc has only
 * `attachmentPaths` (raw path strings) and an empty `attachments` array, and
 * every staff-facing viewer (admin doc panel, volunteer card, the
 * GET /:id/attachments/:name signed-URL endpoint) reads `attachments` and
 * shows nothing.
 *
 * After `create()`, list the uploaded objects and rebuild `attachments` from
 * their Storage metadata (name/path/type/size/uploadedBy + the
 * volunteerVisible flag the upload route stamps onto the object). Best-effort:
 * a Storage failure leaves `attachmentPaths` intact, so the create still
 * succeeds. Returns the count written (for logging / audit detail).
 */
export async function reconcileAttachmentsFromStorage(requestId: string): Promise<number> {
  const prefix = `requests/${requestId}/`;
  const [files] = await storage().getFiles({ prefix });

  const attachments: AttachmentMeta[] = files
    // Skip any "directory placeholder" object equal to the prefix itself.
    .filter((f) => f.name && f.name !== prefix)
    .map((f) => {
      const md = (f.metadata ?? {}) as {
        contentType?: string;
        size?: string | number;
        metadata?: Record<string, string | undefined>;
      };
      const custom = md.metadata ?? {};
      const sizeNum = typeof md.size === 'string' ? Number(md.size) : (md.size ?? null);
      return {
        // basename — mirrors how the upload route names attachments (so the
        // GET /:id/attachments/:name lookup matches).
        name: f.name.slice(prefix.length),
        path: f.name,
        type: md.contentType ?? null,
        size: Number.isFinite(sizeNum as number) ? (sizeNum as number) : null,
        uploadedBy: custom.uploadedBy ?? null,
        // Default to visible when unset (pre-flag uploads); only an explicit
        // "false" hides a file from the volunteer-facing task projection.
        volunteerVisible: custom.volunteerVisible !== 'false',
      };
    });

  if (attachments.length === 0) return 0;

  await db().collection('requests').doc(requestId).update({
    attachments,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return attachments.length;
}

/** Thrown inside a transaction to bail out with a specific HTTP status. */
export class TransitionError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'TransitionError';
  }
}

// ── Friendly request reference allocation (WS-3) ────────────────────────────
// Allocate the next sequential integer from a single `counters/requests` doc
// inside a transaction, then format it as REQ-####. The transaction's
// read-then-write on the same doc serializes concurrent allocations, so two
// requests created at the same instant get distinct numbers (no collision).
// The counter is the ONLY shared doc touched here; the request doc itself is
// created separately (its UUID id already guarantees uniqueness).
export async function allocateNextRequestNumber(): Promise<{ n: number; displayId: string }> {
  const counterRef = db().collection('counters').doc('requests');
  const n = await db().runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? Number((snap.data() as { next?: unknown }).next) : 0;
    const next = (Number.isFinite(current) && current > 0 ? current : 0) + 1;
    tx.set(counterRef, { next }, { merge: true });
    return next;
  });
  return { n, displayId: formatDisplayId(n) };
}
