import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Star, Phone, MapPin, SlidersHorizontal, ChevronDown } from 'lucide-react'
import Pagination from '../components/Pagination'
import { useLanguage } from '../contexts/LanguageContext'
import { apiJson } from '../lib/apiClient'

const PER_PAGE = 6

export default function DirectoryPage() {
  const { t, lang } = useLanguage()
  const d = t.directory

  // ── BILINGUAL FIELD HELPERS ───────────────────────────────────
  // Translatable fields arrive from the API as `{ he, en }` objects. These
  // helpers render the active language and degrade gracefully for plain
  // strings / missing values, so `.toLowerCase()`/`.map()` never throw on
  // live data.
  const L = (v) => (v && typeof v === 'object') ? (v[lang] ?? v.he ?? '') : (v ?? '')
  // `tags` is `{ he: string[], en: string[] }` (or, defensively, a bare array).
  const L_arr = (v) => {
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      const arr = v[lang] ?? v.he
      return Array.isArray(arr) ? arr : []
    }
    return []
  }

  const [activeTab, setActiveTab] = useState('business')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [bizSearch, setBizSearch] = useState('')
  const [bizCat, setBizCat] = useState('all')
  const [bizPage, setBizPage] = useState(1)
  const [showRegForm, setShowRegForm] = useState(false)
  const [businesses, setBusinesses] = useState([])
  const [bizLoading, setBizLoading] = useState(true)
  const [bizError, setBizError] = useState(null)
  const [registerForm, setRegisterForm] = useState({
    business_name: '',
    owner_name: '',
    phone: '',
    category: 'food',
    city: '',
    desc: '',
  })
  const [registerSubmitting, setRegisterSubmitting] = useState(false)
  const [answers, setAnswers] = useState([])
  const [answerSearch, setAnswerSearch] = useState('')
  const [answerCategory, setAnswerCategory] = useState('all')
  const [answerRegion, setAnswerRegion] = useState('')
  const [answerAudience, setAnswerAudience] = useState('')
  const [answerPage, setAnswerPage] = useState(1)
  const [answersLoading, setAnswersLoading] = useState(true)
  const [answersError, setAnswersError] = useState(null)

  // ── FILTER BUSINESSES ─────────────────────────────────────
  const filteredBiz = useMemo(() => {
    let data = businesses.filter(b => b.approved)
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
  }, [bizCat, bizSearch, businesses, lang])

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
  }, [answers, answerCategory, answerRegion, answerAudience, answerSearch, lang])

  const answerPageData = filteredAnswers.slice((answerPage - 1) * PER_PAGE, answerPage * PER_PAGE)

  // Loaders are useCallback so the Retry buttons can re-run them. `live` lets the
  // effect cancel a stale in-flight request without blocking a manual retry.
  const loadBusinesses = useCallback(async (live = { current: true }) => {
    setBizLoading(true)
    setBizError(null)
    try {
      const data = await apiJson('/api/businesses')
      if (live.current && data?.items) {
        setBusinesses(data.items)
      }
    } catch (err) {
      if (live.current) {
        setBizError(err?.detail?.error || 'Unable to load businesses')
      }
    } finally {
      if (live.current) setBizLoading(false)
    }
  }, [])

  const loadAnswers = useCallback(async (live = { current: true }) => {
    setAnswersLoading(true)
    setAnswersError(null)
    try {
      // `category` is an enum key the API can still filter on server-side.
      // region/audience are bilingual objects and are filtered client-side.
      const query = new URLSearchParams()
      if (answerCategory !== 'all') query.set('category', answerCategory)
      const queryString = query.toString()
      const path = `/api/answers${queryString ? `?${queryString}` : ''}`
      const data = await apiJson(path)
      if (live.current && data?.items) {
        setAnswers(data.items)
      }
    } catch (err) {
      if (live.current) {
        setAnswersError(err?.detail?.error || 'Unable to load answers')
      }
    } finally {
      if (live.current) setAnswersLoading(false)
    }
  }, [answerCategory])

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

  const BIZ_CATS = ['all', 'food', 'services', 'health', 'education', 'beauty', 'tech']
  const NGO_AREAS = ['all', 'education', 'employment', 'legal', 'social', 'housing']

  const tabStyle = (active) => ({
    padding: '10px 18px', fontSize: '14.5px', fontWeight: 600,
    border: 'none', background: 'none', cursor: 'pointer',
    color: active ? 'var(--ink)' : 'var(--ink-2)',
    borderBottom: active ? '2px solid var(--ember)' : '2px solid transparent',
    marginBottom: '-1px', transition: 'color .2s', fontFamily: 'inherit',
  })

  const updateRegisterField = (field, value) => {
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
    }

    if (!trimmed.name || !trimmed.ownerName || !trimmed.phone || !trimmed.city || !trimmed.description) {
      return window.alert(d.fillRequired);
    }

    // The backend (Zod) requires a description of at least 10 characters.
    // Validate here so the user gets a precise message instead of a generic 400.
    if (trimmed.description.length < 10) {
      return window.alert(d.descTooShort);
    }

    setRegisterSubmitting(true)
    try {
      await apiJson('/api/businesses', {
        method: 'POST',
        body: JSON.stringify(trimmed),
      })
      window.alert(d.submitSuccess)
      setShowRegForm(false)
      setRegisterForm({ business_name: '', owner_name: '', phone: '', category: 'food', city: '', desc: '' })
    } catch (err) {
      // Surface the real backend error so failures are diagnosable instead of a
      // blanket "try again later". apiJson throws { status, error, detail }.
      console.error('[DirectoryPage] register business failed:', err)
      // 401 means no signed-in user — registering a business requires login so
      // the submission can be tied to an owner (firestore rules key off ownerId).
      if (err?.status === 401) {
        window.alert(d.loginRequired)
        setRegisterSubmitting(false)
        return
      }
      const fieldErrors = err?.detail?.fieldErrors
      let detailMsg = ''
      if (fieldErrors && typeof fieldErrors === 'object') {
        detailMsg = Object.entries(fieldErrors)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join('\n')
      } else if (typeof err?.detail === 'string') {
        detailMsg = err.detail
      } else if (err?.detail?.error) {
        detailMsg = err.detail.error
      } else if (err?.error) {
        detailMsg = err.error
      }
      const base = d.submitError
      window.alert(detailMsg ? `${base}\n${detailMsg}` : base)
    } finally {
      setRegisterSubmitting(false)
    }
  }

  const resultsCount = activeTab === 'business' ? filteredBiz.length : filteredAnswers.length
  const loading = activeTab === 'business' ? bizLoading : answersLoading
  const error = activeTab === 'business' ? bizError : answersError
  const retry = activeTab === 'business' ? loadBusinesses : loadAnswers

  return (
    <>
      {/* ── SLIM HEADER (#78) — replaces heavy PageHeader ──────────── */}
      <div style={{ background: 'var(--paper)', borderBottom: '1px solid var(--hair)' }}>
        <div className="page-container" style={{ paddingBlock: '24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 className="section-display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', margin: '0 0 4px' }}>
                {d.pageTitle}
              </h1>
              <p style={{ color: 'var(--ink-2)', fontSize: '14px', margin: 0 }}>{d.pageSubtitle}</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowRegForm(true)}>
              + {d.registerBiz}
            </button>
          </div>

          {/* Tabs sit on the header baseline */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '18px' }}>
            <button style={tabStyle(activeTab === 'business')} onClick={() => { setActiveTab('business'); setFiltersOpen(false) }}>
              {d.tabBusiness}
            </button>
            <button style={tabStyle(activeTab === 'ngo')} onClick={() => { setActiveTab('ngo'); setFiltersOpen(false) }}>
              {d.tabNGO}
            </button>
          </div>
        </div>
      </div>

      <div className="page-container" style={{ paddingBlock: '24px 64px' }}>
        {/* ── SEARCH + COLLAPSIBLE FILTER TOGGLE (always visible, above fold) ── */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} style={{
              position: 'absolute', top: '50%', transform: 'translateY(-50%)',
              insetInlineStart: '12px', color: 'var(--gray-400)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              value={activeTab === 'business' ? bizSearch : answerSearch}
              onChange={e => {
                if (activeTab === 'business') { setBizSearch(e.target.value); setBizPage(1) }
                else { setAnswerSearch(e.target.value); setAnswerPage(1) }
              }}
              placeholder={activeTab === 'business' ? d.searchPH : d.searchNGO}
              className="form-input"
              style={{ paddingInlineStart: '38px' }}
              aria-label={activeTab === 'business' ? d.searchPH : d.searchNGO}
            />
          </div>
          <button
            className="btn btn-outline btn-sm"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(o => !o)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <SlidersHorizontal size={15} />
            {d.filters}
            <ChevronDown
              size={15}
              style={{ transition: 'transform .2s', transform: filtersOpen ? 'rotate(180deg)' : 'none' }}
            />
          </button>
        </div>

        {/* ── COLLAPSIBLE FILTER PANEL ──────────────────────────────── */}
        {filtersOpen && (
          <div style={{
            background: 'var(--paper)', borderRadius: '12px',
            border: '1px solid var(--hair)', padding: '16px 18px',
            boxShadow: 'var(--shadow-sm)', marginBottom: '20px',
            display: 'flex', flexDirection: 'column', gap: '14px',
          }}>
            {activeTab === 'business' ? (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {BIZ_CATS.map(cat => (
                  <button
                    key={cat}
                    className={`filter-chip${bizCat === cat ? ' active' : ''}`}
                    onClick={() => { setBizCat(cat); setBizPage(1) }}
                  >
                    {cat === 'all' ? d.filterAll : d.categories[cat]}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {NGO_AREAS.map(area => (
                    <button
                      key={area}
                      className={`filter-chip${answerCategory === area ? ' active' : ''}`}
                      onClick={() => { setAnswerCategory(area); setAnswerPage(1) }}
                    >
                      {area === 'all' ? d.filterAll : d.ngoAreas[area]}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={answerRegion}
                    onChange={e => { setAnswerRegion(e.target.value); setAnswerPage(1) }}
                    placeholder={d.regionPH}
                    style={{
                      minWidth: '160px', flex: 1, padding: '10px 14px',
                      border: '1px solid var(--hair)', borderRadius: '8px',
                      fontSize: '14px', fontFamily: 'inherit',
                    }}
                  />
                  <input
                    type="text"
                    value={answerAudience}
                    onChange={e => { setAnswerAudience(e.target.value); setAnswerPage(1) }}
                    placeholder={d.audiencePH}
                    style={{
                      minWidth: '160px', flex: 1, padding: '10px 14px',
                      border: '1px solid var(--hair)', borderRadius: '8px',
                      fontSize: '14px', fontFamily: 'inherit',
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── RESULTS COUNT ─────────────────────────────────────────── */}
        {!error && (
          <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '16px', fontWeight: 500 }}>
            {loading ? t.common.loading : `${resultsCount} ${t.common.results}`}
          </div>
        )}

        {/* ── ERROR STATE (with Retry) ──────────────────────────────── */}
        {!loading && error && (
          <div className="dir-empty" role="alert">
            <Search size={28} aria-hidden="true" className="dir-empty-icon" />
            <h3 style={{ color: 'var(--ink)', margin: 0 }}>{d.loadError}</h3>
            <button className="btn btn-primary btn-sm" onClick={() => retry()} style={{ marginBlockStart: '12px' }}>
              {d.retry}
            </button>
          </div>
        )}

        {/* ── LOADING SKELETON ──────────────────────────────────────── */}
        {loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }} aria-hidden="true">
            {Array.from({ length: PER_PAGE }).map((_, i) => (
              <div key={i} className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                  <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 10 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-title" style={{ marginBottom: 8 }} />
                    <div className="skeleton skeleton-text" style={{ width: '50%' }} />
                  </div>
                </div>
                <div className="skeleton skeleton-text" />
                <div className="skeleton skeleton-text" style={{ width: '85%' }} />
                <div className="skeleton skeleton-text" style={{ width: '40%', marginBlockStart: 14, height: '2em' }} />
              </div>
            ))}
          </div>
        )}

        {/* ── BUSINESS RESULTS ──────────────────────────────────────── */}
        {!loading && !error && activeTab === 'business' && (
          <>
            {bizPageData.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {bizPageData.map(biz => (
                  <div key={biz.id} className="card card-interactive" style={{ padding: '24px' }}>
                    {biz.featured && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: 'var(--cream)', color: 'var(--ember)',
                        fontSize: '11px', fontWeight: 700, padding: '3px 10px',
                        borderRadius: '20px', marginBottom: '12px',
                      }}>
                        <Star size={10} fill="var(--ember)" /> {d.featured}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{
                        width: '52px', height: '52px', borderRadius: '10px',
                        background: biz.logoColor || 'var(--navy, #1f2a44)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Frank Ruhl Libre, serif', fontWeight: 900, fontSize: '20px', flexShrink: 0,
                      }}>
                        {biz.logo || L(biz.name).charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>{L(biz.name)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--gray-400)' }}>
                          <MapPin size={11} />
                          {d.categories[biz.category] || biz.category} • {L(biz.city)}
                        </div>
                      </div>
                    </div>
                    <p style={{ fontSize: '13.5px', color: 'var(--gray-500)', lineHeight: 1.65, marginBottom: '12px' }}>
                      {L(biz.description)}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      {L_arr(biz.tags).map(tag => (
                        <span key={tag} style={{
                          background: 'var(--gray-100)', color: 'var(--gray-600)',
                          padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px',
                        }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '14px' }}>
                      <Star size={13} fill="var(--ember)" color="var(--ember)" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{biz.rating}</span>
                      <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>({biz.reviews})</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <a href={`tel:${biz.phone}`} className="btn btn-outline btn-sm" style={{ flex: '1 1 140px', minWidth: 0, textDecoration: 'none', display: 'flex', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Phone size={13} /> {biz.phone}
                      </a>
                      <button className="btn btn-primary btn-sm" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>{d.moreBtn}</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dir-empty">
                <Search size={28} aria-hidden="true" className="dir-empty-icon" />
                <h3 style={{ color: 'var(--ink)', margin: 0 }}>{d.emptyBiz}</h3>
                <p style={{ color: 'var(--gray-500)', margin: 0 }}>{d.noResultsHint}</p>
              </div>
            )}
            <Pagination total={filteredBiz.length} perPage={PER_PAGE} current={bizPage} onChange={setBizPage} />
          </>
        )}

        {/* ── ANSWER RESULTS ────────────────────────────────────────── */}
        {!loading && !error && activeTab === 'ngo' && (
          <>
            {answerPageData.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {answerPageData.map(answer => {
                  const aTitle = L(answer.title)
                  const aRegion = L(answer.region)
                  const aAudience = L(answer.audience)
                  return (
                  <div key={answer.id} className="card card-interactive" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
                          {aTitle || d.questionFallback}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--gray-400)' }}>
                          {aRegion}{aRegion && aAudience ? ' • ' : ''}{aAudience}
                        </div>
                      </div>
                    </div>
                    <p style={{ fontSize: '13.5px', color: 'var(--gray-500)', lineHeight: 1.65, marginBottom: '14px' }}>
                      {L(answer.body)}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {answer.category && (
                        <span style={{
                          background: 'var(--gray-100)', color: 'var(--gray-600)',
                          padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px',
                        }}>
                          {answer.category === 'all' ? d.filterAll : d.ngoAreas[answer.category] || answer.category}
                        </span>
                      )}
                      {aRegion && (
                        <span style={{
                          background: 'var(--gray-100)', color: 'var(--gray-600)',
                          padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px',
                        }}>
                          {aRegion}
                        </span>
                      )}
                      {aAudience && (
                        <span style={{
                          background: 'var(--gray-100)', color: 'var(--gray-600)',
                          padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px',
                        }}>
                          {aAudience}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-navy btn-sm" style={{ flex: 1 }}>{d.moreBtn}</button>
                    </div>
                  </div>
                  )
                })}
              </div>
            ) : (
              <div className="dir-empty">
                <Search size={28} aria-hidden="true" className="dir-empty-icon" />
                <h3 style={{ color: 'var(--ink)', margin: 0 }}>{d.emptyAnswers}</h3>
                <p style={{ color: 'var(--gray-500)', margin: 0 }}>{d.noResultsHint}</p>
              </div>
            )}
            <Pagination total={filteredAnswers.length} perPage={PER_PAGE} current={answerPage} onChange={setAnswerPage} />
          </>
        )}
      </div>

      {/* Business Registration Modal */}
      {showRegForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRegForm(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)' }}>
                {d.registerNew}
              </h3>
              <button onClick={() => setShowRegForm(false)} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>✕</button>
            </div>
            <div className="modal-body">
              {['business_name', 'owner_name', 'phone', 'category', 'city', 'desc'].map(field => (
                <div className="form-group" key={field}>
                  <label className="form-label">
                    {d.fields[field]}
                  </label>
                  {field === 'desc' ? (
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={registerForm.desc}
                      onChange={(e) => updateRegisterField('desc', e.target.value)}
                    />
                  ) : field === 'category' ? (
                    <select
                      className="form-select"
                      value={registerForm.category}
                      onChange={(e) => updateRegisterField('category', e.target.value)}
                    >
                      {Object.entries(d.categories).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="form-input"
                      type={field === 'phone' ? 'tel' : 'text'}
                      value={registerForm[field]}
                      onChange={(e) => updateRegisterField(field, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowRegForm(false)}>{t.common.cancel}</button>
              <button className="btn btn-primary" onClick={handleRegisterSubmit} disabled={registerSubmitting}>
                {registerSubmitting ? t.common.loading : d.submitApproval}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
