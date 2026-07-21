/**
 * israeliId.ts — validation for the Israeli national ID number (תעודת זהות).
 *
 * The official check is Luhn-style: pad to 9 digits, double every second
 * digit, subtract 9 from any result above 9, and the total must be divisible
 * by 10. That algorithm alone accepts "000000000" — a sum of 0 is divisible by
 * 10 — so a field of zeros, which is also what the form used to show as its
 * placeholder, sailed through as a valid identity number. Every
 * single-repeated-digit string is therefore rejected explicitly.
 *
 * This lives server-side because validation that exists only in the browser is
 * not validation: a direct POST to /api/requests bypassed it entirely, and the
 * request schema previously did nothing more than check the field was
 * non-empty. The frontend keeps its own copy for instant feedback
 * (frontend/src/utils/validators.ts) — the two must stay in step, and this is
 * the authoritative one.
 */

/** Nine digits, all identical: "000000000", "111111111", ... */
const ALL_SAME_DIGIT = /^(\d)\1{8}$/;

/**
 * Is this a structurally valid Israeli ID number?
 *
 * Accepts the digits with or without separators, but requires exactly 9 digits
 * once cleaned — an 8-digit number is NOT silently zero-padded, because
 * padding would turn a typo into a different valid person's number.
 */
export function isValidIsraeliId(value: string | null | undefined): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;

  // Reject anything that is not digits + common separators, so "12345678a"
  // cannot pass by having its letters stripped away.
  if (!/^[\d\s-]+$/.test(raw)) return false;

  const clean = raw.replace(/\D/g, '');
  if (clean.length !== 9) return false;
  if (ALL_SAME_DIGIT.test(clean)) return false;

  const sum = clean.split('').reduce((acc, digit, i) => {
    let n = Number(digit) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    return acc + n;
  }, 0);

  return sum % 10 === 0;
}

/**
 * Complete an 8-digit prefix into a checksum-valid 9-digit ID by computing the
 * final digit. Used to generate demo/seed identities that the app would
 * actually accept, so the seeded data is consistent with the rule the form
 * enforces. Not for production identities — it invents numbers.
 */
export function completeIsraeliId(prefix8: string): string {
  const clean = String(prefix8).replace(/\D/g, '').slice(0, 8).padStart(8, '0');

  // Sum the 8 known digits under the same weighting, then pick the check digit
  // that brings the total to the next multiple of 10.
  const sum = clean.split('').reduce((acc, digit, i) => {
    let n = Number(digit) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    return acc + n;
  }, 0);

  // The 9th digit sits at index 8 (even) so its weight is 1 — no doubling.
  const check = (10 - (sum % 10)) % 10;
  const candidate = `${clean}${check}`;

  // Guard the one degenerate output: an all-zero prefix completes to
  // "000000000", which this module rejects. Nudge it to a usable number.
  return ALL_SAME_DIGIT.test(candidate) ? completeIsraeliId('00000001') : candidate;
}
