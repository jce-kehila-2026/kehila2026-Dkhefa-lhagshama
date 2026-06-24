/**
 * Admin-side handler for POST /api/admin/requests/task (req 20/21): creates a
 * volunteer "task request" that originates from staff and lands directly in the
 * available volunteer pool to be claimed (req 22), as opposed to a UC-01
 * beneficiary request. Mounted by the adminRequests router behind admin auth.
 *
 * Validates the body with zod (including an async check that `category` is an
 * ACTIVE id in the admin-managed taxonomy), enforces the per-request attachment
 * storage-isolation invariant, then `create()`s the doc under a server-generated
 * id. Collaborates with: firebaseAdmin (Firestore), categoriesCache (taxonomy),
 * requestEvents (timeline) and audit (audit log).
 */
import { randomUUID } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { isAllowedCategory } from '@/lib/categoriesCache';
import { writeRequestEvent } from '@/lib/requestEvents';

// ── POST /api/admin/requests/task ─────────────────────────────────────────
// Admin creates a "task request" surfaced to volunteers (req 20 + 21). Unlike
// a beneficiary request (UC-01), a task originates from the admin and starts in
// the available volunteer pool so volunteers can claim it (req 22).
//
// Body:
//   { title, description, category, urgency?, deadline?, attachments? }
//   - title:       required, 1-200 chars
//   - description: required, 1-4000 chars
//   - category:    required, an ACTIVE category id from the admin-managed taxonomy
//   - urgency:     'low' | 'medium' | 'high' (default 'medium')
//   - deadline:    ISO date/datetime string, or null (default null)
//   - attachments: optional array of { name, path, type, size, volunteerVisible? }
//                  volunteerVisible defaults to false when omitted.
// The doc id is generated server-side (crypto.randomUUID); we `create()` so a
// (vanishingly unlikely) id collision fails loudly rather than overwriting.
const taskAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  path: z.string().trim().min(1).max(1024),
  type: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  volunteerVisible: z.boolean().optional().default(false),
});

// Client-generated v4 UUID (mirrors createRequestSchema) — accepted so a retry
// is idempotent (see clientRequestId below).
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const taskSchema = z
  .object({
    // Optional client-supplied id for idempotency (audit L2): if a network retry
    // re-POSTs with the SAME id, the create() guard 409s instead of minting a
    // duplicate task. When omitted we fall back to a fresh server UUID (so a
    // client that doesn't send one keeps working, just non-idempotently).
    clientRequestId: z.string().regex(UUID_V4).optional(),
    title:       z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(4000),
    category:    z.string().trim().min(1).max(80),
    urgency:     z.enum(['low', 'medium', 'high']).default('medium'),
    deadline: z
      .string()
      .trim()
      .refine((s) => !Number.isNaN(Date.parse(s)), 'deadline must be a valid date')
      .nullable()
      .optional(),
    attachments: z.array(taskAttachmentSchema).max(20).optional().default([]),
  })
  .superRefine(async (data, ctx) => {
    // No more free-text task categories: must be an ACTIVE id from the
    // admin-managed taxonomy (Firestore `categories`, cached ~60s). Fail-open
    // if the taxonomy is unseeded — see lib/categoriesCache.
    if (!(await isAllowedCategory(data.category, 'active'))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'unknown category',
      });
    }
  });

export async function createTask(req: Request, res: Response): Promise<void> {
  // safeParseAsync: the schema's superRefine awaits the category taxonomy.
  const parsed = await taskSchema.safeParseAsync(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;
  const actorId = req.user!.uid;
  // Prefer the client-supplied id (idempotent retries); else a fresh server UUID.
  const requestId = input.clientRequestId ?? randomUUID();

  // Storage-isolation guard: every attachment path MUST live under this
  // request's own prefix. Otherwise a task's attachment could point at another
  // beneficiary's PII object (e.g. requests/<otherId>/national-id.pdf) and the
  // download broker (GET /:id/attachments/:name) would mint a signed URL for it
  // to the assigned volunteer, crossing the per-request isolation boundary.
  // The real flow uploads task files AFTER create via the upload route (which
  // writes to requests/${id}/...), so a path outside this prefix is never
  // legitimate here.
  const expectedPrefix = `requests/${requestId}/`;
  const badAttachment = input.attachments.find((a) => !a.path.startsWith(expectedPrefix));
  if (badAttachment) {
    res.status(400).json({ error: 'invalid_attachment_path' });
    return;
  }

  // Normalize attachments so every entry carries an explicit volunteerVisible
  // flag (default false) — never leave it undefined in Firestore.
  const attachments = input.attachments.map((a) => ({
    name: a.name,
    path: a.path,
    type: a.type,
    size: a.size,
    volunteerVisible: a.volunteerVisible === true,
  }));

  try {
    await db().collection('requests').doc(requestId).create({
      // Task provenance
      origin:      'admin',
      requestType: 'task',
      createdBy:   actorId,

      // Body
      title:       input.title,
      description: input.description,
      category:    input.category,
      urgency:     input.urgency,
      deadline:    input.deadline ?? null,

      // Lifecycle — starts pending and available in the volunteer pool (req 22)
      status:              'pending',
      poolStatus:          'available',
      assignedVolunteerId: null,
      handler:             null,
      hasClaims:           false,
      claims:              [],
      wasPreviouslyTaken:  false,

      // Attachments (each carries its own volunteerVisible flag)
      attachments,

      // Timestamps
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // `create()` throws ALREADY_EXISTS (gRPC code 6) on an id collision.
    const code = (err as { code?: number }).code;
    if (code === 6) {
      res.status(409).json({ error: 'duplicate_request_id' });
      return;
    }
    console.error('[adminRequests] POST /task:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  // Timeline event (internal — staff/volunteer facing) + audit trail.
  try {
    await writeRequestEvent({
      requestId,
      type: 'created',
      actorId,
      visibility: 'internal',
      details: { kind: 'task', category: input.category, urgency: input.urgency },
    });
    await writeAuditLog({
      actorId,
      action: 'request.task_create',
      entityType: 'requests',
      entityId: requestId,
      details: {
        category: input.category,
        urgency: input.urgency,
        hasAttachments: attachments.length > 0,
      },
    });
  } catch (err) {
    // The task was created; bookkeeping failure shouldn't fail the response.
    console.error('[adminRequests] POST /task side-effects:', err);
  }

  res.status(201).json({ id: requestId });
}
