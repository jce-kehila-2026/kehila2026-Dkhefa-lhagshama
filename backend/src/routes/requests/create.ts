/**
 * POST /api/requests — UC-01 Submit Assistance Request.
 *
 * The single write path that turns a validated intake form into a `requests`
 * Firestore doc. Beneficiaries submit for themselves; volunteers may submit
 * on behalf of a known uid. Allocates the human-friendly displayId (REQ-####),
 * reconciles pre-uploaded attachments, then fires the audit log + timeline
 * event. Collaborators: ./schemas (zod validation incl. async category check),
 * ./helpers (displayId counter + Storage attachment rebuild), lib/audit,
 * lib/requestEvents. Invariant: the UUID `requestId` is the durable doc key
 * (create() guards against duplicates); displayId is a parallel display label.
 *
 * Extracted unchanged from the former single-file routes/requests.ts.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { formatDisplayId } from '@/lib/displayId';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';

import { createRequestSchema, type CreateRequestInput } from './schemas';
import { reconcileAttachmentsFromStorage, TransitionError } from './helpers';

// ── POST /api/requests ────────────────────────────────────────────────────
export async function createRequest(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  // Role gate. Beneficiary submits for self; volunteer can submit on behalf.
  // We don't `requireRole('beneficiary')` because that would block volunteers.
  const role = req.user.role;
  if (role !== 'beneficiary' && role !== 'volunteer') {
    res.status(403).json({
      error: 'forbidden',
      detail: 'submitting requests requires the beneficiary or volunteer role',
    });
    return;
  }

  // safeParseAsync: the schema's superRefine awaits the category taxonomy.
  const parsed = await createRequestSchema.safeParseAsync(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'validation',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const input: CreateRequestInput = parsed.data;

  // The beneficiary is ALWAYS the caller. The volunteer-on-behalf "submit for a
  // specific uid" path is intentionally NOT honored here (audit L3): the schema
  // still accepts `onBehalfOf.uid` as scaffolding, but consuming it without an
  // authorization model would let a volunteer attribute a request (with the PII
  // they typed) to ANY uid's account. The current frontend never sends a uid, so
  // ignoring it changes nothing today and closes the latent hole. The `onBehalf`
  // boolean (a flag, not a target) is still recorded for volunteer submissions.
  const beneficiaryId = req.user.uid;

  const docRef = db().collection('requests').doc(input.requestId);
  const counterRef = db().collection('counters').doc('requests');

  let displayId: string;
  try {
    // ATOMICITY FIX (audit L8): allocate the friendly REQ-#### number AND create
    // the request in ONE transaction. Previously the counter was incremented in
    // its own transaction BEFORE create(), so any create failure (duplicate id,
    // error) permanently burned that number, leaving REQ-#### gaps. Folding both
    // into one transaction rolls the counter back if the create can't commit.
    // Reading docRef inside the transaction also makes the duplicate-id check
    // race-safe (a concurrent create conflicts and aborts).
    displayId = await db().runTransaction(async (tx) => {
      // All reads first (Firestore: reads before writes).
      const counterSnap = await tx.get(counterRef);
      const docSnap = await tx.get(docRef);
      if (docSnap.exists) throw new TransitionError(409, 'duplicate_request_id');

      const current = counterSnap.exists ? Number((counterSnap.data() as { next?: unknown }).next) : 0;
      const next = (Number.isFinite(current) && current > 0 ? current : 0) + 1;
      const did = formatDisplayId(next);

      tx.set(counterRef, { next }, { merge: true });
      tx.set(docRef, {
        beneficiaryId,
        submittedBy: req.user!.uid,            // who actually pressed submit
        submittedByRole: role,                 // 'beneficiary' or 'volunteer'
        onBehalf: role === 'volunteer' ? input.onBehalf === true : false,
        // Friendly parallel reference (WS-3) — display-only; the UUID stays the key.
        displayId: did,

        // Personal info snapshot at submit time
        firstName: input.firstName,
        lastName:  input.lastName,
        idType:    input.idType,
        idNumber:  input.idNumber,
        idNote:    input.idNote,
        phone:     input.phone,
        email:     input.email,
        city:      input.city,
        age:       input.age,
        gender:    input.gender,

        // Body
        category:    input.category,
        description: input.description,
        urgency:     input.urgency,
        deadline:    input.deadline ?? null,
        preferredLanguage: input.preferredLanguage ?? null,

        // Lifecycle
        status:              'pending',
        handler:             null,
        assignedVolunteerId: null,
        assignedAt:          null,
        notes:               '',

        // Attachments
        attachmentPaths: input.attachmentPaths ?? [],

        // Timestamps
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return did;
    });
  } catch (err) {
    if (err instanceof TransitionError && err.code === 'duplicate_request_id') {
      res.status(409).json({ error: 'duplicate_request_id' });
      return;
    }
    // gRPC ABORTED (10): lost a create race; surface as a duplicate/retryable 409.
    if ((err as { code?: number }).code === 10) {
      res.status(409).json({ error: 'duplicate_request_id' });
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[requests.create] failed:', err);
    res.status(500).json({ error: 'internal' });
    return;
  }

  // ── Reconcile attachment metadata (Note 1 / review r6) ──────────────────
  // Files uploaded in UC-01 step 3 (before this doc existed) only left raw
  // paths in `attachmentPaths` — their structured `attachments` write 404'd at
  // upload time. Now that the doc exists, rebuild `attachments` from the
  // Storage objects so staff can list + open them. Awaited (not fire-and-
  // forget) so the array is populated before the client navigates to a view
  // that reads it; best-effort inside so a Storage hiccup never fails create.
  try {
    // Pass the submitter so reconcile adopts only objects THEY uploaded (L11).
    await reconcileAttachmentsFromStorage(input.requestId, req.user.uid);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.create] attachment reconcile failed:', err);
  }

  // Audit log — fire-and-forget. Don't block the response on it; surface in
  // server logs if it fails.
  writeAuditLog({
    actorId: req.user.uid,
    action: 'request.create',
    entityType: 'requests',
    entityId: input.requestId,
    details: {
      beneficiaryId,
      category: input.category,
      urgency:  input.urgency,
      hasAttachments: (input.attachmentPaths?.length ?? 0) > 0,
    },
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[requests.create] audit write failed:', err);
  });

  // Timeline event — user-facing history (#65). Fire-and-forget like the audit
  // log. visibility 'all' so the beneficiary sees their request was received.
  writeRequestEvent({
    requestId: input.requestId,
    type: 'created',
    actorId: req.user.uid,
    visibility: 'all',
    details: { category: input.category, urgency: input.urgency },
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[requests.create] event write failed:', err);
  });

  res.status(201).json({ requestId: input.requestId, displayId });
}
