import Link from 'next/link'
import { MapPin, Clock, HeartHandshake, Users, Sparkles, ArrowLeft, MessagesSquare } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import Reveal from '../components/motion/Reveal'

export default function VolunteerPage() {
  const { t, lang, isRTL } = useLanguage()
  const { volunteers } = useApp()
  const { hasRole } = useAuth()
  const v = t.volunteers

  // Volunteers and admins (admin satisfies any role) see the team panel;
  // logged-out visitors and beneficiaries see the info + apply CTA.
  const isTeamMember = hasRole('volunteer')

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

      <section className="section-padding vol-body">
        <div className="page-container">
          <div className="vol-grid">

            {/* ── ROLE-ADAPTIVE PANEL ─────────────────────────────────────
                 logged-out / beneficiary → info + "Apply to volunteer" CTA
                 volunteer / admin        → "you're part of the team" panel */}
            <Reveal>
              <div>
                {isTeamMember ? (
                  <div className="card vol-panel">
                    <div className="vol-emblem" aria-hidden="true">
                      <HeartHandshake size={30} color="var(--ember)" strokeWidth={2} />
                    </div>
                    <h2 className="section-display-bold vol-panel-title">
                      {v.memberTitle}
                    </h2>
                    <p className="vol-panel-blurb">
                      {v.memberBlurb}
                    </p>
                    <Link href="/chats" className="btn btn-ember btn-lg">
                      <MessagesSquare size={18} aria-hidden="true" /> {v.goToChats}
                    </Link>
                  </div>
                ) : (
                  <>
                    <h2 className="section-display-bold vol-col-title">
                      {v.registerTitle}
                    </h2>
                    <p className="section-lede vol-col-lede">
                      {v.registerSub}
                    </p>

                    <div className="card vol-panel">
                      {/* What volunteering involves — informational chips */}
                      <span className="eyebrow vol-areas-label">
                        {v.form.areas}
                      </span>
                      <ul className="vol-areas">
                        {v.form.areasList.map(area => (
                          <li key={area} className="vol-area">
                            <span className="vol-area-dot" aria-hidden="true" />
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
                <h2 className="section-display-bold vol-col-title">
                  {v.activeTitle}
                </h2>
                <p className="section-lede vol-col-lede">
                  {volunteers.length}+ {v.activeSub}
                </p>

                {/* Summary strip */}
                <div className="vol-summary">
                  {[
                    { icon: <Users size={18} />, num: volunteers.length, label: lang === 'he' ? 'מתנדבים פעילים' : 'Active volunteers' },
                    { icon: <Sparkles size={18} />, num: availableCount, label: lang === 'he' ? 'זמינים כעת' : 'Available now' },
                  ].map((stat, i) => (
                    <div key={i} className="vol-stat">
                      <span className="vol-stat-icon" aria-hidden="true">
                        {stat.icon}
                      </span>
                      <span className="vol-stat-text">
                        <span className="vol-stat-num">{stat.num}</span>
                        <span className="vol-stat-label">{stat.label}</span>
                      </span>
                    </div>
                  ))}
                </div>

                {volunteers.length === 0 ? (
                  <div className="card vol-empty">
                    <div className="vol-empty-emblem" aria-hidden="true">
                      <HeartHandshake size={26} />
                    </div>
                    <p className="vol-empty-text">
                      {lang === 'he' ? 'עדיין אין מתנדבים רשומים. היו הראשונים להצטרף.' : 'No volunteers yet. Be the first to join.'}
                    </p>
                  </div>
                ) : (
                  <div className="vol-list" role="list">
                    {volunteers.map(vol => {
                      const isAvailable = vol.status === 'available'
                      return (
                        <div key={vol.id} className="card vol-row" role="listitem">
                          {/* Avatar */}
                          <div className="vol-avatar" aria-hidden="true">
                            {vol.initials}
                          </div>
                          {/* Info */}
                          <div className="vol-row-info">
                            <div className="vol-row-name">
                              {lang === 'he' ? vol.name : vol.nameEn}
                            </div>
                            <div className="vol-row-prof">
                              {lang === 'he' ? vol.profession : vol.professionEn}
                            </div>
                            <div className="vol-row-meta">
                              <span className="vol-meta-item">
                                <MapPin size={12} aria-hidden="true" />
                                {lang === 'he' ? vol.city : vol.cityEn}
                              </span>
                              <span className="vol-meta-item">
                                <Clock size={12} aria-hidden="true" />
                                {lang === 'he' ? vol.availability : vol.availabilityEn}
                              </span>
                            </div>
                          </div>
                          {/* Status pill */}
                          <span className={`vol-status ${isAvailable ? 'vol-status-available' : 'vol-status-assigned'}`}>
                            <span className="vol-status-dot" aria-hidden="true" />
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
