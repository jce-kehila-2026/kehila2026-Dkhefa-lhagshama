import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle, XCircle, MessageSquare, RefreshCw,
  Building2, Users, BookOpen, LogIn, LogOut,
  Clock, AlertCircle,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { useApp } from '../contexts/AppContext'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

const ENTITY_META = {
  businesses:    { Icon: Building2, bg: '#EBF3FF', color: '#1A5EA0' },
  organizations: { Icon: Users,     bg: '#E8F5EC', color: '#15803D' },
  answers:       { Icon: BookOpen,  bg: '#FBF0C8', color: '#7C5F00' },
}

const MOCK_PENDING = [
  {
    id: 'mock-biz-1', entityType: 'businesses', status: 'pending',
    name: 'מסעדת אביב האתיופית | Aviv Ethiopian Kitchen',
    submittedBy: 'u_aBc123', submittedAt: { _seconds: 1746873600 }, city: 'תל אביב',
  },
  {
    id: 'mock-org-1', entityType: 'organizations', status: 'pending',
    name: 'עמותת יד לאחי | Hand to My Brother NGO',
    submittedBy: 'u_dEf456', submittedAt: { _seconds: 1747046400 }, area: 'education',
  },
  {
    id: 'mock-ans-1', entityType: 'answers', status: 'pending',
    name: 'מלגות לסטודנטים אתיופים | Ethiopian Student Scholarships Fund',
    submittedBy: 'u_gHi789', submittedAt: { _seconds: 1747219200 }, category: 'education',
  },
  {
    id: 'mock-biz-2', entityType: 'businesses', status: 'pending',
    name: 'סטודיו למוסיקה אתיופית | Ethiopian Music Studio',
    submittedBy: 'u_jKl101', submittedAt: { _seconds: 1747305600 }, city: 'חיפה',
  },
]

function formatDate(ts, lang) {
  if (!ts) return '—'
  const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts)
  return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function AdminPage() {
  const { lang, isRTL } = useLanguage()
  const { user, role, loading: authLoading, login, logout } = useAuth()
  const { toast } = useApp()

  // Login form
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Queue
  const [items, setItems]         = useState([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [filter, setFilter]       = useState('all')
  // actionState: { [itemId]: { pending, mode: 'reject'|'request_changes'|null, note } }
  const [actionState, setActionState] = useState({})

  const fetchPending = useCallback(async () => {
    setQueueLoading(true)
    try {
      const token = user ? await user.getIdToken() : null
      if (!token) { setItems(MOCK_PENDING); return }
      const res = await fetch(`${API_BASE}/api/admin/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const { items: fetched } = await res.json()
        setItems(fetched)
      } else {
        setItems(MOCK_PENDING)
      }
    } catch {
      setItems(MOCK_PENDING)
    } finally {
      setQueueLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (role === 'admin') fetchPending()
  }, [role, fetchPending])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await login(email, password)
    } catch {
      setLoginError(lang === 'he' ? 'אימייל או סיסמה שגויים' : 'Invalid email or password')
    } finally {
      setLoginLoading(false)
    }
  }

  const callAction = async (itemId, entityType, action, note = '') => {
    setActionState(s => ({ ...s, [itemId]: { ...s[itemId], pending: true } }))
    try {
      const token = user ? await user.getIdToken() : null
      if (token) {
        const endpoint = action.replace('_', '-')
        const res = await fetch(`${API_BASE}/api/admin/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            entityType,
            entityId: itemId,
            ...(note ? { note } : {}),
          }),
        })
        if (!res.ok) throw new Error('api_error')
      }
      setItems(prev => prev.filter(i => i.id !== itemId))
      const msgs = {
        approve:         lang === 'he' ? 'אושר בהצלחה!' : 'Approved successfully!',
        reject:          lang === 'he' ? 'נדחה'          : 'Rejected',
        request_changes: lang === 'he' ? 'בקשת שינויים נשלחה' : 'Changes requested',
      }
      toast(msgs[action] ?? '', 'success')
    } catch {
      toast(lang === 'he' ? 'שגיאה — נסה שוב' : 'Error — please try again', 'error')
    } finally {
      setActionState(s => { const n = { ...s }; delete n[itemId]; return n })
    }
  }

  const startMode  = (id, mode) =>
    setActionState(s => ({ ...s, [id]: { pending: false, mode, note: '' } }))
  const cancelMode = (id) =>
    setActionState(s => { const n = { ...s }; delete n[id]; return n })
  const setNote    = (id, note) =>
    setActionState(s => ({ ...s, [id]: { ...s[id], note } }))

  const counts = {
    all:           items.length,
    businesses:    items.filter(i => i.entityType === 'businesses').length,
    organizations: items.filter(i => i.entityType === 'organizations').length,
    answers:       items.filter(i => i.entityType === 'answers').length,
  }
  const filteredItems = filter === 'all' ? items : items.filter(i => i.entityType === filter)

  // ── AUTH LOADING ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <>
        <PageHeader title={lang === 'he' ? 'לוח ניהול' : 'Admin Dashboard'} subtitle="" />
        <div className="page-container" style={{ padding: '80px 1.5rem', textAlign: 'center' }}>
          <span style={{ color: 'var(--gray-400)', fontSize: '15px' }}>
            {lang === 'he' ? 'טוען...' : 'Loading...'}
          </span>
        </div>
      </>
    )
  }

  // ── LOGIN FORM ────────────────────────────────────────────────
  if (!user) {
    return (
      <>
        <PageHeader
          title={lang === 'he' ? 'לוח ניהול' : 'Admin Dashboard'}
          subtitle={lang === 'he' ? 'התחבר כדי לגשת לתור האישורים' : 'Sign in to access the approval queue'}
        />
        <div className="page-container" style={{ maxWidth: '420px', padding: '56px 1.5rem' }}>
          <form onSubmit={handleLogin} className="card" style={{ padding: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '10px',
                background: 'var(--gold-pale)', color: 'var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <LogIn size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy)' }}>
                  {lang === 'he' ? 'התחברות מנהל' : 'Admin Sign In'}
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--gray-400)', marginTop: '2px' }}>
                  {lang === 'he' ? 'הכנס פרטי חשבון מנהל' : 'Enter your admin account credentials'}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">{lang === 'he' ? 'דואר אלקטרוני' : 'Email'}</label>
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="form-input"
                placeholder="admin@example.com"
                dir="ltr"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="form-label">{lang === 'he' ? 'סיסמה' : 'Password'}</label>
              <input
                type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            {loginError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: '#FFF1F1', border: '1px solid #FFCDD2',
                borderRadius: '7px', padding: '10px 13px', marginBottom: '16px',
                color: '#C62828', fontSize: '13.5px',
              }}>
                <AlertCircle size={15} />
                {loginError}
              </div>
            )}

            <button type="submit" className="btn btn-navy btn-full" disabled={loginLoading}>
              {loginLoading
                ? (lang === 'he' ? 'מתחבר...' : 'Signing in...')
                : (lang === 'he' ? 'התחבר' : 'Sign In')}
            </button>
          </form>
        </div>
      </>
    )
  }

  // ── ACCESS DENIED ─────────────────────────────────────────────
  if (role !== 'admin') {
    return (
      <>
        <PageHeader title={lang === 'he' ? 'לוח ניהול' : 'Admin Dashboard'} subtitle="" />
        <div className="page-container" style={{ maxWidth: '500px', padding: '56px 1.5rem' }}>
          <div className="card" style={{ padding: '48px 40px', textAlign: 'center' }}>
            <XCircle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '10px' }}>
              {lang === 'he' ? 'גישה נדחתה' : 'Access Denied'}
            </h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '14.5px', marginBottom: '28px' }}>
              {lang === 'he'
                ? 'אין לך הרשאת מנהל לגשת לדף זה.'
                : 'You do not have admin permission to access this page.'}
            </p>
            <button className="btn btn-outline" onClick={logout} style={{ display: 'inline-flex', gap: '6px' }}>
              <LogOut size={15} />
              {lang === 'he' ? 'התנתק' : 'Sign Out'}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── FILTER TABS ───────────────────────────────────────────────
  const TABS = [
    { key: 'all',           label: lang === 'he' ? `הכל (${counts.all})` : `All (${counts.all})` },
    { key: 'businesses',    label: lang === 'he' ? `עסקים (${counts.businesses})` : `Businesses (${counts.businesses})` },
    { key: 'organizations', label: lang === 'he' ? `ארגונים (${counts.organizations})` : `Organizations (${counts.organizations})` },
    { key: 'answers',       label: lang === 'he' ? `תשובות (${counts.answers})` : `Answers (${counts.answers})` },
  ]

  // ── APPROVAL QUEUE ────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title={lang === 'he' ? 'תור אישורים' : 'Approval Queue'}
        subtitle={lang === 'he' ? 'סקירה ואישור הגשות ממתינות' : 'Review and approve pending submissions'}
      />
      <div className="page-container" style={{ padding: '36px 1.5rem 72px' }}>

        {/* TOOLBAR */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '22px', flexWrap: 'wrap', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--gold)" />
            <span style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
              {counts.all} {lang === 'he' ? 'ממתינים לאישור' : 'pending for approval'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={fetchPending}
              disabled={queueLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <RefreshCw size={13} />
              {queueLoading
                ? (lang === 'he' ? 'טוען...' : 'Loading...')
                : (lang === 'he' ? 'רענן' : 'Refresh')}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <LogOut size={13} />
              {lang === 'he' ? 'התנתק' : 'Sign Out'}
            </button>
          </div>
        </div>

        {/* FILTER CHIPS */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '22px' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`filter-chip${filter === tab.key ? ' active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* LOADING */}
        {queueLoading && (
          <div style={{ textAlign: 'center', padding: '72px', color: 'var(--gray-400)', fontSize: '15px' }}>
            {lang === 'he' ? 'טוען...' : 'Loading...'}
          </div>
        )}

        {/* EMPTY STATE */}
        {!queueLoading && filteredItems.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '72px 40px',
            background: 'var(--white)', borderRadius: 'var(--radius)',
            border: '1.5px dashed var(--gray-200)',
          }}>
            <CheckCircle size={42} color="var(--gray-300)" style={{ marginBottom: '14px' }} />
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
              {lang === 'he' ? 'אין הגשות ממתינות' : 'No Pending Submissions'}
            </h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '14px' }}>
              {lang === 'he' ? 'כל ההגשות טופלו. כל הכבוד!' : 'All submissions have been handled. Great job!'}
            </p>
          </div>
        )}

        {/* ITEM CARDS */}
        {!queueLoading && filteredItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredItems.map(item => {
              const meta = ENTITY_META[item.entityType] ?? ENTITY_META.businesses
              const { Icon } = meta
              const state = actionState[item.id]
              const isPending = state?.pending

              const entityLabel = lang === 'he'
                ? (item.entityType === 'businesses' ? 'עסק'
                  : item.entityType === 'organizations' ? 'ארגון' : 'תשובה')
                : (item.entityType === 'businesses' ? 'Business'
                  : item.entityType === 'organizations' ? 'Organization' : 'Answer')

              return (
                <div
                  key={item.id}
                  className="card"
                  style={{ padding: '22px 24px', transition: 'none' }}
                >
                  {/* TOP ROW */}
                  <div style={{
                    display: 'flex', alignItems: 'flex-start',
                    gap: '14px', flexWrap: 'wrap',
                  }}>
                    {/* Type icon */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                      background: meta.bg, color: meta.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={20} />
                    </div>

                    {/* Info block */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: '12px',
                          fontSize: '11.5px', fontWeight: 600,
                          background: meta.bg, color: meta.color,
                        }}>
                          {entityLabel}
                        </span>
                        <span className="badge badge-pending">
                          {lang === 'he' ? 'ממתין' : 'Pending'}
                        </span>
                      </div>
                      <h3 style={{
                        fontSize: '15.5px', fontWeight: 700, color: 'var(--navy)',
                        marginBottom: '6px', lineHeight: 1.35,
                      }}>
                        {item.name || item.title || (lang === 'he' ? 'ללא שם' : 'Untitled')}
                      </h3>
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--gray-400)' }}>
                          {lang === 'he' ? 'מגיש:' : 'By:'}{' '}
                          <code style={{
                            fontSize: '11.5px', background: 'var(--gray-100)',
                            padding: '1px 5px', borderRadius: '4px',
                          }}>
                            {item.submittedBy || '—'}
                          </code>
                        </span>
                        <span style={{ fontSize: '12.5px', color: 'var(--gray-400)' }}>
                          {lang === 'he' ? 'תאריך:' : 'Date:'}{' '}
                          {formatDate(item.submittedAt, lang)}
                        </span>
                        {item.city && (
                          <span style={{ fontSize: '12.5px', color: 'var(--gray-400)' }}>
                            📍 {item.city}
                          </span>
                        )}
                        {(item.area || item.category) && (
                          <span style={{ fontSize: '12.5px', color: 'var(--gray-400)' }}>
                            🏷 {item.area || item.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (hidden while in note mode) */}
                    {!state?.mode && (
                      <div style={{ display: 'flex', gap: '7px', flexShrink: 0, flexWrap: 'wrap' }}>
                        <button
                          disabled={isPending}
                          onClick={() => callAction(item.id, item.entityType, 'approve')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '7px 14px', borderRadius: '7px', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                            background: '#E8F5EC', color: '#15803D',
                            border: '1.5px solid #86EFAC',
                            opacity: isPending ? 0.55 : 1,
                          }}
                        >
                          <CheckCircle size={14} />
                          {lang === 'he' ? 'אשר' : 'Approve'}
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => startMode(item.id, 'request_changes')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '7px 14px', borderRadius: '7px', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                            background: '#FFF8E1', color: '#B45309',
                            border: '1.5px solid #FCD34D',
                            opacity: isPending ? 0.55 : 1,
                          }}
                        >
                          <MessageSquare size={14} />
                          {lang === 'he' ? 'בקש שינויים' : 'Request Changes'}
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => startMode(item.id, 'reject')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '7px 14px', borderRadius: '7px', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                            background: '#FFF1F1', color: '#C62828',
                            border: '1.5px solid #FFCDD2',
                            opacity: isPending ? 0.55 : 1,
                          }}
                        >
                          <XCircle size={14} />
                          {lang === 'he' ? 'דחה' : 'Reject'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* NOTE INPUT (shown when in reject / request-changes mode) */}
                  {state?.mode && (
                    <div style={{
                      marginTop: '16px', paddingTop: '16px',
                      borderTop: '1px solid var(--gray-200)',
                    }}>
                      <div style={{
                        fontSize: '13px', fontWeight: 600,
                        color: 'var(--navy)', marginBottom: '8px',
                      }}>
                        {state.mode === 'reject'
                          ? (lang === 'he' ? 'סיבת דחייה (אופציונלי)' : 'Rejection reason (optional)')
                          : (lang === 'he' ? 'מה יש לשנות? (אופציונלי)' : 'What needs to change? (optional)')}
                      </div>
                      <textarea
                        value={state.note}
                        onChange={e => setNote(item.id, e.target.value)}
                        placeholder={lang === 'he' ? 'הוסף הערה...' : 'Add a note...'}
                        rows={2}
                        className="form-textarea"
                        style={{ marginBottom: '10px', minHeight: 'unset', direction: isRTL ? 'rtl' : 'ltr' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-navy btn-sm"
                          disabled={isPending}
                          onClick={() => callAction(item.id, item.entityType, state.mode, state.note)}
                        >
                          {isPending
                            ? '...'
                            : (lang === 'he' ? 'אשר' : 'Confirm')}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={isPending}
                          onClick={() => cancelMode(item.id)}
                        >
                          {lang === 'he' ? 'ביטול' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
