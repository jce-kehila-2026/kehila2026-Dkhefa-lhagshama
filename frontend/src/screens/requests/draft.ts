// browser-storage helpers for the "submit a request" form (UC-01).
// owns two client-side persistence concerns: (1) auto-saving the in-progress
// request form so a refresh/navigation does not lose the user's input, and
// (2) handing off the just-submitted personal fields to MyRequestsPage so it
// can offer "save to profile" after the submit redirect unmounts this form.
// used by the request-form screen (read/save/clear draft) and MyRequestsPage
// (reads SAVE_PROFILE_OFFER_KEY). all access is SSR/quota safe (guarded +
// try/catch), so callers never crash on a missing window or a full disk.
import type { RequestFormValues } from './types'

// localStorage key for draft persistence (#93)
export const DRAFT_KEY = 'rq_draft_v1'

// sessionStorage key for the post-submit "save to profile" offer (#67).
// The submit redirect unmounts this page in the same tick, so any in-form
// offer could never render; instead the submitted personal fields are
// stashed here and MyRequestsPage shows the offer (and clears the stash on
// save or dismiss, so the details do not outlive the offer).
export const SAVE_PROFILE_OFFER_KEY = 'pff:saveProfileOffer'

// returns the saved draft (untyped JSON) or null. window guard keeps it
// SSR-safe; any read/parse failure (no storage, corrupt JSON) falls back to null.
export function loadDraft() {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage?.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// best-effort persist of the current form values; swallows quota/access errors.
export function saveDraft(values: RequestFormValues) {
  try { window.localStorage?.setItem(DRAFT_KEY, JSON.stringify(values)) } catch { /* noop */ }
}

// drops the saved draft (call after a successful submit or explicit discard).
export function clearDraft() {
  try { window.localStorage?.removeItem(DRAFT_KEY) } catch { /* noop */ }
}
