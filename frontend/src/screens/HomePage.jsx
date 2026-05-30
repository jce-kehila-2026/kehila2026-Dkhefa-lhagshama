import { useRouter } from 'next/router'
const useNavigate = () => {
  const router = useRouter()
  return (to) => router.push(to)
}
import { ArrowLeft, ArrowRight, GraduationCap, Briefcase, Scale, Users, Star, CheckCircle, Heart } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { mockStories, mockStats, mockNGOs } from '../data/mockData'
import StatCard from '../components/StatCard'
import SectionHeader from '../components/SectionHeader'
import AssetImage from '../components/AssetImage'

const SERVICE_ICONS = {
  education:  <GraduationCap size={22} />,
  employment: <Briefcase size={22} />,
  legal:      <Scale size={22} />,
  social:     <Users size={22} />,
}

export default function HomePage() {
  const { t, isRTL, lang } = useLanguage()
  const navigate = useNavigate()
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight

  return (
    <main>
      {/* ── HERO ────────────────────────────────────────── */}
      <section style={{ background:'var(--sky-2)', padding:'72px 0 88px', position:'relative', overflow:'hidden' }}>
        <div className="hero-pattern" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />
        <div className="page-container" style={{ position:'relative', zIndex:1 }}>
          {/* Two-column grid — logo first in DOM → start side (right in HE, left in EN) */}
          <div className="hero-grid">
            <div className="hero-mark">
              <AssetImage
                slot="hero"
                rounded="50%"
                ratio="1 / 1"
                priority
                shadow="var(--shadow-lg)"
                border="6px solid var(--paper)"
                style={{
                  width:'min(320px, 70vw)',
                  height:'min(320px, 70vw)',
                }}
              />
            </div>
            <div className="hero-copy">
              <div className="section-eyebrow">
                {t.hero.badge}
              </div>
              <h1 className="section-display" style={{
                fontSize:'clamp(30px, 4.8vw, 54px)',
                margin:'0 0 18px',
                fontWeight:400,
              }}>
                {t.hero.title1}{' '}
                <em>{t.hero.titleHighlight}</em>
                <br />{t.hero.title2}
              </h1>
              <p className="section-lede" style={{ margin:'0 0 32px' }}>
                {t.hero.subtitle}
              </p>
              <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'8px' }}>
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/requests')}>
                  {t.hero.cta}
                  <ArrowIcon size={16} />
                </button>
                <button
                  className="btn btn-outline btn-lg"
                  onClick={() => document.getElementById('services-section')?.scrollIntoView({ behavior:'smooth' })}
                >
                  {t.hero.ctaSecondary}
                </button>
              </div>
            </div>
          </div>

          {/* STATS ROW — 4-wide on desktop, 2×2 on phones */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',
            gap:'1px', background:'var(--hair)',
            borderRadius:'14px', overflow:'hidden',
            maxWidth:'720px', margin:'56px auto 0',
          }}>
            {[
              { num: mockStats.beneficiaries, suffix:'',  label: t.hero.stats.beneficiaries },
              { num: mockStats.volunteers,    suffix:'+', label: t.hero.stats.volunteers },
              { num: mockStats.satisfaction,  suffix:'%', label: t.hero.stats.satisfaction },
              { num: mockStats.yearsActive,   suffix:'',  label: t.hero.stats.years },
            ].map((s, i) => (
              <div key={i} style={{
                background:'var(--paper)',
                padding:'20px 12px', textAlign:'center',
              }}>
                <StatCard num={s.num} suffix={s.suffix} delay={i * 120} />
                <div style={{
                  fontSize:'11px', color:'var(--ink-2)', marginTop:'6px', lineHeight:1.3,
                  fontFamily:'ui-monospace, "SF Mono", Menlo, monospace',
                  letterSpacing:'0.08em', textTransform:'uppercase',
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ────────────────────────────────────── */}
      <section id="services-section" className="section-padding" style={{ background:'var(--paper)' }}>
        <div className="page-container">
          <SectionHeader
            eyebrow={lang === 'he' ? 'שירותים' : 'What we do'}
            title={t.services.title}
            lede={t.services.subtitle}
          />

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'20px' }}>
            {Object.entries(t.services.items).map(([key, svc]) => (
              <div
                key={key}
                className="card"
                style={{ cursor:'pointer', padding:'28px 24px' }}
                onClick={() => navigate('/requests')}
              >
                <div style={{
                  width:'48px', height:'48px', borderRadius:'12px',
                  background:'var(--sky-2)', color:'var(--ink)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  marginBottom:'18px',
                }}>
                  {SERVICE_ICONS[key]}
                </div>
                <h3 style={{
                  fontFamily:'Frank Ruhl Libre, Georgia, serif',
                  fontSize:'1.25rem', fontWeight:400, color:'var(--ink)',
                  marginBottom:'9px',
                }}>
                  {svc.title}
                </h3>
                <p style={{ fontSize:'14px', color:'var(--ink-2)', lineHeight:1.65, marginBottom:'18px' }}>
                  {svc.desc}
                </p>
                <span style={{
                  fontSize:'12px', color:'var(--ember)', fontWeight:500,
                  fontFamily:'ui-monospace, "SF Mono", Menlo, monospace',
                  letterSpacing:'0.08em', textTransform:'uppercase',
                  display:'flex', alignItems:'center', gap:'6px',
                }}>
                  {lang === 'he' ? 'לפרטים ←' : 'Learn more →'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMUNITY IMPACT BAND (#79) ─────────────────── */}
      <section
        style={{
          background:'var(--cream)',
          paddingBlock:'clamp(64px, 8vw, 96px)',
        }}
      >
        <div
          className="page-container"
          style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
            gap:'clamp(32px, 5vw, 56px)',
            alignItems:'center',
          }}
        >
          <div>
            <div className="section-eyebrow">{t.home.impactEyebrow}</div>
            <h2
              className="section-display"
              style={{ fontSize:'clamp(1.6rem, 3.2vw, 2.4rem)', margin:'10px 0 14px' }}
            >
              {t.home.impactTitle}
            </h2>
            <p className="section-lede" style={{ margin:0 }}>
              {t.home.impactBody}
            </p>
          </div>
          <AssetImage
            slot="communityImpact"
            ratio="16 / 9"
            shadow="var(--shadow)"
            border="1px solid var(--hair)"
          />
        </div>
      </section>

      {/* Section divider */}
      <div aria-hidden="true" style={{ height:'1px', background:'var(--hair)' }} />

      {/* ── SUCCESS STORIES (editorial colophon — dark) ─── */}
      <section className="section-padding" style={{ background:'var(--ink)' }}>
        <div className="page-container">
          <div style={{
            fontFamily:'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize:'0.75rem', fontWeight:500, letterSpacing:'0.12em',
            textTransform:'uppercase', color:'var(--ember)',
            marginBottom:'14px',
          }}>
            {lang === 'he' ? 'סיפורי הצלחה' : 'Voices'}
          </div>
          <h2 style={{
            fontFamily:'Frank Ruhl Libre, Georgia, serif',
            fontSize:'clamp(2rem, 4vw, 3rem)',
            fontWeight:400, color:'var(--cream)', lineHeight:1.15,
            marginBottom:'18px',
          }}>
            {t.stories.title}
          </h2>
          <p style={{ color:'rgba(244,238,224,0.7)', fontSize:'1.125rem', lineHeight:1.65, maxWidth:'38rem', marginBottom:'40px' }}>
            {t.stories.subtitle}
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:'20px' }}>
            {mockStories.map(s => (
              <div key={s.id} style={{
                background:'rgba(244,238,224,0.04)',
                border:'1px solid rgba(244,238,224,0.1)',
                borderRadius:'var(--radius)',
                padding:'28px',
              }}>
                <div style={{ display:'flex', gap:'3px', marginBottom:'12px' }}>
                  {Array(s.rating).fill(0).map((_, i) => (
                    <Star key={i} size={14} fill="var(--ember)" color="var(--ember)" />
                  ))}
                </div>
                <p style={{
                  fontFamily:'Frank Ruhl Libre, Georgia, serif',
                  fontSize:'1.0625rem', lineHeight:1.65,
                  color:'var(--cream)', marginBottom:'18px', fontStyle:'italic',
                }}>
                  "{lang === 'he' ? s.quote : s.quoteEn}"
                </p>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{
                    width:'40px', height:'40px', borderRadius:'50%',
                    background:'rgba(185,105,78,0.2)',
                    border:'1.5px solid rgba(185,105,78,0.4)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Frank Ruhl Libre, serif', fontWeight:700,
                    color:'var(--ember)', fontSize:'15px', flexShrink:0,
                  }}>
                    {s.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight:500, fontSize:'14px', color:'var(--cream)' }}>
                      {lang === 'he' ? s.name : s.nameEn}
                    </div>
                    <div style={{
                      fontSize:'11px', color:'rgba(244,238,224,0.5)',
                      fontFamily:'ui-monospace, "SF Mono", Menlo, monospace',
                      letterSpacing:'0.08em', textTransform:'uppercase', marginTop:'2px',
                    }}>
                      {lang === 'he' ? s.role : s.roleEn}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────── */}
      <section className="section-padding" style={{ background:'var(--paper)' }}>
        <div className="page-container">
          <SectionHeader
            eyebrow={lang === 'he' ? 'התהליך' : 'Process'}
            title={lang === 'he' ? 'איך זה עובד?' : 'How it works'}
            lede={lang === 'he' ? 'תהליך פשוט ומהיר בשלושה שלבים' : 'A simple and fast process in three steps'}
            center
          />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'24px' }}>
            {[
              {
                num:'01', icon:<CheckCircle size={24} />,
                he: { title:'הגש את הבקשה', desc:'מלא את הטופס הדיגיטלי תוך פחות מ-5 דקות' },
                en: { title:'Submit Request', desc:'Fill out the digital form in less than 5 minutes' },
              },
              {
                num:'02', icon:<Heart size={24} />,
                he: { title:'נציג יצור קשר', desc:'תוך 48 שעות ייצור קשר נציג מוסמך' },
                en: { title:'We Contact You', desc:'Within 48 hours a qualified representative will reach out' },
              },
              {
                num:'03', icon:<Star size={24} />,
                he: { title:'קבל סיוע מותאם', desc:'נסייע לך בדיוק בתחום שבו אתה זקוק לעזרה' },
                en: { title:'Get Personalized Help', desc:"We'll assist you in exactly the area you need" },
              },
            ].map((step, i) => (
              <div key={i} className="card" style={{ padding:'32px 24px', textAlign:'center' }}>
                <div style={{
                  fontFamily:'ui-monospace, "SF Mono", Menlo, monospace',
                  fontSize:'11px', fontWeight:500,
                  letterSpacing:'0.12em', textTransform:'uppercase',
                  color:'var(--ember)', marginBottom:'12px',
                }}>
                  {step.num}
                </div>
                <div style={{
                  width:'52px', height:'52px', borderRadius:'14px',
                  background:'var(--cream)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'var(--ember)', margin:'0 auto 18px',
                }}>
                  {step.icon}
                </div>
                <h3 style={{
                  fontFamily:'Frank Ruhl Libre, Georgia, serif',
                  fontSize:'1.125rem', fontWeight:400, color:'var(--ink)',
                  marginBottom:'10px',
                }}>
                  {lang === 'he' ? step.he.title : step.en.title}
                </h3>
                <p style={{ fontSize:'14px', color:'var(--ink-2)', lineHeight:1.65 }}>
                  {lang === 'he' ? step.he.desc : step.en.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTNER NGOs ────────────────────────────────── */}
      <section className="section-padding" style={{ background:'var(--sky-2)' }}>
        <div className="page-container">
          <SectionHeader
            eyebrow={lang === 'he' ? 'שותפים' : 'Partners'}
            title={t.partners.title}
          />
          <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', alignItems:'center' }}>
            {mockNGOs.slice(0, 5).map(ngo => (
              <div key={ngo.id} style={{
                background:'var(--paper)', borderRadius:'var(--radius)',
                border:'1px solid var(--hair)',
                padding:'14px 20px',
                display:'flex', alignItems:'center', gap:'12px',
                transition:'all .22s', cursor:'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='var(--shadow)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='none' }}
              >
                <div style={{
                  width:'36px', height:'36px', borderRadius:'8px',
                  background:'var(--ink)', color:'var(--cream)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Frank Ruhl Libre, serif', fontWeight:700, fontSize:'14px', flexShrink:0,
                }}>
                  {ngo.logo}
                </div>
                <div>
                  <div style={{ fontSize:'14px', fontWeight:500, color:'var(--ink)' }}>
                    {lang === 'he' ? ngo.name : ngo.nameEn}
                  </div>
                  <div style={{
                    fontSize:'11px', color:'var(--ink-2)',
                    fontFamily:'ui-monospace, "SF Mono", Menlo, monospace',
                    letterSpacing:'0.08em', textTransform:'uppercase', marginTop:'2px',
                  }}>
                    {lang === 'he' ? ngo.area : ngo.areaEn}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────── */}
      <section className="section-padding" style={{ background:'var(--cream)' }}>
        <div className="page-container" style={{ textAlign:'center' }}>
          <SectionHeader
            eyebrow={lang === 'he' ? 'מתחילים' : 'Get started'}
            title={t.cta.title}
            lede={t.cta.subtitle}
            center
          />
          <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/requests')}>
              {t.cta.primary} <ArrowIcon size={16} />
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => navigate('/volunteer')}>
              <Heart size={16} /> {t.cta.secondary}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
