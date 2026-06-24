/**
 * Validation contract for the /api/requests handlers (UC-01 Submit Request +
 * the close handshake). Owns the zod schemas the route layer parses incoming
 * bodies against, plus the close-action status map.
 *
 * Collaborators: routes/requests/* (the handlers that import these),
 * lib/categoriesCache (live admin taxonomy, queried in the async refine).
 * Key invariant: createRequestSchema must be parsed with safeParseAsync — its
 * category check is async (Firestore-backed). Extracted verbatim from the
 * former single-file routes/requests.ts; validation logic is unchanged.
 */
import { z } from 'zod';

import { isAllowedCategory } from '@/lib/categoriesCache';

// ── Schema ────────────────────────────────────────────────────────────────
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createRequestSchema = z
  .object({
    // Client-generated UUID, used as both Firestore doc id and Storage path prefix.
    // Using `create()` server-side rejects duplicate ids loudly.
    requestId: z.string().regex(UUID_V4, 'requestId must be a v4 UUID'),

    // Personal info
    firstName: z.string().trim().min(1).max(80),
    lastName:  z.string().trim().min(1).max(80),

    // Identity (#66). idType drives whether an Israeli ID number is required.
    //   israeli_id → idNumber required
    //   passport / none → idNumber optional, idNote explains the situation
    idType:   z.enum(['israeli_id', 'passport', 'none']).default('israeli_id'),
    idNumber: z.string().trim().max(40).optional().default(''),
    idNote:   z.string().trim().max(400).optional().default(''),

    phone:     z.string().trim().min(1).max(40),
    email:     z.string().trim().email().max(120),
    city:      z.string().trim().min(1).max(80),
    age:       z.coerce.number().int().min(0).max(120),
    gender:    z.enum(['male', 'female', 'other', '']).default(''),

    // Request body. `category` is validated against the live admin-managed
    // taxonomy (Firestore `categories` collection) in the async superRefine
    // below — no more static enum. Fail-open if the taxonomy is unseeded
    // (see lib/categoriesCache).
    category:    z.string().trim().min(1).max(80),
    description: z.string().trim().min(10).max(4000),
    urgency:     z.enum(['low', 'medium', 'high']).default('low'),

    // Beneficiary's preferred contact language (WS-6). Drives the volunteer
    // matcher's language signal. Optional; null when the beneficiary skipped it.
    preferredLanguage: z.enum(['he', 'am', 'en']).nullable().optional().default(null),

    // Optional deadline (#68). ISO date or datetime string; validated parseable.
    deadline: z
      .string()
      .trim()
      .refine((s) => !Number.isNaN(Date.parse(s)), 'deadline must be a valid date')
      .optional(),

    // Consent — must be true. Aligns with wiki UC-01 step 4.
    consent: z.literal(true, {
      errorMap: () => ({ message: 'consent must be true' }),
    }),

    // Optional Storage paths under requests/{requestId}/...
    attachmentPaths: z.array(z.string().min(1)).max(20).optional().default([]),

    // Volunteer-on-behalf flag (UC-01 A2). Persisted only when the caller is a
    // volunteer; ignored for beneficiaries (see docRef.create below).
    onBehalf: z.boolean().optional().default(false),

    // Volunteer-on-behalf alt flow (UC-01 A2). Full UX deferred; schema scaffolded.
    onBehalfOf: z
      .object({
        uid: z.string().min(1).optional(),
      })
      .optional(),
  })
  .superRefine(async (data, ctx) => {
    // An Israeli ID number is mandatory only when idType is israeli_id (#66).
    if (data.idType === 'israeli_id' && data.idNumber.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['idNumber'],
        message: 'idNumber is required when idType is israeli_id',
      });
    }

    // Category must be an ACTIVE (non-archived) taxonomy id. Async because the
    // id set lives in Firestore (cached ~60s) — hence safeParseAsync below.
    if (!(await isAllowedCategory(data.category, 'active'))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'unknown category',
      });
    }

    // Attachment paths must live under THIS request's own Storage prefix
    // (audit L12). A client could otherwise persist an arbitrary path string
    // that a future consumer might trust as a Storage key (path confusion). The
    // authoritative `attachments` array is rebuilt from Storage at create time,
    // so this hardens the raw `attachmentPaths` field against misuse.
    const attachmentPrefix = `requests/${data.requestId}/`;
    for (const p of data.attachmentPaths ?? []) {
      if (!p.startsWith(attachmentPrefix) || p.includes('..') || p.includes('\\')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attachmentPaths'],
          message: 'attachmentPaths must be under requests/<requestId>/',
        });
        break;
      }
    }
  });

// Parsed+defaulted shape the POST /api/requests handler consumes (post-validation).
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

// ── Close handshake (req 25) ────────────────────────────────────────────────
// Body for the request-close lifecycle: a party proposes a close, the other
// approves/declines. The handler maps its outcome onto CLOSE_HTTP below.
export const closeSchema = z.object({
  action: z.enum(['propose', 'approve', 'decline']),
});

// Maps the close handler's outcome string to the HTTP status it returns.
export const CLOSE_HTTP: Record<string, number> = {
  ok: 200,
  not_found: 404,
  forbidden: 403,
  invalid_state: 409,
};
