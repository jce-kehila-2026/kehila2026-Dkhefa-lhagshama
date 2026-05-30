/**
 * validateRedirect (#88) — open-redirect protection.
 *
 * Only allows same-origin relative paths that start with `/`.
 * Rejects anything with a protocol (`http:`, `https:`, `//`, etc.),
 * which would redirect to an external host.
 *
 * @param next   - The raw `next` query-param value (may be anything).
 * @param fallback - The safe default path to use when `next` is invalid.
 * @returns      A safe, same-origin relative path.
 *
 * Examples:
 *   validateRedirect('/requests', '/')  => '/requests'  ✓
 *   validateRedirect('//evil.com', '/') => '/'           ✗ blocked
 *   validateRedirect('https://evil.com/steal', '/') => '/' ✗ blocked
 *   validateRedirect(undefined, '/')    => '/'           fallback
 */
export function validateRedirect(next: unknown, fallback = '/'): string {
  if (typeof next !== 'string' || next.trim() === '') return fallback;

  const trimmed = next.trim();

  // Must start with exactly one `/` and must NOT start with `//`
  // (protocol-relative URL that could point off-origin).
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;

  // Belt-and-suspenders: reject anything that contains a colon before the
  // first slash — covers `javascript:`, `data:`, `vbscript:`, etc.
  const colonIdx = trimmed.indexOf(':');
  const firstSlash = trimmed.indexOf('/');
  if (colonIdx !== -1 && colonIdx < firstSlash) return fallback;

  return trimmed;
}
