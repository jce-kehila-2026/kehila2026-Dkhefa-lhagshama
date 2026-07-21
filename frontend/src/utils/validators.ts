// ─────────────────────────────────────────────────────────────
//  VALIDATORS
// ─────────────────────────────────────────────────────────────

export const isRequired = (val: unknown): boolean =>
  !!val && val.toString().trim().length > 0

/** Nine digits, all identical: "000000000", "111111111", ... */
const ALL_SAME_DIGIT = /^(\d)\1{8}$/

/**
 * Israeli national ID (תעודת זהות) check. Luhn-style: double every second
 * digit, subtract 9 above 9, total must divide by 10.
 *
 * That algorithm alone accepts "000000000" — a sum of 0 divides by 10 — which
 * was also this field's placeholder, so a row of zeros passed as a real
 * identity number. Single-repeated-digit strings are rejected explicitly.
 *
 * Mirrors backend/src/lib/israeliId.ts, which is the authoritative copy and
 * the one that actually gates a submission; this exists for instant feedback.
 * Keep the two in step.
 */
export const isValidIsraeliId = (id: string): boolean => {
  const raw = (id ?? '').trim()
  if (!raw) return false
  // Digits and separators only, so "12345678a" cannot pass by having its
  // letters stripped away.
  if (!/^[\d\s-]+$/.test(raw)) return false

  const clean = raw.replace(/\D/g, '')
  // Exactly 9 — a short number is never zero-padded, since padding would turn
  // a typo into a different valid person's ID.
  if (clean.length !== 9) return false
  if (ALL_SAME_DIGIT.test(clean)) return false

  const sum = clean.split('').reduce((acc, digit, i) => {
    let n = parseInt(digit, 10) * ((i % 2) + 1)
    if (n > 9) n -= 9
    return acc + n
  }, 0)
  return sum % 10 === 0
}

export const isValidPhone = (phone: string): boolean =>
  /^0(5[012345689]|[2-4679])\d{7}$/.test(phone.replace(/[-\s]/g, ''))

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

// ── STEP VALIDATORS ──────────────────────────────────────────

interface StepData {
  firstName?: string
  lastName?: string
  idType?: string
  idNumber?: string
  phone?: string
  email?: string
  city?: string
  cityCode?: string
  category?: string
  description?: string
  consent?: boolean
}

interface ValidationT {
  request: { validation: Record<string, string> }
}

export const validateStep1 = (data: StepData, t: ValidationT): Record<string, string> => {
  const errors: Record<string, string> = {}
  if (!isRequired(data.firstName)) errors.firstName = t.request.validation.required
  if (!isRequired(data.lastName))  errors.lastName  = t.request.validation.required

  const idType = data.idType || 'israeli_id'
  if (idType === 'israeli_id') {
    if (!isRequired(data.idNumber))                  errors.idNumber = t.request.validation.required
    else if (!isValidIsraeliId(data.idNumber || '')) errors.idNumber = t.request.validation.invalidId
  }

  if (!isRequired(data.phone))                  errors.phone = t.request.validation.required
  else if (!isValidPhone(data.phone || ''))     errors.phone = t.request.validation.invalidPhone
  if (!isRequired(data.email))                  errors.email = t.request.validation.required
  else if (!isValidEmail(data.email || ''))     errors.email = t.request.validation.invalidEmail
  // Validate the CODE, not the display name: only a real pick from the official
  // list sets it, so this rejects a locality the picker never resolved.
  if (!isRequired(data.cityCode))               errors.city  = t.request.validation.selectCity
  return errors
}

export const validateStep2 = (data: StepData, t: ValidationT): Record<string, string> => {
  const errors: Record<string, string> = {}
  if (!isRequired(data.category))    errors.category    = t.request.validation.selectCat
  if (!isRequired(data.description)) errors.description = t.request.validation.needDesc
  return errors
}

// Step 3 (documents) has no validator: both uploads there are optional, so a
// beneficiary without an ID document can still submit a request.

export const validateStep4 = (data: StepData, t: ValidationT): Record<string, string> => {
  const errors: Record<string, string> = {}
  if (!data.consent) errors.consent = t.request.validation.needConsent
  return errors
}
