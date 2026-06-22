import type { RequestFormValues } from './types'

// localStorage key for draft persistence (#93)
export const DRAFT_KEY = 'rq_draft_v1'

// sessionStorage key for the post-submit "save to profile" offer (#67).
// The submit redirect unmounts this page in the same tick, so any in-form
// offer could never render; instead the submitted personal fields are
// stashed here and MyRequestsPage shows the offer (and clears the stash on
// save or dismiss, so the details do not outlive the offer).
export const SAVE_PROFILE_OFFER_KEY = 'pff:saveProfileOffer'

export function loadDraft() {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage?.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveDraft(values: RequestFormValues) {
  try { window.localStorage?.setItem(DRAFT_KEY, JSON.stringify(values)) } catch { /* noop */ }
}

export function clearDraft() {
  try { window.localStorage?.removeItem(DRAFT_KEY) } catch { /* noop */ }
}
