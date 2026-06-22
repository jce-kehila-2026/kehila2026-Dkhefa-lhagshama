/**
 * POST /api/requests — UC-01 Submit Assistance Request.
 *
 * Mechanical extraction from the former single-file routes/requests.ts —
 * the handler logic is unchanged.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';

import { createRequestSchema, type CreateRequestInput } from './schemas';
import { allocateNextRequestNumber, reconcileAttachmentsFromStorage } from './helpers';

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

  // The beneficiaryId is the target user. For a volunteer submitting on behalf
  // with a known uid, use that; otherwise the beneficiary is the caller (the
  // common case — UC-01 main flow).
  const beneficiaryId =
    role === 'volunteer' && input.onBehalfOf?.uid ? input.onBehalfOf.uid : req.user.uid;

  const docRef = db().collection('requests').doc(input.requestId);

  let displayId: string;
  try {
    ({ displayId } = await allocateNextRequestNumber());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.create] displayId allocation failed:', err);
    res.status(500).json({ error: 'internal' });
    return;
  }

  try {
    await docRef.create({
      beneficiaryId,
      submittedBy: req.user.uid,             // who actually pressed submit
      submittedByRole: role,                 // 'beneficiary' or 'volunteer'
      onBehalf: role === 'volunteer' ? input.onBehalf === true : false,
      // Friendly parallel reference (WS-3) — display-only; the UUID stays the key.
      displayId,

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
  } catch (err) {
    // `create()` throws ALREADY_EXISTS (gRPC code 6) if the doc already exists.
    const code = (err as { code?: number }).code;
    if (code === 6) {
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
    await reconcileAttachmentsFromStorage(input.requestId);
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
