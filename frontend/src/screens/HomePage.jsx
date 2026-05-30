import { useRouter } from 'next/router'
import { ArrowLeft, ArrowRight, GraduationCap, Briefcase, Scale, Users, Star, CheckCircle, Phone } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { mockStories, mockStats, mockNGOs } from '../data/mockData'
import StatCard from '../components/StatCard'
import AssetImage from '../components/AssetImage'

const useNavigate = () => {
  const router = useRouter()
  return (to) => router.push(to)
}

const SERVICE_ICONS = {
  education:  <GraduationCap size={24} />,
  employment: <Briefcase size={24} />,
  legal:      <Scale size={24} />,
  social:     <Users size={24} />,
}

export default function HomePage() {
  const { t, isRTL, lang } = useLanguage()
  const navigate = useNavigate()
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight

  const serviceEntries = Object.entries(t.services.items)
  const [featuredKey, featured] = serviceEntries[0]
  const restServices = serviceEntries.slice(1)

  return (
    <main>
      {/* ── HERO — asymmetric: copy leads, portrait anchors the start side ── */}
      <section
        className="hero-pattern"
        style={{ background: 'var(--sky-2)', position: 'relative', overflow: 'hidden' }}
      >
        <div className="page-container" style={{ position: 'relative', zIndex: 1, paddingBlock: 'clamp(48px, 7vw, 84px)' }}>
          <div className="hero-grid">
            <div className="hero-mark">
              <AssetImage
                slot="hero"
                rounded="var(--radius-xl)"
                ratio="4 / 5"
                priority
                shadow="var(--shadow-xl)"
                border="1px solid rgba(255,255,255,0.6)"
                style={{ width: 'min(360px, 78vw)' }}
              />
            </div>

            <div className="hero-copy">
              <span className="eyebrow" style={{ color: 'var(--ink-2)' }}>{t.hero.badge}</span>
              <h1
                style={{
                  fontFamily: 'Frank Ruhl Libre, Georgia, serif',
                  fontSize: 'var(--fs-hero)',
                  lineHeight: 1.08,
                  letterSpacing: '-0.015em',
                  fontWeight: 400,
                  color: 'var(--ink)',
                  margin: '0 0 18px',
                  textWrap: 'balance',
                }}
              >
                {t.hero.title1}{' '}
                <em style={{ fontStyle: 'italic', color: 'var(--ember)' }}>{t.hero.titleHighlight}</em>{' '}
                {t.hero.title2}
              </h1>
              <p className="section-lede" style={{ margin: '0 0 28px' }}>{t.hero.subtitle}</p>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-ember btn-lg" onClick={() => navigate('/requests')}>
                  {t.hero.cta}
                  <ArrowIcon size={16} />
                </button>
                <button
                  className="btn btn-outline btn-lg"
                  onClick={() => document.getElementById('services-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  {t.hero.ctaSecondary}
                </button>
              </div>

              {/* Inline stat strip — woven into the hero, not a separate metric band */}
              <dl
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'clamp(20px, 4vw, 40px)',
                  margin: '36px 0 0',
                  paddingBlockStart: '24px',
                  borderBlockStart: '1px solid var(--hair)',
                }}
              >
                {[
                  { num: mockStats.beneficiaries, suffix: '',  label: t.hero.stats.beneficiaries },
                  { num: mockStats.volunteers,    suffix: '+', label: t.hero.stats.volunteers },
                  { num: mockStats.satisfaction,  suffix: '%', label: t.hero.stats.satisfaction },
                  { num: mockStats.yearsActive,   suffix: '',  label: t.hero.stats.years },
                ].map((s, i) => (
                  <div key={i}>
                    <dd style={{ margin: 0, fontFamily: 'Frank Ruhl Libre, serif', fontSize: '1.9rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
                      <StatCard num={s.num} suffix={s.suffix} delay={i * 120} />
                    </dd>
                    <dt
                      style={{
                        fontSize: '12px', color: 'var(--ink-2)', marginBlockStart: '6px', lineHeight: 1.3,
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}
                    >
                      {s.label}
                    </dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES — featured-first, NOT an identical 4-up grid ──────────── */}
      <section id="services-section" className="section-padding" style={{ background: 'var(--paper)' }}>
        <div className="page-container">
          <header style={{ maxWidth: '46rem', marginBlockEnd: '40px' }}>
            <h2 className="section-display" style={{ margin: '0 0 14px' }}>{t.services.title}</h2>
            <p className="section-lede" style={{ margin: 0 }}>{t.services.subtitle}</p>
          </header>

          <div className="services-layout">
            {/* Lead service — large, with the call to act */}
            <button
              type="button"
              className="card card-interactive service-feature"
              onClick={() => navigate('/requests')}
            >
              <div className="service-icon service-icon-lead">{SERVICE_ICONS[featuredKey]}</div>
              <h3 className="service-feature-title">{featured.title}</h3>
              <p className="service-feature-desc">{featured.desc}</p>
              <span className="service-cta">
                {lang === 'he' ? 'הגשת בקשה' : 'Start a request'}
                <ArrowIcon size={15} />
              </span>
            </button>

            {/* Remaining services — compact rows, distinct rhythm from the feature */}
            <div className="service-rows">
              {restServices.map(([key, svc]) => (
                <button
                  key={key}
                  type="button"
                  className="service-row"
                  onClick={() => navigate('/requests')}
                >
                  <span className="service-icon">{SERVICE_ICONS[key]}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="service-row-title">{svc.title}</span>
                    <span className="service-row-desc">{svc.desc}</span>
                  </span>
                  <ArrowIcon size={16} className="service-row-arrow" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── COMMUNITY IMPACT — text + image, generous, no card ─────────────── */}
      <section style={{ background: 'var(--cream)', paddingBlock: 'clamp(56px, 8vw, 96px)' }}>
        <div
          className="page-container impact-grid"
        >
          <div>
            <h2 className="section-display" style={{ margin: '0 0 16px' }}>{t.home.impactTitle}</h2>
            <p className="section-lede" style={{ margin: 0 }}>{t.home.impactBody}</p>
          </div>
          <AssetImage
            slot="communityImpact"
            ratio="4 / 3"
            rounded="var(--radius-lg)"
            shadow="var(--shadow)"
            border="1px solid var(--hair)"
          />
        </div>
      </section>

      {/* ── SUCCESS STORIES — dark editorial colophon ─────────────────────── */}
      <section className="section-padding" style={{ background: 'var(--ink)' }}>
        <div className="page-container">
          <header style={{ maxWidth: '40rem', marginBlockEnd: '40px' }}>
            <span
              style={{
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--ember)', display: 'block', marginBlockEnd: '14px',
              }}
            >
              {lang === 'he' ? 'קולות מהקהילה' : 'Voices from the community'}
            </span>
            <h2
              style={{
                fontFamily: 'Frank Ruhl Libre, Georgia, serif',
                fontSize: 'var(--fs-display)', fontWeight: 400, color: 'var(--cream)',
                lineHeight: 1.14, letterSpacing: '-0.01em', margin: '0 0 16px', textWrap: 'balance',
              }}
            >
              {t.stories.title}
            </h2>
            <p style={{ color: 'rgba(244,238,224,0.78)', fontSize: 'var(--fs-lede)', lineHeight: 1.6, margin: 0 }}>
              {t.stories.subtitle}
            </p>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {mockStories.map((s) => (
              <figure
                key={s.id}
                style={{
                  background: 'rgba(244,238,224,0.05)',
                  border: '1px solid rgba(244,238,224,0.12)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '28px',
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', gap: '3px' }} aria-label={`${s.rating}/5`}>
                  {Array(s.rating).fill(0).map((_, i) => (
                    <Star key={i} size={14} fill="var(--ember)" color="var(--ember)" />
                  ))}
                </div>
                <blockquote
                  style={{
                    fontFamily: 'Frank Ruhl Libre, Georgia, serif',
                    fontSize: '1.0625rem', lineHeight: 1.65, color: 'var(--cream)',
                    fontStyle: 'italic', margin: 0, flex: 1,
                  }}
                >
                  &ldquo;{lang === 'he' ? s.quote : s.quoteEn}&rdquo;
                </blockquote>
                <figcaption style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: 'rgba(185,105,78,0.2)', border: '1.5px solid rgba(185,105,78,0.45)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Frank Ruhl Libre, serif', fontWeight: 700, color: 'var(--ember)',
                      fontSize: '15px', flexShrink: 0,
                    }}
                  >
                    {s.avatar}
                  </span>
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '14px', color: 'var(--cream)' }}>
                      {lang === 'he' ? s.name : s.nameEn}
                    </span>
                    <span
                      style={{
                        display: 'block', fontSize: '11px', color: 'rgba(244,238,224,0.6)',
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                        letterSpacing: '0.06em', textTransform: 'uppercase', marginBlockStart: '2px',
                      }}
                    >
                      {lang === 'he' ? s.role : s.roleEn}
                    </span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — a real ordered sequence, numbers earn their place ── */}
      <section className="section-padding" style={{ background: 'var(--paper)' }}>
        <div className="page-container">
          <header style={{ maxWidth: '40rem', marginBlockEnd: '40px' }}>
            <h2 className="section-display" style={{ margin: '0 0 14px' }}>
              {lang === 'he' ? 'איך זה עובד' : 'How it works'}
            </h2>
            <p className="section-lede" style={{ margin: 0 }}>
              {lang === 'he' ? 'שלושה צעדים מהגשת הבקשה ועד הסיוע.' : 'Three steps from request to support.'}
            </p>
          </header>

          <ol className="steps-flow">
            {[
              {
                n: '1',
                he: { title: 'הגשת הבקשה', desc: 'מילוי הטופס הדיגיטלי לוקח פחות מחמש דקות.' },
                en: { title: 'Submit the request', desc: 'The digital form takes under five minutes to fill in.' },
              },
              {
                n: '2',
                he: { title: 'נציג חוזר אליך', desc: 'נציג מהעמותה יוצר קשר תוך 48 שעות.' },
                en: { title: 'A representative reaches out', desc: 'Someone from the team contacts you within 48 hours.' },
              },
              {
                n: '3',
                he: { title: 'סיוע מותאם', desc: 'מקבלים ליווי בדיוק בתחום שבו צריך עזרה.' },
                en: { title: 'Get matched support', desc: 'You receive guidance in the exact area you need.' },
              },
            ].map((step, i, arr) => (
              <li key={step.n} className="step-item">
                <span className="step-num">{step.n}</span>
                <div>
                  <h3 className="step-title">{lang === 'he' ? step.he.title : step.en.title}</h3>
                  <p className="step-desc">{lang === 'he' ? step.he.desc : step.en.desc}</p>
                </div>
                {i < arr.length - 1 && <span className="step-line" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── PARTNERS — quiet logo wall ────────────────────────────────────── */}
      <section style={{ background: 'var(--sky-2)', paddingBlock: 'clamp(48px, 6vw, 72px)' }}>
        <div className="page-container">
          <h2
            className="section-display"
            style={{ fontSize: 'var(--fs-h2)', margin: '0 0 24px' }}
          >
            {t.partners.title}
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {mockNGOs.slice(0, 5).map((ngo) => (
              <div key={ngo.id} className="partner-pill">
                <span className="partner-mark">{ngo.logo}</span>
                <span>
                  <span className="partner-name">{lang === 'he' ? ngo.name : ngo.nameEn}</span>
                  <span className="partner-area">{lang === 'he' ? ngo.area : ngo.areaEn}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA — full-bleed ink band ───────────────────────────────── */}
      <section style={{ background: 'var(--ink)', paddingBlock: 'clamp(56px, 8vw, 88px)' }}>
        <div className="page-container" style={{ textAlign: 'center', maxWidth: '46rem' }}>
          <h2
            style={{
              fontFamily: 'Frank Ruhl Libre, Georgia, serif',
              fontSize: 'var(--fs-display)', fontWeight: 400, color: 'var(--cream)',
              lineHeight: 1.14, letterSpacing: '-0.01em', margin: '0 0 14px', textWrap: 'balance',
            }}
          >
            {t.cta.title}
          </h2>
          <p style={{ color: 'rgba(244,238,224,0.8)', fontSize: 'var(--fs-lede)', lineHeight: 1.6, margin: '0 auto 28px', maxWidth: '36rem' }}>
            {t.cta.subtitle}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ember btn-lg" onClick={() => navigate('/requests')}>
              {t.cta.primary} <ArrowIcon size={16} />
            </button>
            <button className="btn btn-nav-outline btn-lg" onClick={() => navigate('/volunteer')}>
              {t.cta.secondary}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
