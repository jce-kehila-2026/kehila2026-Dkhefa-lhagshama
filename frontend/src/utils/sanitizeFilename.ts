/**
 * sanitizeFilename — client-side filename sanitizer (#96).
 *
 * Strips non-ASCII and unsafe path characters, prepends a short random hex
 * prefix so two files with the same name do not collide in Storage.
 *
 * The server-side counterpart lives in backend/src/lib/sanitizeFilename.ts
 * and uses the same algorithm; keep them in sync if the logic changes.
 *
 * @param name  Original filename (e.g. "מסמך חשוב.pdf")
 * @returns     A safe ASCII filename (e.g. "a3f8_msmk_chshv.pdf")
 */
export function sanitizeFilename(name: string): string {
  // Split off extension (last dot-segment) before cleaning.
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext  = lastDot > 0 ? name.slice(lastDot)    : '';

  // Transliterate / strip: keep ASCII alphanumeric + dash + underscore.
  // Non-ASCII characters (Hebrew, accented Latin, etc.) are replaced with '_'.
  const clean = base
    .replace(/[^a-zA-Z0-9._-]+/g, '_')   // keep safe chars
    .replace(/^_+|_+$/g, '')              // trim leading/trailing underscores
    .slice(0, 60) || 'file';             // cap length; fallback if blank

  // 4-byte hex prefix for collision avoidance.
  const prefix = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');

  return `${prefix}_${clean}${ext}`;
}
