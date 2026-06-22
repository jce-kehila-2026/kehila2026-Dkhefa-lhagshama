import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useRouter } from 'next/router'
const useNavigate = () => {
  const router = useRouter()
  return (to: string) => router.push(to)
}

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import { sendEmailVerification } from 'firebase/auth' // #86
import { firebaseAuth } from '../lib/firebase' // #86
import { useForm } from '../hooks/useForm'
import { useCategories } from '../hooks/useCategories'
import { validateStep1, validateStep2, validateStep3, validateStep4 } from '../utils/validators'
import { apiFetch, apiJson } from '../lib/apiClient'
import type { Suggestion } from '@/types'
import type { RequestFormValues } from './requests/types'
import Step1Personal from './requests/Step1Personal'
import Step2RequestType from './requests/Step2RequestType'
import Step3Documents from './requests/Step3Documents'
import Step4Summary from './requests/Step4Summary'
import AdminNotice from './requests/AdminNotice'
import RequestFormShell from './requests/RequestFormShell'
import { SAVE_PROFILE_OFFER_KEY, loadDraft, saveDraft, clearDraft } from './requests/draft'

// ── Component ─────────────────────────────────────────────────
export default function RequestsPage() {
  const { t, isRTL, lang } = useLanguage()
  const { toast } = useApp()
  const { user, role, loading: authLoading } = useAuth()
  // Admin-managed taxonomy: tile list + bilingual label resolution.
  const { categories, loading: catsLoading, labelFor, refresh: refreshCats } = useCategories()
  const navigate = useNavigate()
  const router = useRouter()
  const BackArrow  = isRTL ? ArrowRight : ArrowLeft
  const NextArrow  = isRTL ? ArrowLeft  : ArrowRight

  // #86 — track email verification state so we can show a banner
  const emailVerified = user?.emailVerified ?? false
  const [resendSent, setResendSent] = useState(false)

  const handleResendVerification = async () => {
    const fbUser = firebaseAuth.currentUser
    if (!fbUser) return
    try {
      await sendEmailVerification(fbUser)
      setResendSent(true)
    } catch {
      // swallow — the toast system is not critical here
    }
  }

  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [idUploaded, setIdUploaded] = useState(false)
  const [idPath, setIdPath] = useState('')
  const [supportPath, setSupportPath] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // #67 — profile prefill state
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  // Canonical profile values as last loaded from the server — compared after
  // submit to decide whether the save-to-profile offer is worth stashing.
  const profileSnapshot = useRef<{
    firstName: string; lastName: string; phone: string;
    city: string; age: string; gender: string;
  } | null>(null)

  // Client-generated UUID — stable per form session (#93 + upload path prefix)
  const requestId = useMemo(() => {
    if (typeof window === 'undefined' || !window.crypto?.randomUUID) return null
    return window.crypto.randomUUID()
  }, [])

  const toCanonicalGender = useCallback((g: string) => {
    const GENDER_MAP: Record<string, string> = { M: 'male', F: 'female', O: 'other', '': '' }
    return GENDER_MAP[g] ?? ''
  }, [])

  const rq = t.request
  const s2 = t.stream2
  const steps = [rq.steps.personal, rq.steps.type, rq.steps.documents, rq.steps.confirm]

  // ── Form state (#93 draft) ────────────────────────────────────
  const draft = loadDraft()
  const { values, errors, handleChange, setValue, setFieldErrors } = useForm({
    firstName:'', lastName:'',
    idType: 'israeli_id', idNumber:'', idNote:'',
    phone:'', email:'',
    city:'', age:'', gender:'',
    category:'', description:'', urgency:'low',
    deadline: '',
    preferredLanguage: '',
    consent: false,
    ...(draft || {}),
  }) as unknown as {
    values: RequestFormValues
    errors: Record<string, string>
    handleChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
    setValue: (name: string, value: string | boolean) => void
    setFieldErrors: (errs: Record<string, string>) => void
  }

  // Show draft-restored toast once on mount if we had a draft
  const [draftRestored] = useState(() => !!draft)
  useEffect(() => {
    if (draftRestored) {
      toast(s2.draftRestored, 'info')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist draft to localStorage on every values change (#93)
  useEffect(() => {
    if (!submitted) saveDraft(values)
  }, [values, submitted])

  // Matching organizations (feedback round 2) — once a category is chosen in
  // step 2, fetch up to 3 approved community answers in that category from the
  // public suggestions endpoint and offer them inline under the tiles. Silent
  // on error or when empty. Keyed on `values.category` (not the click handler)
  // so a category restored from the draft on mount also triggers the fetch.
  // Dismissal is local and resets whenever the category changes.
  const [orgSuggestions, setOrgSuggestions] = useState<Suggestion[]>([])
  const [orgSuggestionsDismissed, setOrgSuggestionsDismissed] = useState(false)
  useEffect(() => {
    setOrgSuggestionsDismissed(false)
    if (!values.category) {
      setOrgSuggestions([])
      return
    }
    let alive = true
    apiJson<{ items?: Suggestion[] }>(`/api/suggestions?category=${encodeURIComponent(values.category)}`)
      .then((data) => { if (alive) setOrgSuggestions(Array.isArray(data.items) ? data.items : []) })
      .catch(() => { if (alive) setOrgSuggestions([]) })
    return () => { alive = false }
  }, [values.category])

  // Auth guard — redirect to login if not signed in (#93 — next= so draft is kept)
  // Grace window before redirecting on (authLoading=false, user=null): Firebase
  // can briefly emit a null user during a token refresh before re-emitting the
  // signed-in user, and redirecting on that transient null tore the beneficiary
  // out of the form mid step-transition. The draft is saved first either way so
  // nothing is lost; the timer is cancelled the moment the user reappears.
  useEffect(() => {
    if (!authLoading && !user) {
      saveDraft(values) // save before (possible) redirect so it's restored on return
      const handle = setTimeout(() => {
        router.replace(`/login?next=${encodeURIComponent('/requests')}`)
      }, 600)
      return () => clearTimeout(handle)
    }
  }, [authLoading, user, router, values])

  // A restored draft may carry a category an admin has since archived or
  // deleted. Once the taxonomy arrives, clear any value that is not an active
  // id so step-2 validation forces a re-pick — otherwise the stale id sails
  // through to submit, where the backend rejects it with a 400 the generic
  // toast cannot explain. (Skipped when the fetch failed: categories === [].)
  useEffect(() => {
    if (catsLoading || categories.length === 0) return
    if (values.category && !categories.some((c) => c.id === values.category)) {
      setValue('category', '')
    }
  }, [catsLoading, categories, values.category, setValue])

  // #67 — core profile loader. `announce` controls whether we surface a toast
  // (true for the explicit "auto-fill" button, false for the silent mount fill).
  // Note: this intentionally does NOT early-return on `profileLoaded` so the
  // button keeps working even after the silent mount fill already ran.
  const loadProfileInto = useCallback(async (announce: boolean) => {
    if (profileLoading || !user) return
    setProfileLoading(true)
    try {
      const data = await apiJson('/api/users/me') as {
        profile?: {
          firstName?: string; lastName?: string; phone?: string; city?: string;
          age?: string | number; gender?: string; email?: string;
        }
      }
      const p = data.profile || {}
      profileSnapshot.current = {
        firstName: p.firstName || '',
        lastName:  p.lastName  || '',
        phone:     p.phone     || '',
        city:      p.city      || '',
        age:       p.age ? String(p.age) : '',
        gender:    p.gender    || '',
      }
      let filledAny = false
      if (p.firstName)   { setValue('firstName', p.firstName); filledAny = true }
      if (p.lastName)    { setValue('lastName',  p.lastName);  filledAny = true }
      if (p.phone)       { setValue('phone',     p.phone);     filledAny = true }
      if (p.city)        { setValue('city',      p.city);      filledAny = true }
      if (p.age)         { setValue('age',       String(p.age)); filledAny = true }
      if (p.gender) {
        // Canonical gender from DB (male/female/other) → UI code (M/F/O)
        const reverseMap: Record<string, string> = { male:'M', female:'F', other:'O' }
        setValue('gender', reverseMap[p.gender] || '')
        filledAny = true
      }
      // Email is editable but prefill from auth or profile
      const emailSrc = p.email || user.email || ''
      if (emailSrc) { setValue('email', emailSrc); filledAny = true }
      setProfileLoaded(true)
      if (announce) {
        toast(filledAny ? s2.autoFill.filled : s2.autoFill.nothing, filledAny ? 'success' : 'info')
      }
    } catch {
      // Profile fetch failure is non-fatal; the user can fill manually
      if (announce) toast(s2.autoFill.fillError, 'error')
    } finally {
      setProfileLoading(false)
    }
  }, [profileLoading, user, setValue, toast, s2.autoFill])

  // Explicit "auto-fill from my profile" button handler (#67) — always runs.
  const fillFromProfile = useCallback(() => loadProfileInto(true), [loadProfileInto])

  // Silent auto-fill on mount (after auth resolves)
  useEffect(() => {
    if (user && !profileLoaded && !draft) {
      loadProfileInto(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ── Validation / navigation ─────────────────────────────────
  const goNext = () => {
    let errs: Record<string, string> = {}
    // The validators live in JS, so TS infers concrete (index-signature-free)
    // return shapes; assert to the `Record<string, string>` `setFieldErrors`
    // expects. Values are already validation message strings.
    if (step === 1) errs = validateStep1(values, t) as unknown as Record<string, string>
    if (step === 2) errs = validateStep2(values, t) as unknown as Record<string, string>
    if (step === 3) errs = validateStep3({ idUploaded }, t) as unknown as Record<string, string>
    if (step === 4) errs = validateStep4(values, t) as unknown as Record<string, string>

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      // a11y: move focus to the first invalid control so screen-reader and
      // keyboard users land on the problem (presentation-only; does not change
      // what is validated or submitted).
      if (typeof document !== 'undefined') {
        const firstKey = Object.keys(errs)[0]
        requestAnimationFrame(() => {
          const target = document.getElementById(firstKey)
            || document.querySelector<HTMLElement>(`[name="${firstKey}"]`)
            || document.querySelector<HTMLElement>('[aria-invalid="true"]')
          target?.focus?.()
        })
      }
      return
    }
    if (step < 4) setStep(s => s + 1)
    else submitForm()
  }

  // ── Submit ────────────────────────────────────────────────────
  const submitForm = async () => {
    if (submitting || !requestId) return
    setSubmitting(true)
    try {
      const payload = {
        requestId,
        firstName: values.firstName,
        lastName:  values.lastName,
        idType:    values.idType || 'israeli_id',
        idNumber:  values.idNumber,
        idNote:    values.idNote || '',
        phone:     values.phone,
        email:     values.email,
        city:      values.city,
        age:       Number(values.age) || 0,
        gender:    toCanonicalGender(values.gender),
        category:  values.category,
        description: values.description,
        urgency:   values.urgency,
        consent:   true,
        deadline:  values.deadline || undefined,
        preferredLanguage: values.preferredLanguage || null,
        attachmentPaths: [idPath, supportPath].filter(Boolean),
        onBehalf:  role === 'volunteer',
      }
      const res = await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let body: { fieldErrors?: Record<string, unknown> } | null = null
        try { body = await res.json() } catch { /* noop */ }
        // #93 — 401 on submit → save draft + prompt re-login
        if (res.status === 401) {
          saveDraft(values)
          toast(s2.reloginPrompt, 'warning')
          router.push(`/login?next=${encodeURIComponent('/requests')}`)
          return
        }
        // Backend category validation (a draft-restored category can be
        // archived between save and submit) — send the user back to step 2
        // with a field error instead of a dead-end generic toast.
        if (res.status === 400 && body?.fieldErrors?.category) {
          setFieldErrors({ category: rq.step2.catsInvalid })
          setValue('category', '')
          setStep(2)
          return
        }
        throw new Error(`submit_failed: ${res.status} ${body ? JSON.stringify(body) : ''}`)
      }
      const body = await res.json()
      const newId = body.requestId || requestId
      clearDraft()
      setSubmitted(true)
      // #67 — stash the submitted personal fields so MyRequestsPage can offer
      // to save them to the profile (the redirect below unmounts this page in
      // the same tick, so no in-form offer can render). Stashed only when the
      // fields differ from the profile we loaded; cleared there on save or
      // dismiss to keep the details from outliving the offer.
      const offered = {
        firstName: values.firstName,
        lastName:  values.lastName,
        phone:     values.phone,
        city:      values.city,
        age:       values.age,
        gender:    toCanonicalGender(values.gender),
      }
      const snap = profileSnapshot.current
      const differs = !snap || (Object.keys(offered) as (keyof typeof offered)[])
        .some((k) => (offered[k] || '') !== (snap[k] || ''))
      if (differs) {
        // uid-bound: MyRequestsPage discards a stash written by another
        // account, so a previous user's PII can never surface after a switch.
        const stash = { uid: user?.uid ?? '', ...offered }
        try { window.sessionStorage?.setItem(SAVE_PROFILE_OFFER_KEY, JSON.stringify(stash)) } catch { /* noop */ }
      } else {
        // Nothing to offer — also drop any stale stash from an earlier
        // session/user instead of leaving it to resurface on /my-requests.
        try { window.sessionStorage?.removeItem(SAVE_PROFILE_OFFER_KEY) } catch { /* noop */ }
      }
      // #94 — replace route so back-button doesn't re-open the form
      router.replace(`/my-requests?new=${newId}`)
    } catch (err) {

      console.error('[RequestsPage] submit failed:', err)
      toast(lang === 'he' ? 'שליחת הבקשה נכשלה' : 'Submit failed — please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Auth / role gates ─────────────────────────────────────────
  if (authLoading || !user) {
    return (
      <div className="page-container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--gray-500)' }}>{t.common.loading}</div>
      </div>
    )
  }

  // #90 — Admin notice: block admins from submitting
  if (role === 'admin') {
    return <AdminNotice navigate={navigate} />
  }

  return (
    <RequestFormShell
      step={step}
      steps={steps}
      role={role}
      emailVerified={emailVerified}
      resendSent={resendSent}
      handleResendVerification={handleResendVerification}
      submitting={submitting}
      setStep={setStep}
      goNext={goNext}
      BackArrow={BackArrow}
      NextArrow={NextArrow}
    >
        {/* STEP 1 — PERSONAL DETAILS */}
        {step === 1 && (
          <Step1Personal
            role={role}
            values={values}
            errors={errors}
            handleChange={handleChange}
            profileLoading={profileLoading}
            fillFromProfile={fillFromProfile}
          />
        )}

        {/* STEP 2 — REQUEST TYPE */}
        {step === 2 && (
          <Step2RequestType
            values={values}
            errors={errors}
            handleChange={handleChange}
            setValue={setValue}
            catsLoading={catsLoading}
            categories={categories}
            labelFor={labelFor}
            refreshCats={refreshCats}
            orgSuggestions={orgSuggestions}
            orgSuggestionsDismissed={orgSuggestionsDismissed}
            setOrgSuggestionsDismissed={setOrgSuggestionsDismissed}
            navigate={navigate}
            NextArrow={NextArrow}
          />
        )}

        {/* STEP 3 — DOCUMENTS */}
        {step === 3 && (
          <Step3Documents
            errors={errors}
            requestId={requestId}
            setIdUploaded={setIdUploaded}
            setIdPath={setIdPath}
            setSupportPath={setSupportPath}
          />
        )}

        {/* STEP 4 — SUMMARY + CONSENT */}
        {step === 4 && (
          <Step4Summary
            values={values}
            errors={errors}
            handleChange={handleChange}
            labelFor={labelFor}
          />
        )}
    </RequestFormShell>
  )
}
