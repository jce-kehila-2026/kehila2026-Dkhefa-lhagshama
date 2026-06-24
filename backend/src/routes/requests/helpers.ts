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
 *
 * OWNERSHIP FILTER (audit L11): the pre-create upload flow authorizes writes
 * purely on the unguessable request UUID, so in principle any authed user could
 * have dropped objects under this prefix. We therefore adopt ONLY objects whose
 * Storage `uploadedBy` metadata matches the submitter — a stray object uploaded
 * by anyone else is ignored (and logged), so the UUID secrecy is no longer the
 * sole control over what becomes a request attachment.
 */
export async function reconcileAttachmentsFromStorage(
  requestId: string,
  submitterUid: string,
): Promise<number> {
  const prefix = `requests/${requestId}/`;
  const [files] = await storage().getFiles({ prefix });

  let skipped = 0;
  const attachments: AttachmentMeta[] = files
    // Skip any "directory placeholder" object equal to the prefix itself.
    .filter((f) => f.name && f.name !== prefix)
    // Adopt only objects the submitter uploaded (audit L11).
    .filter((f) => {
      const uploadedBy = ((f.metadata?.metadata ?? {}) as Record<string, string | undefined>).uploadedBy;
      if (uploadedBy === submitterUid) return true;
      skipped += 1;
      return false;
    })
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

  if (skipped > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[requests.reconcile] ${requestId}: ignored ${skipped} object(s) not uploaded by the submitter`,
    );
  }

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

// NOTE (audit L8): the WS-3 friendly-reference allocation (counters/requests ->
// REQ-####) USED to be a standalone transaction here, committed BEFORE the
// request `create()`. That burned a sequence number whenever the create failed
// (duplicate id / error), leaving permanent gaps. It now lives INSIDE the single
// create transaction in create.ts, so a failed create rolls the counter back.
// `formatDisplayId` (lib/displayId) is the shared int->REQ-#### formatter.
