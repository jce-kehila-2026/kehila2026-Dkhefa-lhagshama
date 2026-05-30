/**
 * sanitizeFilename — server-side filename sanitizer (#96).
 *
 * Strips non-ASCII and unsafe path characters, prepends a short random hex
 * prefix so two files with the same name do not collide in Storage.
 *
 * The client-side counterpart lives in frontend/src/utils/sanitizeFilename.ts
 * and uses the same algorithm; keep them in sync if the logic changes.
 *
 * @param name  Original filename (e.g. "מסמך חשוב.pdf" or any raw upload name)
 * @returns     A safe ASCII filename (e.g. "a3f8_file.pdf")
 */
import { randomBytes } from 'node:crypto';

export function sanitizeFilename(name: string): string {
  // Split off extension (last dot-segment) before cleaning.
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext  = lastDot > 0 ? name.slice(lastDot)    : '';

  // Keep ASCII alphanumeric + dash + underscore; replace everything else.
  const clean = base
    .replace(/[^a-zA-Z0-9._-]+/g, '_')   // keep safe chars
    .replace(/^_+|_+$/g, '')              // trim leading/trailing underscores
    .slice(0, 60) || 'file';             // cap length; fallback if blank

  // 4-byte hex prefix for collision avoidance (crypto-quality randomness).
  const prefix = randomBytes(2).toString('hex'); // e.g. "a3f8"

  return `${prefix}_${clean}${ext}`;
}
