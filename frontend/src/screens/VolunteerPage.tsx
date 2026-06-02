import Link from 'next/link'
import { MapPin, Clock, HeartHandshake, Users, Sparkles, ArrowLeft, MessagesSquare } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import Reveal from '../components/motion/Reveal'

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace'
const SERIF = 'Frank Ruhl Libre, Georgia, serif'

export default function VolunteerPage() {
  const { t, lang, isRTL } = useLanguage()
  const { volunteers } = useApp()
  const { hasRole } = useAuth()
  const v = t.volunteers

  // Volunteers and admins (admin satisfies any role) see the team panel;
  // logged-out visitors and beneficiaries see the info + apply CTA.
  const isTeamMember = hasRole('volunteer')

  const STATUS_COLORS: Record<string, string> = { available: 'var(--success)', assigned: 'var(--ember)' }
  const availableCount = volunteers.filter(vol => vol.status === 'available').length

  // Directional arrow for CTAs (points "forward" in the reading direction).
  const DirArrow = isRTL
    ? <ArrowLeft size={18} aria-hidden="true" />
    : <ArrowLeft size={18} aria-hidden="true" style={{ transform: 'scaleX(-1)' }} />

  return (
    <main>
      {/* ── COMPACT INLINE HEADER — eyebrow → serif title → lede (start-aligned) ── */}
      <section className="vol-header">
        <div className="page-container vol-header-container">
          <Reveal>
            <div className="vol-header-inner">
              <span className="eyebrow vol-header-eyebrow">{v.inlineHeader.eyebrow}</span>
              <h1 className="section-display-bold vol-header-title">{v.inlineHeader.title}</h1>
              <p className="section-lede vol-header-lede">{v.inlineHeader.lede}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-padding" style={{ background: 'var(--paper)' }}>
        <div className="page-container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 'clamp(32px, 5vw, 56px)',
              alignItems: 'start',
            }}
          >

            {/* ── ROLE-ADAPTIVE PANEL ─────────────────────────────────────
                 logged-out / beneficiary → info + "Apply to volunteer" CTA
                 volunteer / admin        → "you're part of the team" panel */}
            <Reveal>
              <div>
                {isTeamMember ? (
                  <>
                    <span className="eyebrow" style={{ color: 'var(--ember)', display: 'block', marginBlockEnd: '12px' }}>
                      {lang === 'he' ? 'הצוות שלנו' : 'Our team'}
                    </span>
                    <div
                      className="card"
                      style={{
                        padding: 'clamp(28px, 4vw, 44px) clamp(24px, 4vw, 36px)',
                        border: '1px solid var(--hair)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div
                        style={{
                          width: '64px', height: '64px',
                          background: 'var(--ember-soft)',
                          borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginBlockEnd: '20px',
                        }}
                        aria-hidden="true"
                      >
                        <HeartHandshake size={30} color="var(--ember)" strokeWidth={2} />
                      </div>
                      <h2
                        className="section-display-bold"
                        style={{ marginBlockEnd: '12px', fontSize: 'var(--fs-h2)' }}
                      >
                        {v.memberTitle}
                      </h2>
                      <p
                        style={{
                          color: 'var(--gray-600)', lineHeight: 1.7,
                          margin: '0 0 28px', fontSize: 'var(--fs-body)', maxWidth: '34rem',
                        }}
                      >
                        {v.memberBlurb}
                      </p>
                      <Link href="/chats" className="btn btn-ember btn-lg">
                        <MessagesSquare size={18} aria-hidden="true" /> {v.goToChats}
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="eyebrow" style={{ color: 'var(--ember)', display: 'block', marginBlockEnd: '12px' }}>
                      {lang === 'he' ? 'הצטרפו אלינו' : 'Join us'}
                    </span>
                    <h2 className="section-display-bold" style={{ marginBlockEnd: '10px', fontSize: 'var(--fs-h2)' }}>
                      {v.registerTitle}
                    </h2>
                    <p className="section-lede" style={{ margin: '0 0 24px', fontSize: 'var(--fs-body)', maxWidth: '34rem' }}>
                      {v.registerSub}
                    </p>

                    <div
                      className="card"
                      style={{
                        padding: 'clamp(28px, 4vw, 44px) clamp(24px, 4vw, 36px)',
                        border: '1px solid var(--hair)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* What volunteering involves — informational chips */}
                      <span
                        className="eyebrow"
                        style={{ color: 'var(--gray-500)', display: 'block', marginBlockEnd: '12px' }}
                      >
                        {v.form.areas}
                      </span>
                      <ul
                        style={{
                          listStyle: 'none', margin: '0 0 28px', padding: 0,
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
                        }}
                      >
                        {v.form.areasList.map(area => (
                          <li
                            key={area}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--hair)', background: 'var(--white)',
                              color: 'var(--gray-700)', fontWeight: 500,
                              fontSize: 'var(--fs-sm)', textAlign: 'start',
                            }}
                          >
                            <span
                              style={{
                                width: '7px', height: '7px', borderRadius: '50%',
                                background: 'var(--ember)', flexShrink: 0,
                              }}
                              aria-hidden="true"
                            />
                            {area}
                          </li>
                        ))}
                      </ul>

                      <Link href="/register?role=volunteer" className="btn btn-ember btn-full btn-lg">
                        {v.applyCta} {DirArrow}
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </Reveal>

            {/* ── ACTIVE VOLUNTEERS LIST (informational, read-only) ──────── */}
            <Reveal delay={0.1}>
              <div>
                <span className="eyebrow" style={{ color: 'var(--ember)', display: 'block', marginBlockEnd: '12px' }}>
                  {lang === 'he' ? 'הקהילה שלנו' : 'Our community'}
                </span>
                <h2 className="section-display-bold" style={{ marginBlockEnd: '10px', fontSize: 'var(--fs-h2)' }}>
                  {v.activeTitle}
                </h2>
                <p className="section-lede" style={{ margin: '0 0 24px', fontSize: 'var(--fs-body)' }}>
                  {volunteers.length}+ {v.activeSub}
                </p>

                {/* Summary strip */}
                <div
                  style={{
                    display: 'flex', flexWrap: 'wrap', gap: '24px',
                    padding: '18px 20px', marginBlockEnd: '20px',
                    background: 'var(--sky-3)', borderRadius: 'var(--radius)',
                    border: '1px solid var(--hair)',
                  }}
                >
                  {[
                    { icon: <Users size={18} />, num: volunteers.length, label: lang === 'he' ? 'מתנדבים פעילים' : 'Active volunteers' },
                    { icon: <Sparkles size={18} />, num: availableCount, label: lang === 'he' ? 'זמינים כעת' : 'Available now' },
                  ].map((stat, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          width: '40px', height: '40px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--white)', color: 'var(--ember)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid var(--hair)', flexShrink: 0,
                        }}
                        aria-hidden="true"
                      >
                        {stat.icon}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontFamily: SERIF, fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
                          {stat.num}
                        </span>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--gray-600)', fontFamily: MONO, letterSpacing: '0.04em', textTransform: 'uppercase', marginBlockStart: '4px' }}>
                          {stat.label}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                {volunteers.length === 0 ? (
                  <div
                    className="card"
                    style={{
                      padding: '40px 32px', textAlign: 'center',
                      border: '1px dashed var(--line)', boxShadow: 'none', background: 'var(--white)',
                    }}
                  >
                    <div
                      style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: 'var(--ember-soft)', color: 'var(--ember)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                      }}
                      aria-hidden="true"
                    >
                      <HeartHandshake size={26} />
                    </div>
                    <p style={{ color: 'var(--gray-600)', lineHeight: 1.6, margin: 0 }}>
                      {lang === 'he' ? 'עדיין אין מתנדבים רשומים — היו הראשונים להצטרף.' : 'No volunteers yet — be the first to join.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {volunteers.map(vol => {
                      const isAvailable = vol.status === 'available'
                      const statusColor = STATUS_COLORS[vol.status ?? ''] || 'var(--gray-400)'
                      return (
                        <div
                          key={vol.id}
                          className="card"
                          style={{
                            background: 'var(--white)', borderRadius: 'var(--radius)',
                            border: '1px solid var(--hair)',
                            boxShadow: 'var(--shadow-xs)',
                            padding: '18px 20px',
                            display: 'grid', gridTemplateColumns: '52px 1fr auto',
                            gap: '16px', alignItems: 'center',
                          }}
                        >
                          {/* Avatar */}
                          <div
                            style={{
                              width: '52px', height: '52px', borderRadius: '50%',
                              background: 'var(--ink)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: SERIF, fontWeight: 700,
                              color: 'var(--cream)', fontSize: '17px',
                            }}
                            aria-hidden="true"
                          >
                            {vol.initials}
                          </div>
                          {/* Info */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--ink)', marginBlockEnd: '3px' }}>
                              {lang === 'he' ? vol.name : vol.nameEn}
                            </div>
                            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--gray-600)', marginBlockEnd: '8px' }}>
                              {lang === 'he' ? vol.profession : vol.professionEn}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', fontSize: 'var(--fs-xs)', color: 'var(--gray-500)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <MapPin size={12} aria-hidden="true" />
                                {lang === 'he' ? vol.city : vol.cityEn}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Clock size={12} aria-hidden="true" />
                                {lang === 'he' ? vol.availability : vol.availabilityEn}
                              </span>
                            </div>
                          </div>
                          {/* Status pill */}
                          <span
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '7px',
                              padding: '6px 12px', borderRadius: '999px',
                              fontSize: 'var(--fs-xs)', fontWeight: 600,
                              fontFamily: MONO, letterSpacing: '0.03em',
                              color: statusColor,
                              background: isAvailable ? 'var(--success-soft)' : 'var(--ember-soft)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span
                              style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: statusColor, flexShrink: 0,
                              }}
                              aria-hidden="true"
                            />
                            {isAvailable ? v.available : (lang === 'he' ? 'משויך' : 'Assigned')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  )
}
