/**
 * Audit log helper.
 *
 * Used by:
 *  - UC-05 (Admin Approval): every approve / reject / needs-changes action.
 *  - UC-01 (Submit Request): on request creation and on every status transition.
 *
 * Mitigates wiki Risk #2 (Edit-Everything Site Breakage) by giving us a full
 * trail of writes for incident review and rollback.
 *
 * Each entry maps to the `auditLogs` Firestore collection in the class diagram.
 */
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/lib/firebaseAdmin';

export interface AuditEntry {
  actorId: string;            // uid of the user performing the action
  action: string;             // e.g. "approve_business", "submit_request", "transition_status"
  entityType: string;         // e.g. "businesses", "requests"
  entityId: string;           // id of the affected document
  details?: Record<string, unknown>; // optional extra context (before/after values, notes)
}

export async function writeAuditLog(entry: AuditEntry): Promise<string> {
  const ref = await db().collection('auditLogs').add({
    ...entry,
    timestamp: FieldValue.serverTimestamp(),
  });
  return ref.id;
}
