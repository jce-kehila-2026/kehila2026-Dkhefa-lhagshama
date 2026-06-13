import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { CSSProperties, ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Search, Star, Phone, Mail, MapPin, Store, HeartHandshake, Handshake, ArrowRight, ArrowLeft, Plus, X, AlertTriangle, Globe, LayoutGrid, Utensils, Wrench, HeartPulse, GraduationCap, Sparkles, Laptop, Briefcase, Scale, Users, Home } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRouter } from 'next/router'
import Pagination from '@/components/data-display/Pagination'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import { useApp } from '@/contexts/AppContext'
import Reveal from '../components/motion/Reveal'
import { useLanguage } from '../contexts/LanguageContext'
import { useCategories } from '../hooks/useCategories'
import { apiJson } from '../lib/apiClient'
import { safeHref } from '../lib/safeUrl'
import type { CaughtError, TNode, Lang } from '@/types'

const PER_PAGE = 6

// Directory tabs: businesses, then the two organization types. 'ngo'
// (עמותות) and 'partner' (שותפים) both render the answers catalog, scoped by
// the server-side ?orgType= filter.
const TAB_ORDER = ['business', 'ngo', 'partner']

// Lucide icon per business category / NGO area. `all` uses a neutral grid.
// Shared by the filter chips and the business-card banners.
const BIZ_CAT_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  food: Utensils,
  services: Wrench,
  health: HeartPulse,
  education: GraduationCap,
  beauty: Sparkles,
  tech: Laptop,
}

const NGO_AREA_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  education: GraduationCap,
  employment: Briefcase,
  legal: Scale,
  social: Users,
  housing: Home,
  health: HeartPulse,
  welfare: HeartHandshake,
  community: Users,
  youth: Sparkles,
  absorption: Globe,
}

// Browser autofill hints for the registration form. Presentation metadata
// only — lets the browser pre-fill name / phone / city sensibly.
const REG_AUTOCOMPLETE: Record<string, string> = {
  business_name: 'organization',
  owner_name: 'name',
  phone: 'tel',
  city: 'address-level2',
  desc: 'off',
  category: 'off',
}

// The language context is exported with a precise per-key shape, but this page
// indexes the table dynamically (and reads HE-only keys), so consume it through
// the intentionally-loose `TNode` view. `t` is the bilingual translation table.
type LangCtx = { t: TNode; lang: Lang; isRTL: boolean }

// A translatable field arrives either as a plain string or a `{ he, en }` /
// `{ he: string[], en: string[] }` bilingual object.
type Bilingual = string | { he?: TNode | string[]; en?: TNode | string[]; [k: string]: TNode | string[] | undefined } | null | undefined

// API record shapes are loose (server returns dynamic JSON); narrow at use-site.
type DirRecord = Record<string, TNode>
// A notice may optionally be ACTIONABLE: when `action` is set the dialog shows
// a primary button (e.g. "Sign in") that runs `action.onConfirm`, plus a
// Cancel. Plain notices stay single-button (OK).
type NoticeState = {
  message?: string
  variant?: 'danger' | string
  action?: { confirmLabel: string; onConfirm: () => void }
} | null

export default function DirectoryPage() {
  const { t, lang, isRTL } = useLanguage() as unknown as LangCtx
  const { openModal, closeModal } = useApp()
  const router = useRouter()
  const d = t.directory
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight
  // Admin-managed request/answers taxonomy: drives the NGO-area filter chips
  // + their labels. Business categories stay a separate static enum.
  const { categories: ngoCategories, labelFor: catLabel } = useCategories()

  // ── BILINGUAL FIELD HELPERS ───────────────────────────────────
  // Translatable fields arrive from the API as `{ he, en }` objects. These
  // helpers render the active language and degrade gracefully for plain
  // strings / missing values, so `.toLowerCase()`/`.map()` never throw on
  // live data.
  const L = useCallback(
    (v: Bilingual): string => ((v && typeof v === 'object') ? (v[lang] ?? v.he ?? '') : (v ?? '')) as string,
    [lang],
  )
  // `tags` is `{ he: string[], en: string[] }` (or, defensively, a bare array).
  const L_arr = useCallback((v: Bilingual): string[] => {
    if (Array.isArray(v)) return v as string[]
    if (v && typeof v === 'object') {
      const arr = v[lang] ?? v.he
      return Array.isArray(arr) ? (arr as string[]) : []
    }
    return []
  }, [lang])

  // ── DETAIL MODALS (Note 2) ────────────────────────────────────
  // The shared <Modal> (pages/_app.tsx) renders an object payload as
  // { title, content, footer }; openModal is typed ReactNode so we cast the
  // structured payload through unknown. Content is built in the active language
  // and direction; CTAs reuse existing button classes/tokens.
  const openBusinessModal = useCallback((biz: DirRecord) => {
    const name = L(biz.name)
    const phone = biz.phone ? String(biz.phone) : ''
    // safeHref gates the link to http(s) at render time (defense-in-depth on
    // top of the server-side scheme validation); a non-http value renders no
    // link instead of an injectable href.
    const website = safeHref(biz.website)
    const categoryLabel = (d.categories as Record<string, string>)?.[biz.category as string] || String(biz.category ?? '')
    const callLabel = String(d.modal.call)
    const visitLabel = String(d.modal.visitWebsite)
    const content = (
      <div className="dir-modal-content">
        <div className="dir-modal-chips">
          {categoryLabel && (
            <span className="dir-modal-cat">{categoryLabel}</span>
          )}
          {L(biz.city) && (
            <span className="dir-modal-city">
              <MapPin size={13} aria-hidden="true" /> {L(biz.city)}
            </span>
          )}
        </div>
        {L(biz.description) && (
          <p className="dir-modal-body">{L(biz.description)}</p>
        )}
      </div>
    )
    const footer = (
      <>
        {phone && (
          <a href={`tel:${phone}`} className="btn btn-outline btn-sm dir-modal-cta" style={{ textDecoration: 'none' }}>
            <Phone size={14} aria-hidden="true" /> {callLabel}
          </a>
        )}
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" className="btn btn-ember btn-sm dir-modal-cta" style={{ textDecoration: 'none' }}>
            <Globe size={14} aria-hidden="true" /> {visitLabel}
          </a>
        )}
      </>
    )
    openModal({ title: name, content, footer } as unknown as ReactNode)
  }, [L, d, openModal])

  const openAnswerModal = useCallback((answer: DirRecord) => {
    const title = L(answer.title) || String(d.questionFallback)
    const region = L(answer.region)
    const audience = L(answer.audience)
    // Contact details now arrive on the answer (NGO data import): phone is a
    // free string (tel: action), email a mailto:, website the existing http(s)
    // link. All optional — only rendered when present, mirroring the business
    // card/modal styling.
    const phone = answer.phone ? String(answer.phone) : ''
    const email = answer.email ? String(answer.email) : ''
    // safeHref gates the link to http(s) at render time (see business modal).
    const website = safeHref(answer.sourceUrl)
    const startLabel = String(d.modal.startRequest)
    const callLabel = String(d.modal.call)
    const emailLabel = String(d.modal.email)
    const visitLabel = String(d.modal.visitWebsite)
    const content = (
      <div className="dir-modal-content">
        {(region || audience) && (
          <div className="dir-modal-meta">
            {region}{region && audience ? ' • ' : ''}{audience}
          </div>
        )}
        {L(answer.body) && (
          <p className="dir-modal-body">{L(answer.body)}</p>
        )}
      </div>
    )
    const footer = (
      <>
        {phone && (
          <a href={`tel:${phone}`} className="btn btn-outline btn-sm dir-modal-cta" style={{ textDecoration: 'none' }}>
            <Phone size={14} aria-hidden="true" /> {callLabel}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="btn btn-outline btn-sm dir-modal-cta" style={{ textDecoration: 'none' }}>
            <Mail size={14} aria-hidden="true" /> {emailLabel}
          </a>
        )}
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm dir-modal-cta" style={{ textDecoration: 'none' }}>
            <Globe size={14} aria-hidden="true" /> {visitLabel}
          </a>
        )}
        <button
          className="btn btn-ember btn-sm dir-modal-cta"
          onClick={() => { closeModal(); router.push('/requests') }}
        >
          {startLabel}
          <ArrowIcon size={14} aria-hidden="true" />
        </button>
      </>
    )
    openModal({ title, content, footer } as unknown as ReactNode)
  }, [L, d, openModal, closeModal, router, ArrowIcon])

  const [activeTab, setActiveTab] = useState('business')
  // Both organization tabs share the answers state; only the orgType scope
  // differs. While the business tab is active the last org scope ('ngo' by
  // default) stays loaded, so flipping business <-> ngo never refetches.
  const answerOrgType = activeTab === 'partner' ? 'partner' : 'ngo'
  const [bizSearch, setBizSearch] = useState('')
  const [bizCat, setBizCat] = useState('all')
  const [bizPage, setBizPage] = useState(1)
  const [showRegForm, setShowRegForm] = useState(false)
  const [businesses, setBusinesses] = useState<DirRecord[]>([])
  const [bizLoading, setBizLoading] = useState(true)
  const [bizError, setBizError] = useState<string | null>(null)
  const [registerForm, setRegisterForm] = useState({
    business_name: '',
    owner_name: '',
    phone: '',
    category: 'food',
    city: '',
    desc: '',
    website: '',
  })
  const [registerSubmitting, setRegisterSubmitting] = useState(false)
  // Branded notice dialog (replaces native alert): { message, variant, onClose? }.
  const [notice, setNotice] = useState<NoticeState>(null)
  const [answers, setAnswers] = useState<DirRecord[]>([])
  const [answerSearch, setAnswerSearch] = useState('')
  const [answerCategory, setAnswerCategory] = useState('all')
  const [answerRegion, setAnswerRegion] = useState('')
  const [answerAudience, setAnswerAudience] = useState('')
  const [answerPage, setAnswerPage] = useState(1)
  const [answersLoading, setAnswersLoading] = useState(true)
  const [answersError, setAnswersError] = useState<string | null>(null)

  // ── FILTER BUSINESSES ─────────────────────────────────────
  const filteredBiz = useMemo(() => {
    // GET /api/businesses already returns only status==='approved' businesses,
    // so we don't re-filter on the legacy `approved` boolean — admin-approved
    // submissions set status but not that boolean, and would wrongly drop out.
    let data = businesses
    if (bizCat !== 'all') data = data.filter(b => b.category === bizCat)
    if (bizSearch.trim()) {
      const q = bizSearch.toLowerCase()
      data = data.filter(b =>
        L(b.name).toLowerCase().includes(q) ||
        L(b.description).toLowerCase().includes(q) ||
        L(b.city).toLowerCase().includes(q) ||
        L_arr(b.tags).some(tag => String(tag).toLowerCase().includes(q))
      )
    }
    return data
  }, [bizCat, bizSearch, businesses, L, L_arr])

  const bizPageData = filteredBiz.slice((bizPage - 1) * PER_PAGE, bizPage * PER_PAGE)

  // ── FILTER ANSWERS ──────────────────────────────────────────
  const filteredAnswers = useMemo(() => {
    let filtered = answers
    if (answerCategory !== 'all') filtered = filtered.filter((item) => item.category === answerCategory)
    // region/audience are bilingual objects — filter against the active-language
    // value (the API no longer filters these server-side).
    if (answerRegion.trim()) {
      const q = answerRegion.toLowerCase()
      filtered = filtered.filter((item) => L(item.region).toLowerCase().includes(q))
    }
    if (answerAudience.trim()) {
      const q = answerAudience.toLowerCase()
      filtered = filtered.filter((item) => L(item.audience).toLowerCase().includes(q))
    }
    if (answerSearch.trim()) {
      const q = answerSearch.toLowerCase()
      filtered = filtered.filter((item) =>
        L(item.title).toLowerCase().includes(q) ||
        L(item.body).toLowerCase().includes(q) ||
        L(item.region).toLowerCase().includes(q) ||
        L(item.audience).toLowerCase().includes(q)
      )
    }
    return filtered
  }, [answers, answerCategory, answerRegion, answerAudience, answerSearch, L])

  const answerPageData = filteredAnswers.slice((answerPage - 1) * PER_PAGE, answerPage * PER_PAGE)

  // Loaders are useCallback so the Retry buttons can re-run them. `live` lets the
  // effect cancel a stale in-flight request without blocking a manual retry.
  const loadBusinesses = useCallback(async (live: { current: boolean } = { current: true }) => {
    setBizLoading(true)
    setBizError(null)
    try {
      const data = await apiJson('/api/businesses') as { items?: DirRecord[] }
      if (live.current && data?.items) {
        setBusinesses(data.items)
      }
    } catch (err) {
      if (live.current) {
        setBizError((err as CaughtError)?.detail?.error || 'Unable to load businesses')
      }
    } finally {
      if (live.current) setBizLoading(false)
    }
  }, [])

  const loadAnswers = useCallback(async (live: { current: boolean } = { current: true }) => {
    setAnswersLoading(true)
    setAnswersError(null)
    try {
      // Fetch the FULL orgType catalog once (no server-side `category` filter):
      // `orgType` scopes the answers to the active tab (ngo vs partner), and
      // category/region/audience are all filtered client-side. Keeping the
      // fetch category-agnostic means the loaded `answers` set always holds
      // every category for the tab, so the NGO_AREAS chip row stays complete
      // and a user can jump directly between categories (the chip set is
      // derived from this unfiltered set, not from a narrowed result).
      const query = new URLSearchParams()
      query.set('orgType', answerOrgType)
      const path = `/api/answers?${query.toString()}`
      const data = await apiJson(path) as { items?: DirRecord[] }
      if (live.current && data?.items) {
        setAnswers(data.items)
      }
    } catch (err) {
      if (live.current) {
        setAnswersError((err as CaughtError)?.detail?.error || 'Unable to load answers')
      }
    } finally {
      if (live.current) setAnswersLoading(false)
    }
  }, [answerOrgType])

  // Tab switch helper: any tab change restarts the answers pagination,
  // because moving between ngo/partner (directly or via the business tab)
  // swaps the orgType scope and refetches a differently-sized result set.
  const selectTab = (tab: string) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setAnswerPage(1)
  }

  // Escape closes the registration modal — standard dialog keyboard affordance.
  useEffect(() => {
    if (!showRegForm) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowRegForm(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showRegForm])

  useEffect(() => {
    const live = { current: true }
    loadBusinesses(live)
    return () => { live.current = false }
  }, [loadBusinesses])

  useEffect(() => {
    const live = { current: true }
    loadAnswers(live)
    return () => { live.current = false }
  }, [loadAnswers])

  // Deep-link from the URL (request form → directory). Once the router is ready
  // and the taxonomy has loaded, read ?category=<id> and optional
  // ?tab=ngo|partner: a valid category sets the answer-category filter and lands
  // on the chosen org tab. An explicit ?tab=partner honors that tab; otherwise
  // (no/other tab param) we land on whichever org tab actually has answers in
  // the deep-linked category so partner-only matches are never hidden behind an
  // empty עמותות tab. ngo wins ties (it is the larger default catalog). Unknown
  // or absent params are a silent no-op (keeps 'business' tab + 'all' filter).
  // Applied once so a later manual tab/filter change is never overridden.
  const deepLinkApplied = useRef(false)
  // Read the deep-link params off `router.query` directly: depending on the
  // whole `router.query` object would re-run this effect on its identity churn
  // during Pages-Router query hydration, and because the one-shot guard short-
  // circuits the re-run BEFORE a new cleanup is registered, React would then
  // invoke the previous run's cleanup and cancel an in-flight probe (the
  // deep-link would silently never apply). Keying on the stable primitive
  // params instead means the only re-runs are real param changes.
  const queryCategory = router.query.category
  const queryTab = router.query.tab
  useEffect(() => {
    if (deepLinkApplied.current) return
    if (!router.isReady) return
    // Wait for the taxonomy so we can validate the category against live ids.
    if (ngoCategories.length === 0) return

    const category = Array.isArray(queryCategory) ? queryCategory[0] : queryCategory
    if (!category || !ngoCategories.some((c) => c.id === category)) return

    const tab = Array.isArray(queryTab) ? queryTab[0] : queryTab

    // Mark applied only once we have a valid, actionable deep-link in hand, so
    // an early `return` above (no/invalid category) leaves the guard open for a
    // later render where the params have settled.
    deepLinkApplied.current = true

    const applyDeepLink = (nextTab: 'ngo' | 'partner') => {
      setActiveTab(nextTab)
      setAnswerCategory(category)
      setAnswerPage(1)
    }

    // Explicit partner request — honor it as-is.
    if (tab === 'partner') {
      applyDeepLink('partner')
      return
    }
    // Explicit ngo request — honor it as-is.
    if (tab === 'ngo') {
      applyDeepLink('ngo')
      return
    }

    // No tab hint: probe both org types for the category and land on the one
    // with results (ngo preferred on a tie / when both empty). A lightweight
    // count-only check keeps the deep-link from dead-ending on an empty tab.
    let alive = true
    const probe = async () => {
      const countFor = async (orgType: 'ngo' | 'partner') => {
        try {
          const data = await apiJson(
            `/api/answers?orgType=${orgType}&category=${encodeURIComponent(category)}`
          ) as { items?: DirRecord[] }
          return data?.items?.length ?? 0
        } catch {
          return 0
        }
      }
      const [ngoCount, partnerCount] = await Promise.all([countFor('ngo'), countFor('partner')])
      if (!alive) return
      // ngo wins unless it is empty and partner has matches.
      applyDeepLink(ngoCount === 0 && partnerCount > 0 ? 'partner' : 'ngo')
    }
    void probe()
    return () => { alive = false }
  }, [router.isReady, queryCategory, queryTab, ngoCategories])

  const BIZ_CATS = ['all', 'food', 'services', 'health', 'education', 'beauty', 'tech']
  // NGO area chips reflect REAL data, not the full taxonomy: the union of
  // categories actually present in the loaded answers, ordered by the taxonomy,
  // with a leading `all` chip. `answers` is the full orgType set (category is
  // filtered client-side, never server-side), so the chip row stays complete
  // after a category is picked — the user can switch directly between
  // categories. Before answers load (or when none match) only the `all` chip
  // shows — no flash of dead chips for taxonomy ids that never match.
  // Mirrors how the volunteer pool derives its byCategory chips.
  const NGO_AREAS = useMemo(() => {
    const present = new Set<string>()
    for (const a of answers) {
      if (typeof a.category === 'string' && a.category) present.add(a.category)
    }
    const ordered = ngoCategories.map((c) => c.id).filter((id) => present.has(id))
    return ['all', ...ordered]
  }, [answers, ngoCategories])

  // Segmented control: each tab is a self-contained pill inside a tinted track.
  const tabStyle = (active: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    paddingBlock: '9px', paddingInline: '18px',
    fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
    border: '1px solid transparent', borderRadius: '999px', cursor: 'pointer',
    color: active ? 'var(--ink)' : 'var(--ink-2)',
    background: active ? 'var(--white)' : 'transparent',
    borderColor: active ? 'var(--hair)' : 'transparent',
    boxShadow: active ? 'var(--shadow-xs)' : 'none',
    transition: 'color var(--dur-2) var(--ease-out), background var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)',
  })

  // WAI-ARIA tabs keyboard pattern: Arrow keys move between tabs, Home/End
  // jump to the ends. Direction-aware so RTL arrows feel natural. This only
  // moves the active tab (same effect as a click) — no data logic changes.
  const onTablistKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const order = TAB_ORDER
    const fwd = isRTL ? 'ArrowLeft' : 'ArrowRight'
    const back = isRTL ? 'ArrowRight' : 'ArrowLeft'
    const idx = order.indexOf(activeTab)
    let next = idx
    if (e.key === fwd) next = (idx + 1) % order.length
    else if (e.key === back) next = (idx - 1 + order.length) % order.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = order.length - 1
    else return
    e.preventDefault()
    selectTab(order[next])
  }

  const updateRegisterField = (field: string, value: string) => {
    setRegisterForm(prev => ({ ...prev, [field]: value }))
  }

  const handleRegisterSubmit = async () => {
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

  const resultsCount = activeTab === 'business' ? filteredBiz.length : filteredAnswers.length
  const loading = activeTab === 'business' ? bizLoading : answersLoading
  const error = activeTab === 'business' ? bizError : answersError
  const retry = activeTab === 'business' ? loadBusinesses : loadAnswers

  return (
    <main>
      {/* ── EDITORIAL HEADER — eyebrow → serif display → lede ──────── */}
      <section style={{ background: 'var(--cream)', borderBlockEnd: '1px solid var(--hair)' }}>
        <div className="page-container" style={{ paddingBlock: 'clamp(40px, 6vw, 64px) clamp(16px, 2vw, 22px)' }}>
          <Reveal>
            <div className="dir-header-row">
              <div className="dir-header-copy">
                <span className="eyebrow dir-header-eyebrow">
                  {lang === 'he' ? 'מדריך קהילתי' : 'Community directory'}
                </span>
                <h1 className="section-display-bold" style={{ margin: 0 }}>
                  {d.pageTitle}
                </h1>
              </div>
              <button
                className="btn btn-ember"
                onClick={() => setShowRegForm(true)}
                style={{ flexShrink: 0 }}
              >
                <Plus size={16} aria-hidden="true" />
                {d.registerBiz}
              </button>
            </div>
          </Reveal>

          {/* Segmented tab control sits at the header baseline (no overlap).
              Roving tabindex + arrow-key handling implement the WAI-ARIA tabs
              pattern; each tab controls the results panel below. */}
          <div
            role="tablist"
            aria-label={d.pageTitle}
            className="dir-tabs"
            onKeyDown={onTablistKeyDown}
          >
            <button
              role="tab"
              id="dir-tab-business"
              aria-selected={activeTab === 'business'}
              aria-controls="dir-panel"
              tabIndex={activeTab === 'business' ? 0 : -1}
              className="dir-tab"
              style={tabStyle(activeTab === 'business')}
              onClick={() => selectTab('business')}
            >
              <Store size={15} aria-hidden="true" />
              {d.tabBusiness}
            </button>
            <button
              role="tab"
              id="dir-tab-ngo"
              aria-selected={activeTab === 'ngo'}
              aria-controls="dir-panel"
              tabIndex={activeTab === 'ngo' ? 0 : -1}
              className="dir-tab"
              style={tabStyle(activeTab === 'ngo')}
              onClick={() => selectTab('ngo')}
            >
              <HeartHandshake size={15} aria-hidden="true" />
              {d.tabNGO}
            </button>
            <button
              role="tab"
              id="dir-tab-partner"
              aria-selected={activeTab === 'partner'}
              aria-controls="dir-panel"
              tabIndex={activeTab === 'partner' ? 0 : -1}
              className="dir-tab"
              style={tabStyle(activeTab === 'partner')}
              onClick={() => selectTab('partner')}
            >
              <Handshake size={15} aria-hidden="true" />
              {d.tabPartner}
            </button>
          </div>
        </div>
      </section>

      <div className="page-container" style={{ paddingBlock: 'clamp(40px, 5vw, 56px) 72px' }}>
        {/* ── CONTROLS: search + chips + secondary filters in one block ── */}
        <div
          className="dir-controls"
          id="dir-panel"
          role="tabpanel"
          aria-labelledby={`dir-tab-${activeTab}`}
        >
        {/* ── SEARCH (always visible, above fold) ────────────────────── */}
        <div className="dir-search">
          <Search size={17} aria-hidden="true" className="dir-search-icon" />
          <input
            type="search"
            value={activeTab === 'business' ? bizSearch : answerSearch}
            onChange={e => {
              if (activeTab === 'business') { setBizSearch(e.target.value); setBizPage(1) }
              else { setAnswerSearch(e.target.value); setAnswerPage(1) }
            }}
            placeholder={activeTab === 'business' ? d.searchPH : d.searchNGO}
            className="form-input dir-search-input"
            aria-label={activeTab === 'business' ? d.searchPH : d.searchNGO}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </div>

        {/* ── CATEGORY CHIPS (always visible, each with a lucide icon) ── */}
        {activeTab === 'business' ? (
          <div className="dir-chip-row" role="group" aria-label={d.filters}>
            {BIZ_CATS.map(cat => {
              const Icon = BIZ_CAT_ICONS[cat] || LayoutGrid
              return (
                <button
                  key={cat}
                  className={`filter-chip dir-chip${bizCat === cat ? ' active' : ''}`}
                  aria-pressed={bizCat === cat}
                  onClick={() => { setBizCat(cat); setBizPage(1) }}
                >
                  <Icon size={15} aria-hidden="true" />
                  {cat === 'all' ? d.filterAll : d.categories[cat]}
                </button>
              )
            })}
          </div>
        ) : (
          <>
            <div className="dir-chip-row" role="group" aria-label={d.filters}>
              {NGO_AREAS.map(area => {
                const Icon = NGO_AREA_ICONS[area] || LayoutGrid
                return (
                  <button
                    key={area}
                    className={`filter-chip dir-chip${answerCategory === area ? ' active' : ''}`}
                    aria-pressed={answerCategory === area}
                    onClick={() => { setAnswerCategory(area); setAnswerPage(1) }}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {area === 'all' ? d.filterAll : catLabel(area)}
                  </button>
                )
              })}
            </div>
            <div className="dir-filter-row">
              <input
                type="text"
                value={answerRegion}
                onChange={e => { setAnswerRegion(e.target.value); setAnswerPage(1) }}
                placeholder={d.regionPH}
                aria-label={d.regionPH}
                className="form-input"
              />
              <input
                type="text"
                value={answerAudience}
                onChange={e => { setAnswerAudience(e.target.value); setAnswerPage(1) }}
                placeholder={d.audiencePH}
                aria-label={d.audiencePH}
                className="form-input"
              />
            </div>
          </>
        )}
        </div>

        {/* ── RESULTS COUNT ─────────────────────────────────────────── */}
        {!error && (
          <div aria-live="polite" className="dir-results-count">
            {loading ? t.common.loading : `${resultsCount} ${t.common.results}`}
          </div>
        )}

        {/* ── ERROR STATE (with Retry) ──────────────────────────────── */}
        {!loading && error && (
          <div className="dir-state" role="alert">
            <span className="dir-state-icon is-error">
              <AlertTriangle size={26} aria-hidden="true" />
            </span>
            <h3 className="section-display dir-state-title">{d.loadError}</h3>
            <button className="btn btn-ember" onClick={() => retry()} style={{ marginBlockStart: '12px' }}>
              {d.retry}
            </button>
          </div>
        )}

        {/* ── LOADING SKELETON — branded card bones ─────────────────── */}
        {loading && !error && (
          <div className="dir-grid" aria-hidden="true">
            {Array.from({ length: PER_PAGE }).map((_, i) => (
              <div key={i} className="card-bones">
                <div className="card-bones-head">
                  <span className="skeleton card-bones-avatar" />
                  <span className="card-bones-head-lines">
                    <span className="skeleton bone bone-title" />
                    <span className="skeleton bone bone-sub" />
                  </span>
                </div>
                <span className="skeleton bone bone-line" />
                <span className="skeleton bone bone-line bone-w-90" />
                <span className="skeleton bone bone-line bone-w-75" />
                <span className="skeleton bone bone-pill" />
              </div>
            ))}
          </div>
        )}

        {/* ── BUSINESS RESULTS ──────────────────────────────────────── */}
        {!loading && !error && activeTab === 'business' && (
          <>
            {bizPageData.length > 0 ? (
              <div className="dir-grid">
                {bizPageData.map((biz, i) => {
                  const BannerIcon = BIZ_CAT_ICONS[biz.category as string] || Store
                  const photo = biz.photo ? String(biz.photo) : ''
                  return (
                  <Reveal key={biz.id} delay={Math.min(i, 5) * 0.06} className="card card-interactive dir-biz-card">
                    {/* Banner — photo when present, else a flat ink panel with the
                        category glyph. No gradient (brand constraint). */}
                    <div
                      className="dir-biz-banner"
                      style={photo
                        ? { backgroundImage: `url("${photo}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : undefined
                      }
                      aria-hidden="true"
                    >
                      {!photo && <BannerIcon size={52} color="var(--cream)" strokeWidth={1.5} />}
                      {biz.featured && (
                        <span className="dir-biz-featured">
                          <Star size={10} fill="var(--ember)" color="var(--ember)" aria-hidden="true" /> {d.featured}
                        </span>
                      )}
                    </div>
                    <div className="dir-biz-body">
                      <div className="dir-biz-name">{L(biz.name)}</div>
                      <div className="dir-biz-meta">
                        <MapPin size={12} aria-hidden="true" />
                        {d.categories[biz.category] || biz.category} • {L(biz.city)}
                      </div>
                      <p className="dir-biz-desc">
                        {L(biz.description)}
                      </p>
                      <div className="dir-tags">
                        {L_arr(biz.tags).map(tag => (
                          <span key={tag} className="dir-tag">{tag}</span>
                        ))}
                      </div>
                      {/* Rating only renders when the business actually has
                          reviews. There is no review-submission feature yet, so
                          a zero-review business shows no fabricated star/score
                          (matches the seed's rating:0/reviews:0). */}
                      {Number(biz.reviews) > 0 && (
                        <div className="dir-rating">
                          <Star size={15} fill="var(--ember)" color="var(--ember)" aria-hidden="true" />
                          <span className="dir-rating-value">{biz.rating}</span>
                          <span className="dir-rating-count">({biz.reviews})</span>
                        </div>
                      )}
                      <div className="dir-card-actions">
                        <a href={`tel:${biz.phone}`} className="btn btn-outline btn-sm dir-biz-call" aria-label={`${L(biz.name)} — ${biz.phone}`}>
                          <Phone size={14} aria-hidden="true" /> {biz.phone}
                        </a>
                        <button className="btn btn-ember btn-sm" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }} onClick={() => openBusinessModal(biz)}>{d.moreBtn}</button>
                      </div>
                    </div>
                  </Reveal>
                  )
                })}
              </div>
            ) : (
              <div className="dir-state">
                <span className="dir-state-icon">
                  <Store size={26} aria-hidden="true" />
                </span>
                <h3 className="section-display dir-state-title">{d.emptyBiz}</h3>
                <p className="dir-state-hint">{d.noResultsHint}</p>
              </div>
            )}
            <Pagination total={filteredBiz.length} perPage={PER_PAGE} current={bizPage} onChange={setBizPage} />
          </>
        )}

        {/* ── ANSWER RESULTS (ngo + partner tabs share this panel) ───── */}
        {!loading && !error && activeTab !== 'business' && (
          <>
            {answerPageData.length > 0 ? (
              <div className="dir-grid">
                {answerPageData.map((answer, i) => {
                  const aTitle = L(answer.title)
                  const aRegion = L(answer.region)
                  const aAudience = L(answer.audience)
                  const areaLabel = answer.category && (answer.category === 'all' ? d.filterAll : catLabel(String(answer.category)))
                  return (
                  <Reveal key={answer.id} delay={Math.min(i, 5) * 0.06} className="card card-interactive dir-answer-card">
                    {areaLabel && (
                      <span className="dir-answer-badge">
                        {areaLabel}
                      </span>
                    )}
                    <h3 className="dir-answer-title">
                      {aTitle || d.questionFallback}
                    </h3>
                    {(aRegion || aAudience) && (
                      <div className="dir-answer-sub">
                        {aRegion}{aRegion && aAudience ? ' • ' : ''}{aAudience}
                      </div>
                    )}
                    <p className="dir-answer-body">
                      {L(answer.body)}
                    </p>
                    <div className="dir-tags">
                      {aRegion && (
                        <span className="dir-tag">{aRegion}</span>
                      )}
                      {aAudience && (
                        <span className="dir-tag">{aAudience}</span>
                      )}
                    </div>
                    <div className="dir-answer-footer">
                      <button className="btn btn-navy btn-sm dir-answer-cta" onClick={() => openAnswerModal(answer)}>
                        {d.moreBtn}
                        <ArrowIcon size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </Reveal>
                  )
                })}
              </div>
            ) : (
              <div className="dir-state">
                <span className="dir-state-icon">
                  {activeTab === 'partner'
                    ? <Handshake size={26} aria-hidden="true" />
                    : <HeartHandshake size={26} aria-hidden="true" />}
                </span>
                <h3 className="section-display dir-state-title">
                  {activeTab === 'partner' ? d.emptyPartners : d.emptyAnswers}
                </h3>
                <p className="dir-state-hint">{d.noResultsHint}</p>
              </div>
            )}
            <Pagination total={filteredAnswers.length} perPage={PER_PAGE} current={answerPage} onChange={setAnswerPage} />
          </>
        )}
      </div>

      {/* Business Registration Modal */}
      {showRegForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRegForm(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="dir-reg-title">
            <div className="modal-header">
              <h3 id="dir-reg-title" style={{ fontFamily: 'Frank Ruhl Libre, Georgia, serif', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
                {d.registerNew}
              </h3>
              <button onClick={() => setShowRegForm(false)} className="btn btn-ghost btn-sm dir-modal-close" aria-label={t.common.cancel}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="modal-body">
              {['business_name', 'owner_name', 'phone', 'category', 'city', 'desc'].map(field => (
                <div className="form-group" key={field}>
                  <label className="form-label" htmlFor={`dir-reg-${field}`}>
                    {d.fields[field]}
                  </label>
                  {field === 'desc' ? (
                    <textarea
                      id={`dir-reg-${field}`}
                      name={field}
                      className="form-textarea"
                      rows={3}
                      value={registerForm.desc}
                      onChange={(e) => updateRegisterField('desc', e.target.value)}
                    />
                  ) : field === 'category' ? (
                    <select
                      id={`dir-reg-${field}`}
                      name={field}
                      className="form-select"
                      value={registerForm.category}
                      onChange={(e) => updateRegisterField('category', e.target.value)}
                    >
                      {Object.entries(d.categories as Record<string, string>).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`dir-reg-${field}`}
                      name={field}
                      autoComplete={REG_AUTOCOMPLETE[field] || 'off'}
                      className="form-input"
                      type={field === 'phone' ? 'tel' : 'text'}
                      value={(registerForm as Record<string, string>)[field]}
                      onChange={(e) => updateRegisterField(field, e.target.value)}
                    />
                  )}
                </div>
              ))}
              {/* Note 2 — optional public website (validated as a URL on submit). */}
              <div className="form-group">
                <label className="form-label" htmlFor="biz-website">
                  {d.websiteLabel}
                </label>
                <input
                  id="biz-website"
                  name="website"
                  autoComplete="url"
                  spellCheck={false}
                  className="form-input"
                  type="url"
                  inputMode="url"
                  placeholder={d.websitePH}
                  value={registerForm.website}
                  onChange={(e) => updateRegisterField('website', e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowRegForm(false)}>{t.common.cancel}</button>
              <button className="btn btn-ember" onClick={handleRegisterSubmit} disabled={registerSubmitting}>
                {registerSubmitting ? t.common.loading : d.submitApproval}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branded notice (replaces native alert). Single OK button by default;
          when the notice carries an `action` (e.g. the 401 sign-in case) it
          becomes a two-button dialog: the primary runs the action, Cancel
          dismisses. */}
      <ConfirmDialog
        open={!!notice}
        title={notice?.variant === 'danger' ? t.common.notice : t.common.success}
        message={notice?.message}
        confirmLabel={notice?.action ? notice.action.confirmLabel : t.common.ok}
        cancelLabel={notice?.action ? t.common.cancel : undefined}
        onConfirm={() => {
          const action = notice?.action
          setNotice(null)
          action?.onConfirm()
        }}
        onCancel={() => setNotice(null)}
      />
    </main>
  )
}
