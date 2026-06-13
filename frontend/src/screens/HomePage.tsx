import { useState, useRef, useEffect, useMemo } from 'react'
import type { CSSProperties, ReactNode, KeyboardEvent } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, ArrowRight, GraduationCap, Briefcase, Scale, Users, Star, Check, HeartHandshake } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useLanguage } from '../contexts/LanguageContext'
import { useCategories } from '../hooks/useCategories'
import { apiJson } from '../lib/apiClient'
import { mockStories, mockStats } from '../data/mockData'
import StatCard from '@/components/data-display/StatCard'
import AssetImage from '@/components/layout/AssetImage'
import type { AssetSlotKey } from '@/assets/manifest'
import Reveal from '../components/motion/Reveal'
import MagneticButton from '../components/motion/MagneticButton'

// A partner org as fetched for the homepage marquee. Built from the real
// `answers` catalog (orgType=partner), the same source the /directory page uses
// — no fabricated organizations. The category id + region text are kept RAW
// here; the human area label is resolved at render time (see `marqueePartners`)
// so a category-taxonomy load does not re-trigger the fetch.
interface MarqueePartner {
  id: string
  name: string
  category: string | null
  regionText: string
  mark: string
}

// Bilingual field passthrough: answers return `{ he, en }` objects (or plain
// strings on legacy docs); render the active-language value.
type BilingualValue = string | { he?: string; en?: string } | null | undefined
function pickLang(value: BilingualValue, lang: string): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return (lang === 'he' ? value.he : value.en) || value.he || value.en || ''
}

const useNavigate = () => {
  const router = useRouter()
  return (to: string) => router.push(to)
}

const SERVICE_ICONS: Record<string, ReactNode> = {
  education:  <GraduationCap size={30} />,
  employment: <Briefcase size={30} />,
  legal:      <Scale size={30} />,
  social:     <Users size={30} />,
}

export default function HomePage() {
  const { t, isRTL, lang } = useLanguage()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight

  const serviceEntries = Object.entries(t.services.items)

  // Real partner organizations for the marquee — fetched from the live answers
  // catalog (orgType=partner), so the homepage advertises the NGO's actual
  // partners rather than fabricated ones. The marquee is hidden when there are
  // none (or the fetch fails).
  const { labelFor } = useCategories()
  const [partners, setPartners] = useState<MarqueePartner[]>([])
  // Fetch keyed on `[lang]` only — NOT on `labelFor`. `labelFor`'s identity
  // changes when the category taxonomy resolves, which would otherwise fire a
  // redundant second GET on every cold load (and briefly flash raw category
  // ids). The area label is resolved at render instead (see `marqueePartners`).
  useEffect(() => {
    let alive = true
    apiJson<{ items?: Array<{ id: string; title?: BilingualValue; category?: string | null; region?: BilingualValue }> }>(
      '/api/answers?orgType=partner'
    )
      .then((data) => {
        if (!alive) return
        const items = Array.isArray(data.items) ? data.items : []
        const mapped = items
          .map((item) => {
            const name = pickLang(item.title, lang).trim()
            if (!name) return null
            return {
              id: item.id,
              name,
              // Raw fields; the displayed area is resolved at render time.
              category: item.category ?? null,
              regionText: pickLang(item.region, lang),
              // Mark = first character of the name (no logo asset on answers).
              mark: Array.from(name)[0] ?? '·',
            }
          })
          .filter((p): p is MarqueePartner => p !== null)
        setPartners(mapped)
      })
      .catch(() => { if (alive) setPartners([]) })
    return () => { alive = false }
  }, [lang])

  // Resolve the displayed area label here (not in the fetch effect): prefer the
  // category label, fall back to the region text. Re-deriving on a `labelFor`
  // identity change re-renders the existing data instead of re-fetching it.
  const marqueePartners = useMemo(
    () =>
      partners.map((p) => ({
        ...p,
        area: (p.category ? labelFor(p.category) : p.regionText) || '',
      })),
    [partners, labelFor],
  )

  // Success-stories gallery: one panel is the highlight at a time. It behaves
  // as an ARIA tablist — roving tabindex + arrow/Home/End keys (RTL-aware).
  const [activeStory, setActiveStory] = useState(0)
  const storyTablistRef = useRef<HTMLDivElement>(null)
  const onStoryKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const count = mockStories.length
    const forward = e.key === 'ArrowDown' || e.key === (isRTL ? 'ArrowLeft' : 'ArrowRight')
    const backward = e.key === 'ArrowUp' || e.key === (isRTL ? 'ArrowRight' : 'ArrowLeft')
    let next: number
    if (forward) next = (i + 1) % count
    else if (backward) next = (i - 1 + count) % count
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = count - 1
    else return
    e.preventDefault()
    setActiveStory(next)
    storyTablistRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <main>
      {/* ── HERO — a single full-bleed community photo with overlaid copy ──── */}
      <section className="hero-bg hero-enter">
        {/* Full-bleed photograph (kept as a real <img> for alt text + fallback). */}
        <AssetImage
          slot="heroBackground"
          className="hero-bg-image"
          rounded="0"
          priority
        />
        {/* Gradient scrim for legibility — mirrors the .story-panel-scrim precedent. */}
        <span className="hero-bg-scrim" aria-hidden="true" />

        <div className="page-container hero-bg-inner">
          <div className="hero-copy hero-copy-onphoto">
            <span className="eyebrow hero-rise hero-eyebrow-onphoto" style={{ '--rise-delay': '40ms' } as CSSProperties}>{t.hero.badge}</span>
            <h1 className="hero-title-bold hero-title-onphoto hero-rise" style={{ '--rise-delay': '90ms' } as CSSProperties}>
              {t.hero.title1}{' '}
              <em>{t.hero.titleHighlight}</em>{' '}
              {t.hero.title2}
            </h1>
            <p className="section-lede hero-lede-onphoto hero-rise" style={{ margin: '0 0 28px', '--rise-delay': '150ms' } as CSSProperties}>{t.hero.subtitle}</p>

            <div className="hero-rise hero-actions" style={{ '--rise-delay': '210ms' } as CSSProperties}>
              <MagneticButton className="btn btn-ember btn-lg" onClick={() => navigate('/requests')}>
                {t.hero.cta}
                <ArrowIcon size={16} />
              </MagneticButton>
            </div>

            {/* Inline stat strip — woven into the hero, not a separate metric band */}
            <dl
              className="hero-rise hero-stats-onphoto"
              style={{ '--rise-delay': '270ms' } as CSSProperties}
            >
              {[
                { num: mockStats.beneficiaries, suffix: '',  label: t.hero.stats.beneficiaries },
                { num: mockStats.volunteers,    suffix: '+', label: t.hero.stats.volunteers },
                { num: mockStats.satisfaction,  suffix: '%', label: t.hero.stats.satisfaction },
                { num: mockStats.yearsActive,   suffix: '',  label: t.hero.stats.years },
              ].map((s, i) => (
                <div className="hero-stat" key={i}>
                  <dd className="hero-stat-num hero-stat-num-onphoto" style={{ margin: 0 }}>
                    <StatCard num={s.num} suffix={s.suffix} delay={i * 120} />
                  </dd>
                  <dt className="hero-stat-label-onphoto">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── AREAS OF ACTIVITY — four evenly-weighted icon explainers ────────── */}
      <section id="services-section" className="section-padding" style={{ background: 'var(--paper)' }}>
        <div className="page-container">
          <Reveal>
            <header className="home-section-head">
              <h2 className="section-display-bold">{t.services.title}</h2>
              <p className="section-lede" style={{ margin: '12px auto 0' }}>{t.services.subtitle}</p>
            </header>
          </Reveal>

          <div className="areas-grid">
            {serviceEntries.map(([key, svc], i) => (
              <Reveal key={key} delay={i * 0.08}>
                <button type="button" className="area-item" onClick={() => navigate('/requests')}>
                  <span className="area-icon" aria-hidden="true">{SERVICE_ICONS[key]}</span>
                  <h3 className="area-title">{svc.title}</h3>
                  <p className="area-desc">{svc.desc}</p>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── VOLUNTEERS — the people who show up, and how they help ─────────── */}
      <section style={{ background: 'var(--cream)', paddingBlock: 'clamp(56px, 8vw, 96px)' }}>
        <div className="page-container impact-grid">
          <Reveal delay={0.1} y={32}>
            <div className="volunteers-figure">
              <AssetImage
                slot="volunteerInvite"
                ratio="4 / 5"
                rounded="var(--radius-lg)"
                shadow="var(--shadow-lg)"
                border="1px solid var(--hair)"
              />
              <span className="volunteers-figure-badge" aria-hidden="true">
                <HeartHandshake size={26} />
              </span>
            </div>
          </Reveal>

          <Reveal>
            <div>
              <span className="eyebrow" style={{ color: 'var(--ember)', display: 'block', marginBlockEnd: '12px' }}>
                {t.home.volunteers.eyebrow}
              </span>
              <h2 className="section-display-bold" style={{ marginBlockEnd: '16px' }}>{t.home.volunteers.title}</h2>
              <p className="section-lede" style={{ margin: '0 0 28px' }}>{t.home.volunteers.body}</p>

              <ul className="volunteers-points">
                {t.home.volunteers.points.map((p, i) => (
                  <li key={i} className="volunteers-point">
                    <span className="volunteers-point-icon" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
                    <span>
                      <span className="volunteers-point-title">{p.title}</span>
                      <span className="volunteers-point-desc">{p.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <button className="btn btn-ember btn-lg" style={{ marginBlockStart: '32px' }} onClick={() => navigate('/volunteer')}>
                {t.home.volunteers.cta}
                <ArrowIcon size={16} />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── SUCCESS STORIES — image-led, one story takes the stage at a time ── */}
      <section className="section-padding" style={{ background: 'var(--ink)' }}>
        <div className="page-container">
          <Reveal>
            <header className="home-section-head-start">
              <span className="home-eyebrow-onink">
                {t.stories.eyebrow}
              </span>
              <h2 className="home-display-onink">{t.stories.title}</h2>
              <p className="home-lede-onink">{t.stories.subtitle}</p>
            </header>
          </Reveal>

          <Reveal delay={0.1}>
            <div ref={storyTablistRef} className="story-gallery" role="tablist" aria-label={t.stories.title}>
              {mockStories.map((s, i) => {
                const active = i === activeStory
                const name = lang === 'he' ? s.name : s.nameEn
                const role = lang === 'he' ? s.role : s.roleEn
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    className={`story-panel${active ? ' is-active' : ''}`}
                    onClick={() => setActiveStory(i)}
                    onKeyDown={(e) => onStoryKey(e, i)}
                    onMouseEnter={() => !reduce && setActiveStory(i)}
                    onFocus={() => setActiveStory(i)}
                  >
                    <AssetImage
                      slot={s.image as AssetSlotKey}
                      className="story-panel-img"
                      rounded="0"
                      style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }}
                    />
                    <span className="story-panel-scrim" aria-hidden="true" />

                    {/* Collapsed: a vertical name label. Expanded: the full quote. */}
                    <span className="story-panel-label">{name}</span>

                    <span className="story-panel-body">
                      <span className="story-panel-stars" aria-label={`${s.rating}/5`}>
                        {Array(s.rating).fill(0).map((_, j) => (
                          <Star key={j} size={14} fill="var(--ember)" color="var(--ember)" aria-hidden="true" />
                        ))}
                      </span>
                      <span className="story-panel-quote">
                        &ldquo;{lang === 'he' ? s.quote : s.quoteEn}&rdquo;
                      </span>
                      <span className="story-panel-meta">
                        <span className="story-panel-name">{name}</span>
                        <span className="story-panel-role">{role}</span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Reveal>

          {/* Proof — a small "letter of appreciation" figure from Wisdom Academy. */}
          <Reveal delay={0.15}>
            <figure
              style={{
                margin: 'clamp(36px, 6vw, 56px) 0 0',
                maxWidth: '360px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <AssetImage
                slot="storyWisdomLetter"
                rounded="var(--radius-md)"
                border="1px solid rgba(244,238,224,0.16)"
                shadow="var(--shadow-lg)"
              />
              <figcaption style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="home-eyebrow-onink" style={{ marginBlockEnd: 0 }}>
                  {t.stories.letterCaption}
                </span>
                <span style={{ fontSize: '13.5px', color: 'rgba(244,238,224,0.62)' }}>
                  {t.stories.letterSource}
                </span>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS — a real ordered sequence, numbers earn their place ── */}
      <section className="section-padding" style={{ background: 'var(--paper)' }}>
        <div className="page-container">
          <Reveal>
            <header className="home-section-head-start">
              <h2 className="section-display-bold">
                {lang === 'he' ? 'איך זה עובד' : 'How it works'}
              </h2>
              <p className="section-lede" style={{ margin: 0 }}>
                {lang === 'he' ? 'שלושה צעדים מהגשת הבקשה ועד הסיוע.' : 'Three steps from request to support.'}
              </p>
            </header>
          </Reveal>

          <Reveal>
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
          </Reveal>
        </div>
      </section>

      {/* ── PARTNERS — an auto-scrolling trail of real partner organisations ── */}
      {marqueePartners.length > 0 && (
        <section style={{ background: 'var(--sky-2)', paddingBlock: 'clamp(48px, 6vw, 72px)', overflow: 'hidden' }}>
          <div className="page-container">
            <Reveal>
              <h2 className="section-display" style={{ fontSize: 'var(--fs-h2)', margin: '0 0 24px' }}>
                {t.partners.title}
              </h2>
            </Reveal>
          </div>
          <div className="home-marquee" data-reduce={reduce ? 'true' : 'false'}>
            <div className="home-marquee-track">
              {[...marqueePartners, ...marqueePartners].map((p, i) => (
                <div key={`${p.id}-${i}`} className="home-partner" aria-hidden={i >= marqueePartners.length ? 'true' : undefined}>
                  <span className="home-partner-mark">{p.mark}</span>
                  <span>
                    <span className="home-partner-name">{p.name}</span>
                    {p.area && <span className="home-partner-area">{p.area}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FINAL CTA — full-bleed ink band ───────────────────────────────── */}
      <section style={{ background: 'var(--ink)', paddingBlock: 'clamp(56px, 8vw, 88px)' }}>
        <Reveal>
          <div className="page-container home-cta">
            <h2 className="home-display-onink" style={{ margin: '0 0 14px' }}>{t.cta.title}</h2>
            <p className="home-cta-lede">{t.cta.subtitle}</p>
            <div className="home-cta-actions">
              <MagneticButton className="btn btn-ember btn-lg" onClick={() => navigate('/requests')}>
                {t.cta.primary} <ArrowIcon size={16} />
              </MagneticButton>
              <button className="btn btn-nav-outline btn-lg" onClick={() => navigate('/volunteer')}>
                {t.cta.secondary}
              </button>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  )
}
