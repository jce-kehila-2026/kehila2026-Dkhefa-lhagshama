/**
 * DirectoryPage — the public community directory screen (UC-02 + UC-03).
 *
 * One screen, three tabs: community businesses, NGOs ('ngo' orgType) and
 * partners ('partner' orgType). It owns all the page state (active tab,
 * per-tab search/category/region/audience filters, pagination, the business
 * registration modal + form) and the data fetched from the backend, but
 * delegates the heavy lifting to the ./directory/* modules: data loaders,
 * client-side filtering, detail-modal payload builders, registration submit,
 * deep-link sync, and the presentational sub-components (tabs, controls,
 * result lists, states, registration modal).
 *
 * Key invariants:
 * - Both org tabs share one `answers` state; only `answerOrgType` (ngo|partner)
 *   scopes the fetch. The business tab keeps the last org scope loaded.
 * - Category/region/audience filtering is always client-side; only orgType is
 *   server-side. So filter chips can reflect the real loaded data.
 * - `userInteracted` is the cancellation signal that stops an in-flight
 *   deep-link probe from snapping the tab/category back after a manual click.
 * - Translatable fields arrive as `{ he, en }`; the L / L_arr helpers render
 *   the active language and degrade safely for plain values.
 *
 * Bilingual (HE/EN) + RTL-aware (arrow direction, keyboard tab order).
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowRight, ArrowLeft, Plus } from 'lucide-react'
import { useRouter } from 'next/router'
import ConfirmDialog from '@/components/feedback/ConfirmDialog'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import Reveal from '../components/motion/Reveal'
import { useLanguage } from '../contexts/LanguageContext'
import { useCategories } from '../hooks/useCategories'
import { PER_PAGE, TAB_ORDER } from './directory/constants'
import type { LangCtx, Bilingual, DirRecord, NoticeState } from './directory/constants'
import DirectoryTabs from './directory/DirectoryTabs'
import DirectoryControls from './directory/DirectoryControls'
import BusinessResults from './directory/BusinessResults'
import AnswerResults from './directory/AnswerResults'
import RegistrationModal from './directory/RegistrationModal'
import DirectoryStates from './directory/DirectoryStates'
import { filterBusinesses, filterAnswers } from './directory/filters'
import { makeLoadBusinesses, makeLoadAnswers } from './directory/loaders'
import { makeOpenBusinessModal, makeOpenAnswerModal } from './directory/detailModals'
import { makeHandleRegisterSubmit } from './directory/registerSubmit'
import { useDirectoryDeepLink } from './directory/useDirectoryDeepLink'
import { pickLang as pickShared, pickLangArray as pickArrShared } from '@/lib/bilingual'
import styles from './DirectoryPage.module.css'

export default function DirectoryPage() {
  const { t, lang, isRTL } = useLanguage() as unknown as LangCtx
  const { openModal, closeModal } = useApp()
  const { user } = useAuth()
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
    (v: Bilingual): string => pickShared(v as Parameters<typeof pickShared>[0], lang),
    [lang],
  )
  // `tags` is `{ he: string[], en: string[] }` (or, defensively, a bare array).
  const L_arr = useCallback(
    (v: Bilingual): string[] => pickArrShared(v as Parameters<typeof pickArrShared>[0], lang),
    [lang],
  )

  // ── DETAIL MODALS (Note 2) ────────────────────────────────────
  // The modal-payload builders live in ./directory/detailModals; they are wired
  // up here with the live language helpers + app context so behavior (content,
  // direction, CTAs) is unchanged.
  const openBusinessModal = useCallback(
    (biz: DirRecord) => makeOpenBusinessModal({ L, d, openModal })(biz),
    [L, d, openModal],
  )

  const openAnswerModal = useCallback(
    (answer: DirRecord) => makeOpenAnswerModal({ L, d, openModal, closeModal, router, ArrowIcon })(answer),
    [L, d, openModal, closeModal, router, ArrowIcon],
  )

  const [activeTab, setActiveTab] = useState('business')
  // Both organization tabs share the answers state; only the orgType scope
  // differs. While the business tab is active the last org scope ('ngo' by
  // default) stays loaded, so flipping business <-> ngo never refetches.
  const answerOrgType = activeTab === 'partner' ? 'partner' : 'ngo'
  const [bizSearch, setBizSearch] = useState('')
  const [bizCat, setBizCat] = useState('all')
  const [bizPage, setBizPage] = useState(1)
  const [showRegForm, setShowRegForm] = useState(false)

  // Registering a business is owner-linked, so it requires login. Gate the entry
  // point: a signed-out user is sent to log in first (and returned here with
  // ?register=1 to auto-open the form) instead of filling a form that 401s.
  const openRegister = () => {
    if (!user) {
      router.push('/login?next=' + encodeURIComponent('/directory?register=1'))
      return
    }
    setShowRegForm(true)
  }
  useEffect(() => {
    if (router.query.register === '1' && user) {
      setShowRegForm(true)
      router.replace('/directory', undefined, { shallow: true })
    }
  }, [router.query.register, user, router])
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
  const filteredBiz = useMemo(
    () => filterBusinesses(businesses, bizCat, bizSearch, L, L_arr),
    [bizCat, bizSearch, businesses, L, L_arr],
  )

  const bizPageData = filteredBiz.slice((bizPage - 1) * PER_PAGE, bizPage * PER_PAGE)

  // ── FILTER ANSWERS ──────────────────────────────────────────
  const filteredAnswers = useMemo(
    () => filterAnswers(answers, answerCategory, answerRegion, answerAudience, answerSearch, L),
    [answers, answerCategory, answerRegion, answerAudience, answerSearch, L],
  )

  const answerPageData = filteredAnswers.slice((answerPage - 1) * PER_PAGE, answerPage * PER_PAGE)

  // Loaders are useCallback so the Retry buttons can re-run them. `live` lets the
  // effect cancel a stale in-flight request without blocking a manual retry.
  const loadBusinesses = useCallback(
    (live?: { current: boolean }) =>
      makeLoadBusinesses({ setBizLoading, setBizError, setBusinesses })(live),
    [],
  )

  const loadAnswers = useCallback(
    (live?: { current: boolean }) =>
      makeLoadAnswers({ answerOrgType, setAnswersLoading, setAnswersError, setAnswers })(live),
    [answerOrgType],
  )

  // Tab switch helper: any tab change restarts the answers pagination,
  // because moving between ngo/partner (directly or via the business tab)
  // swaps the orgType scope and refetches a differently-sized result set.
  const selectTab = (tab: string) => {
    if (tab === activeTab) return
    // Mark a real user interaction so an in-flight deep-link probe won't snap
    // the tab back when its async count fetch resolves (review r6, finding 3).
    userInteracted.current = true
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

  // Set the moment the user touches the tabs or a category chip. The no-tab
  // deep-link probe fetches two answer counts asynchronously; if the user
  // clicks a tab while that is in flight, the probe must NOT snap the
  // tab/category back when it resolves. This ref is the cancellation signal the
  // probe checks before applying. (selectTab + the chip onClick set it; the
  // deep-link's own applyDeepLink writes state directly and does NOT.)
  const userInteracted = useRef(false)
  useDirectoryDeepLink({
    router,
    ngoCategories,
    userInteracted,
    setActiveTab,
    setAnswerCategory,
    setAnswerPage,
  })

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

  const handleRegisterSubmit = makeHandleRegisterSubmit({
    d,
    registerForm,
    setNotice,
    setRegisterSubmitting,
    setShowRegForm,
    setRegisterForm,
    router,
  })

  const resultsCount = activeTab === 'business' ? filteredBiz.length : filteredAnswers.length
  const loading = activeTab === 'business' ? bizLoading : answersLoading
  const error = activeTab === 'business' ? bizError : answersError
  const retry = activeTab === 'business' ? loadBusinesses : loadAnswers

  return (
    <main>
      {/* ── EDITORIAL HEADER — eyebrow → serif display → lede ──────── */}
      <section className={styles.headerSection}>
        <div className="page-container dir-band-compact">
          <Reveal>
            <div className="dir-header-row">
              <div className="dir-header-copy">
                <span className="eyebrow dir-header-eyebrow">
                  {lang === 'he' ? 'מדריך קהילתי' : 'Community directory'}
                </span>
                <h1 className={`section-display-bold ${styles.pageTitle}`}>
                  {d.pageTitle}
                </h1>
              </div>
              <button
                className={`btn btn-ember ${styles.registerBtn}`}
                onClick={openRegister}
              >
                <Plus size={16} aria-hidden="true" />
                {d.registerBiz}
              </button>
            </div>
          </Reveal>

          <DirectoryTabs
            d={d}
            activeTab={activeTab}
            tabStyle={tabStyle}
            selectTab={selectTab}
            onTablistKeyDown={onTablistKeyDown}
          />
        </div>
      </section>

      <div className="page-container dir-shell-compact">
        <DirectoryControls
          d={d}
          activeTab={activeTab}
          bizSearch={bizSearch}
          answerSearch={answerSearch}
          setBizSearch={setBizSearch}
          setBizPage={setBizPage}
          setAnswerSearch={setAnswerSearch}
          setAnswerPage={setAnswerPage}
          bizCat={bizCat}
          setBizCat={setBizCat}
          answerCategory={answerCategory}
          setAnswerCategory={setAnswerCategory}
          NGO_AREAS={NGO_AREAS}
          catLabel={catLabel}
          userInteracted={userInteracted}
          answerRegion={answerRegion}
          setAnswerRegion={setAnswerRegion}
          answerAudience={answerAudience}
          setAnswerAudience={setAnswerAudience}
        />

        <DirectoryStates
          d={d}
          t={t}
          loading={loading}
          error={error}
          resultsCount={resultsCount}
          retry={retry}
        />

        {/* ── BUSINESS RESULTS ──────────────────────────────────────── */}
        {!loading && !error && activeTab === 'business' && (
          <BusinessResults
            d={d}
            bizPageData={bizPageData}
            filteredBizLength={filteredBiz.length}
            bizPage={bizPage}
            setBizPage={setBizPage}
            L={L}
            L_arr={L_arr}
            openBusinessModal={openBusinessModal}
          />
        )}

        {/* ── ANSWER RESULTS (ngo + partner tabs share this panel) ───── */}
        {!loading && !error && activeTab !== 'business' && (
          <AnswerResults
            d={d}
            activeTab={activeTab}
            answerPageData={answerPageData}
            filteredAnswersLength={filteredAnswers.length}
            answerPage={answerPage}
            setAnswerPage={setAnswerPage}
            L={L}
            catLabel={catLabel}
            openAnswerModal={openAnswerModal}
            ArrowIcon={ArrowIcon}
          />
        )}
      </div>

      {/* Business Registration Modal */}
      {showRegForm && (
        <RegistrationModal
          d={d}
          t={t}
          registerForm={registerForm}
          registerSubmitting={registerSubmitting}
          setShowRegForm={setShowRegForm}
          updateRegisterField={updateRegisterField}
          handleRegisterSubmit={handleRegisterSubmit}
        />
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
