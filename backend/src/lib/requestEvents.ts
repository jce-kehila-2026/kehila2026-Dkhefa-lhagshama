/**
 * Request-timeline helper (#65).
 *
 * Appends an immutable event to the `requestEvents` collection so a request's
 * full lifecycle (created → attachment added → assigned → status changed →
 * note added → rated) can be rendered as a timeline.
 *
 * Visibility gates who can read the event (see firestore.rules):
 *   - 'all'      → the owning beneficiary, plus volunteers/admins
 *   - 'internal' → volunteers/admins only (e.g. private admin notes)
 *
 * Writes always go through the Admin SDK here; clients can never write events.
 * Complements `writeAuditLog` — auditLogs is the security/incident trail,
 * requestEvents is the user-facing per-request history.
 */
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/lib/firebaseAdmin';

// closed set of lifecycle event kinds a request can record on its timeline.
export type RequestEventType =
  | 'created'
  | 'attachment_added'
  | 'assigned'
  | 'status_changed'
  | 'note_added'
  | 'close_consent'
  | 'rated';

// read-scope of an event: 'all' = owner + staff, 'internal' = staff only (enforced in firestore.rules).
export type RequestEventVisibility = 'all' | 'internal';

export interface RequestEventInput {
  requestId: string;                  // parent request doc id
  type: RequestEventType;             // what happened
  actorId: string;                    // uid of the user who triggered it
  visibility?: RequestEventVisibility; // defaults to 'all'
  details?: Record<string, unknown>;  // optional context (from/to status, note, etc.)
}

/**
 * Append a single timeline event. Returns the new event's doc id.
 * `visibility` defaults to 'all' so beneficiaries see ordinary lifecycle
 * events; pass 'internal' for staff-only entries.
 */
export async function writeRequestEvent(entry: RequestEventInput): Promise<string> {
  const ref = await db().collection('requestEvents').add({
    requestId: entry.requestId,
    type: entry.type,
    actorId: entry.actorId,
    visibility: entry.visibility ?? 'all',
    details: entry.details ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}
