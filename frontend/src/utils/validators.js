// ─────────────────────────────────────────────────────────────
//  VALIDATORS
// ─────────────────────────────────────────────────────────────

export const isRequired = (val) => val && val.toString().trim().length > 0

export const isValidIsraeliId = (id) => {
  const clean = id.replace(/\D/g, '')
  if (clean.length !== 9) return false
  const sum = clean.split('').reduce((acc, digit, i) => {
    let n = parseInt(digit) * ((i % 2) + 1)
    if (n > 9) n -= 9
    return acc + n
  }, 0)
  return sum % 10 === 0
}

export const isValidPhone = (phone) =>
  /^0(5[012345689]|[2-4679])\d{7}$/.test(phone.replace(/[-\s]/g, ''))

export const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export const isValidAge = (age) => {
  const n = parseInt(age)
  return !isNaN(n) && n >= 1 && n <= 120
}

// ── STEP VALIDATORS ──────────────────────────────────────────

export const validateStep1 = (data, t) => {
  const errors = {}
  if (!isRequired(data.firstName)) errors.firstName = t.request.validation.required
  if (!isRequired(data.lastName))  errors.lastName  = t.request.validation.required
  if (!isRequired(data.idNumber))  errors.idNumber  = t.request.validation.required
  else if (!isValidIsraeliId(data.idNumber)) errors.idNumber = t.request.validation.invalidId
  if (!isRequired(data.phone))     errors.phone     = t.request.validation.required
  else if (!isValidPhone(data.phone)) errors.phone  = t.request.validation.invalidPhone
  if (!isRequired(data.email))     errors.email     = t.request.validation.required
  else if (!isValidEmail(data.email)) errors.email  = t.request.validation.invalidEmail
  if (!isRequired(data.city))      errors.city      = t.request.validation.selectCity
  return errors
}

export const validateStep2 = (data, t) => {
  const errors = {}
  if (!isRequired(data.category))    errors.category    = t.request.validation.selectCat
  if (!isRequired(data.description)) errors.description = t.request.validation.needDesc
  return errors
}

export const validateStep3 = (data, t) => {
  const errors = {}
  if (!data.idUploaded) errors.idDoc = t.request.validation.needId
  return errors
}

export const validateStep4 = (data, t) => {
  const errors = {}
  if (!data.consent) errors.consent = t.request.validation.needConsent
  return errors
}