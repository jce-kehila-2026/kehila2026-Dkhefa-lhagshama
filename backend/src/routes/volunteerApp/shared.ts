/**
 * Shared helpers + types for the /api/volunteer handler modules
 * (pool / assigned / requests). Extracted verbatim from the original
 * single-file router so behavior is preserved exactly.
 *
 * Holds the two card projections + a timestamp coercer + the transaction
 * bail-out error, all reused across those handlers. Key invariant: the card
 * projections are the PII gate for volunteer-facing responses, so requester
 * identity is intentionally limited to first name + city (no last name, phone,
 * email, or raw id fields).
 */

/** Firestore Timestamp | ISO string | null → ISO string | null. */
export function toIso(value: unknown): string | null {
  const ts = value as { toDate?: () => Date } | undefined;
  if (ts?.toDate) return ts.toDate().toISOString();
  if (typeof value === 'string') return value;
  return null;
}

export interface AttachmentLike {
  name?: string;
  path?: string;
  volunteerVisible?: boolean;
  [k: string]: unknown;
}

/**
 * Attachment projection for volunteer-facing cards. Include an attachment when
 * the request is NOT a task, OR the attachment is explicitly volunteer-visible.
 */
export function projectAttachments(data: Record<string, unknown>): AttachmentLike[] {
  const isTask = data.requestType === 'task';
  const attachments = (data.attachments as AttachmentLike[] | undefined) ?? [];
  if (!isTask) return attachments;
  return attachments.filter((att) => att?.volunteerVisible === true);
}

/** Card-safe shape for the assigned list (PII id fields hidden). */
export function toAssignedCard(id: string, data: Record<string, unknown>) {
  return {
    id,
    // Friendly REQ-#### ref + requester identity so the volunteer's "My
    // requests" cards (and the calendar) show who they are helping. Same PII
    // stance as the pool card: first name + city only.
    displayId: (data.displayId as string | undefined) ?? null,
    title: (data.title as string | undefined) ?? null,
    firstName: (data.firstName as string | undefined) ?? null,
    city: (data.city as string | undefined) ?? null,
    category: data.category ?? null,
    description: data.description ?? null,
    status: data.status ?? null,
    urgency: data.urgency ?? null,
    deadline: (data.deadline as string | null | undefined) ?? null,
    createdAt: toIso(data.createdAt),
    attachments: projectAttachments(data),
    wasPreviouslyTaken: data.wasPreviouslyTaken === true,
  };
}

/** Card-safe shape for the pool (more aggressive PII hiding for privacy). */
export function toPoolCard(id: string, data: Record<string, unknown>, uid: string) {
  const claims = (data.claims as Array<{ volunteerId?: string }> | undefined) ?? [];
  return {
    id,
    title: (data.title as string | undefined) ?? null,
    // Keep first name + city only; hide last name, phone, email, id fields.
    firstName: (data.firstName as string | undefined) ?? null,
    city: (data.city as string | undefined) ?? null,
    category: data.category ?? null,
    description: data.description ?? null,
    status: data.status ?? null,
    urgency: data.urgency ?? null,
    deadline: (data.deadline as string | null | undefined) ?? null,
    createdAt: toIso(data.createdAt),
    origin: (data.origin as string | undefined) ?? null,
    requestType: (data.requestType as string | undefined) ?? null,
    wasPreviouslyTaken: data.wasPreviouslyTaken === true,
    claimsCount: claims.length,
    claimedByMe: claims.some((c) => c?.volunteerId === uid),
    attachments: projectAttachments(data),
  };
}

/** Thrown inside a transaction to bail out with a specific HTTP status. */
export class OpError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'OpError';
  }
}
