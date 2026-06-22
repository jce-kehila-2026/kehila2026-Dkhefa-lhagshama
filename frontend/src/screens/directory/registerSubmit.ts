import { apiJson } from '../../lib/apiClient'
import type { TNode } from '@/types'
import type { NoticeState } from './constants'

type RegisterForm = {
  business_name: string
  owner_name: string
  phone: string
  category: string
  city: string
  desc: string
  website: string
}

type SubmitDeps = {
  d: TNode
  registerForm: RegisterForm
  setNotice: (n: NoticeState) => void
  setRegisterSubmitting: (v: boolean) => void
  setShowRegForm: (v: boolean) => void
  setRegisterForm: (v: RegisterForm) => void
  router: { push: (path: string) => void }
}

export function makeHandleRegisterSubmit({
  d,
  registerForm,
  setNotice,
  setRegisterSubmitting,
  setShowRegForm,
  setRegisterForm,
  router,
}: SubmitDeps) {
  return async () => {
    const trimmed = {
      name: registerForm.business_name.trim(),
      ownerName: registerForm.owner_name.trim(),
      phone: registerForm.phone.trim(),
      category: registerForm.category,
      city: registerForm.city.trim(),
      description: registerForm.desc.trim(),
      // Optional: only sent when the owner provided a website. Validated below.
      website: registerForm.website.trim(),
    }

    if (!trimmed.name || !trimmed.ownerName || !trimmed.phone || !trimmed.city || !trimmed.description) {
      setNotice({ message: d.fillRequired, variant: 'danger' })
      return
    }

    // The backend (Zod) requires a description of at least 10 characters.
    // Validate here so the user gets a precise message instead of a generic 400.
    if (trimmed.description.length < 10) {
      setNotice({ message: d.descTooShort, variant: 'danger' })
      return
    }

    // Website is optional; when present it must be a valid URL (mirrors the
    // backend's optional-URL rule, so the user gets a precise message).
    if (trimmed.website) {
      try {
        new URL(trimmed.website)
      } catch {
        setNotice({ message: d.invalidWebsite, variant: 'danger' })
        return
      }
    }

    setRegisterSubmitting(true)
    try {
      await apiJson('/api/businesses', {
        method: 'POST',
        body: JSON.stringify(trimmed),
      })
      // Reset + close the form, then surface a branded success notice.
      setShowRegForm(false)
      setRegisterForm({ business_name: '', owner_name: '', phone: '', category: 'food', city: '', desc: '', website: '' })
      setNotice({ message: d.submitSuccess })
    } catch (rawErr) {
      // Surface the real backend error so failures are diagnosable instead of a
      // blanket "try again later". apiJson throws { status, error, detail }.
      console.error('[DirectoryPage] register business failed:', rawErr)
      const err = rawErr as {
        status?: number
        error?: string
        detail?: string | { error?: string; fieldErrors?: Record<string, string | string[]> }
      }
      // 401 means no signed-in user — registering a business requires login so
      // the submission can be tied to an owner (firestore rules key off ownerId).
      // Make the notice actionable: a "Sign in" button routes to login with a
      // next= back to /directory so the user can authenticate and return,
      // instead of dead-ending on an OK-only message with no path forward.
      if (err?.status === 401) {
        setNotice({
          message: d.loginRequired,
          variant: 'danger',
          action: {
            confirmLabel: d.signIn,
            onConfirm: () => router.push(`/login?next=${encodeURIComponent('/directory')}`),
          },
        })
        setRegisterSubmitting(false)
        return
      }
      const fieldErrors = typeof err?.detail === 'object' ? err.detail?.fieldErrors : undefined
      let detailMsg = ''
      if (fieldErrors && typeof fieldErrors === 'object') {
        detailMsg = Object.entries(fieldErrors)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join('\n')
      } else if (typeof err?.detail === 'string') {
        detailMsg = err.detail
      } else if (typeof err?.detail === 'object' && err.detail?.error) {
        detailMsg = err.detail.error
      } else if (err?.error) {
        detailMsg = err.error
      }
      const base = d.submitError
      setNotice({ message: detailMsg ? `${base}\n${detailMsg}` : base, variant: 'danger' })
    } finally {
      setRegisterSubmitting(false)
    }
  }
}
