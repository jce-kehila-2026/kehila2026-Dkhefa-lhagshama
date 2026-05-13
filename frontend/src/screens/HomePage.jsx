import { useRouter } from 'next/router'
const useNavigate = () => {
  const router = useRouter()
  return (to) => router.push(to)
}
import { ArrowLeft, ArrowRight, GraduationCap, Briefcase, Scale, Users, Star, CheckCircle, Heart, Globe2 } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { mockStories, mockStats, mockNGOs } from '../data/mockData'
import StatCard from '../components/StatCard'

const SERVICE_ICONS = {
  education:  <GraduationCap size={26} />,
  employment: <Briefcase size={26} />,
  legal:      <Scale size={26} />,
  social:     <Users size={26} />,
}
const SERVICE_COLORS = {
  education:  { bg:'#EBF3FF', color:'#1A5EA0' },
  employment: { bg:'#E8F5EC', color:'#15803D' },
  legal:      { bg:'#FBF0C8', color:'#7C5F00' },
  social:     { bg:'#F5EBF8', color:'#6D28D9' },
}

export default function HomePage() {
  const { t, isRTL, lang } = useLanguage()
  const navigate = useNavigate()
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight

  return (
    <main>
      {/* ── HERO ────────────────────────────────────────── */}
      <section className="hero-gradient hero-pattern" style={{ padding:'80px 0 72px', position:'relative', overflow:'hidden' }}>
        {/* Geometric accent */}
        <div style={{
          position:'absolute', top:'-60px', insetInlineEnd:'-60px',
          width:'420px', height:'420px', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(201,151,26,0.12) 0%, transparent 70%)',
          pointerEvents:'none',
        }} />
        <div style={{
          position:'absolute', bottom:'-80px', insetInlineStart:'10%',
          width:'300px', height:'300px', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
          pointerEvents:'none',
        }} />

        <div className="page-container" style={{ position:'relative', zIndex:1 }}>
          <div style={{ maxWidth:'680px' }}>
            {/* Badge */}
            <div style={{
              display:'inline-flex', alignItems:'center', gap:'7px',
              background:'rgba(201,151,26,0.15)',
              border:'1px solid rgba(201,151,26,0.35)',
              color:'var(--gold-light)',
              padding:'6px 16px', borderRadius:'24px',
              fontSize:'12.5px', fontWeight:500,
              letterSpacing:'0.4px', marginBottom:'24px',
              backdropFilter:'blur(4px)',
            }}>
              {t.hero.badge}
            </div>

            <h1 style={{
              fontFamily:'Frank Ruhl Libre, serif',
              fontSize:'clamp(34px, 5.5vw, 60px)',
              fontWeight:900, color:'#fff', lineHeight:1.08,
              marginBottom:'18px',
            }}>
              {t.hero.title1}{' '}
              <span style={{
                color:'var(--gold-light)',
                textDecoration:'underline',
                textDecorationColor:'rgba(232,184,48,0.4)',
                textUnderlineOffset:'5px',
              }}>
                {t.hero.titleHighlight}
              </span>
              <br />{t.hero.title2}
            </h1>

            <p style={{
              color:'rgba(255,255,255,0.74)',
              fontSize:'17px', lineHeight:1.72,
              marginBottom:'36px', maxWidth:'540px',
            }}>
              {t.hero.subtitle}
            </p>

            <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'52px' }}>
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/requests')}>
                {t.hero.cta}
                <ArrowIcon size={17} />
              </button>
              <button
                className="btn btn-outline btn-lg"
                style={{ color:'#fff', borderColor:'rgba(255,255,255,0.35)' }}
                onClick={() => document.getElementById('services-section')?.scrollIntoView({ behavior:'smooth' })}
              >
                {t.hero.ctaSecondary}
              </button>
            </div>

            {/* STATS ROW */}
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(4, 1fr)',
              gap:'1px', background:'rgba(255,255,255,0.1)',
              borderRadius:'14px', overflow:'hidden', maxWidth:'520px',
            }}>
              {[
                { num: mockStats.beneficiaries, suffix:'', label: t.hero.stats.beneficiaries },
                { num: mockStats.volunteers,    suffix:'+', label: t.hero.stats.volunteers },
                { num: mockStats.satisfaction,  suffix:'%', label: t.hero.stats.satisfaction },
                { num: mockStats.yearsActive,   suffix:'',  label: t.hero.stats.years },
              ].map((s, i) => (
                <div key={i} style={{
                  background:'rgba(255,255,255,0.05)',
                  padding:'18px 12px', textAlign:'center',
                  backdropFilter:'blur(6px)',
                }}>
                  <StatCard num={s.num} suffix={s.suffix} delay={i * 120} />
                  <div style={{ fontSize:'11.5px', color:'rgba(255,255,255,0.56)', marginTop:'5px', lineHeight:1.3 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ────────────────────────────────────── */}
      <section id="services-section" className="section-padding" style={{ background:'var(--cream)' }}>
        <div className="page-container">
          <div className="gold-line" />
          <h2 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'clamp(24px,3vw,36px)', fontWeight:900, color:'var(--navy)', marginBottom:'8px' }}>
            {t.services.title}
          </h2>
          <p style={{ color:'var(--gray-500)', fontSize:'15.5px', marginBottom:'40px' }}>
            {t.services.subtitle}
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'20px' }}>
            {Object.entries(t.services.items).map(([key, svc]) => {
              const { bg, color } = SERVICE_COLORS[key]
              return (
                <div
                  key={key}
                  className="card"
                  style={{ cursor:'pointer', padding:'28px 24px', border:'1.5px solid var(--gray-200)' }}
                  onClick={() => navigate('/requests')}
                >
                  <div style={{
                    width:'52px', height:'52px', borderRadius:'12px',
                    background:bg, color, display:'flex', alignItems:'center', justifyContent:'center',
                    marginBottom:'18px',
                  }}>
                    {SERVICE_ICONS[key]}
                  </div>
                  <h3 style={{ fontSize:'16.5px', fontWeight:700, color:'var(--navy)', marginBottom:'9px' }}>
                    {svc.title}
                  </h3>
                  <p style={{ fontSize:'13.5px', color:'var(--gray-500)', lineHeight:1.65, marginBottom:'18px' }}>
                    {svc.desc}
                  </p>
                  <span style={{
                    fontSize:'13px', color, fontWeight:600,
                    display:'flex', alignItems:'center', gap:'4px',
                  }}>
                    {lang === 'he' ? 'לפרטים ←' : 'Learn more →'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── SUCCESS STORIES ─────────────────────────────── */}
      <section className="section-padding" style={{ background:'var(--navy)' }}>
        <div className="page-container">
          <div className="gold-line light" />
          <h2 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'clamp(24px,3vw,36px)', fontWeight:900, color:'#fff', marginBottom:'8px' }}>
            {t.stories.title}
          </h2>
          <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'15.5px', marginBottom:'40px' }}>
            {t.stories.subtitle}
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:'20px' }}>
            {mockStories.map(s => (
              <div key={s.id} style={{
                background:'rgba(255,255,255,0.06)',
                border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:'var(--radius)',
                padding:'28px',
                backdropFilter:'blur(6px)',
              }}>
                {/* Stars */}
                <div style={{ display:'flex', gap:'3px', marginBottom:'12px' }}>
                  {Array(s.rating).fill(0).map((_, i) => (
                    <Star key={i} size={14} fill="var(--gold-light)" color="var(--gold-light)" />
                  ))}
                </div>
                <p style={{ fontSize:'15px', lineHeight:1.7, color:'rgba(255,255,255,0.82)', marginBottom:'18px', fontStyle:'italic' }}>
                  "{lang === 'he' ? s.quote : s.quoteEn}"
                </p>
                {/* Avatar + name */}
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{
                    width:'40px', height:'40px', borderRadius:'50%',
                    background:'rgba(201,151,26,0.25)',
                    border:'1.5px solid rgba(201,151,26,0.4)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Frank Ruhl Libre, serif', fontWeight:900,
                    color:'var(--gold-light)', fontSize:'15px', flexShrink:0,
                  }}>
                    {s.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'14px', color:'var(--gold-light)' }}>
                      {lang === 'he' ? s.name : s.nameEn}
                    </div>
                    <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)' }}>
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
      <section className="section-padding" style={{ background:'var(--cream)' }}>
        <div className="page-container" style={{ textAlign:'center' }}>
          <div className="gold-line center" />
          <h2 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'clamp(24px,3vw,36px)', fontWeight:900, color:'var(--navy)', marginBottom:'8px' }}>
            {lang === 'he' ? 'איך זה עובד?' : 'How It Works'}
          </h2>
          <p style={{ color:'var(--gray-500)', fontSize:'15.5px', marginBottom:'48px' }}>
            {lang === 'he' ? 'תהליך פשוט ומהיר בשלושה שלבים' : 'A simple and fast process in three steps'}
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'32px', position:'relative' }}>
            {[
              {
                num:'01', icon:<CheckCircle size={28} />,
                he: { title:'הגש את הבקשה', desc:'מלא את הטופס הדיגיטלי תוך פחות מ-5 דקות' },
                en: { title:'Submit Request', desc:'Fill out the digital form in less than 5 minutes' },
              },
              {
                num:'02', icon:<Heart size={28} />,
                he: { title:'נציג יצור קשר', desc:'תוך 48 שעות ייצור קשר נציג מוסמך' },
                en: { title:'We Contact You', desc:'Within 48 hours a qualified representative will reach out' },
              },
              {
                num:'03', icon:<Star size={28} />,
                he: { title:'קבל סיוע מותאם', desc:'נסייע לך בדיוק בתחום שבו אתה זקוק לעזרה' },
                en: { title:'Get Personalized Help', desc:'We\'ll assist you in exactly the area you need' },
              },
            ].map((step, i) => (
              <div key={i} className="card" style={{ padding:'32px 24px', textAlign:'center' }}>
                <div style={{
                  fontFamily:'Frank Ruhl Libre, serif', fontSize:'48px', fontWeight:900,
                  color:'rgba(11,29,62,0.07)', lineHeight:1, marginBottom:'-8px',
                }}>
                  {step.num}
                </div>
                <div style={{
                  width:'56px', height:'56px', borderRadius:'14px',
                  background:'var(--gold-pale)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'var(--gold)', margin:'0 auto 18px',
                }}>
                  {step.icon}
                </div>
                <h3 style={{ fontSize:'17px', fontWeight:700, color:'var(--navy)', marginBottom:'10px' }}>
                  {lang === 'he' ? step.he.title : step.en.title}
                </h3>
                <p style={{ fontSize:'13.5px', color:'var(--gray-500)', lineHeight:1.65 }}>
                  {lang === 'he' ? step.he.desc : step.en.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTNER NGOs ────────────────────────────────── */}
      <section className="section-padding" style={{ background:'#f0ede7' }}>
        <div className="page-container">
          <div className="gold-line" />
          <h2 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'clamp(22px,3vw,32px)', fontWeight:900, color:'var(--navy)', marginBottom:'28px' }}>
            {t.partners.title}
          </h2>
          <div style={{
            display:'flex', gap:'14px', flexWrap:'wrap', alignItems:'center',
          }}>
            {mockNGOs.slice(0, 5).map(ngo => (
              <div key={ngo.id} style={{
                background:'var(--white)', borderRadius:'var(--radius)',
                border:'1px solid var(--gray-200)',
                padding:'14px 20px',
                display:'flex', alignItems:'center', gap:'10px',
                transition:'all .22s', cursor:'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='var(--shadow)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none' }}
              >
                <div style={{
                  width:'36px', height:'36px', borderRadius:'8px',
                  background:ngo.logoColor, color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Frank Ruhl Libre, serif', fontWeight:900, fontSize:'14px', flexShrink:0,
                }}>
                  {ngo.logo}
                </div>
                <div>
                  <div style={{ fontSize:'13.5px', fontWeight:600, color:'var(--navy)' }}>
                    {lang === 'he' ? ngo.name : ngo.nameEn}
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--gray-400)' }}>
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
          <div className="gold-line center" />
          <h2 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'clamp(26px,4vw,40px)', fontWeight:900, color:'var(--navy)', marginBottom:'12px' }}>
            {t.cta.title}
          </h2>
          <p style={{ color:'var(--gray-500)', fontSize:'16px', maxWidth:'520px', margin:'0 auto 32px' }}>
            {t.cta.subtitle}
          </p>
          <div style={{ display:'flex', gap:'14px', justifyContent:'center', flexWrap:'wrap' }}>
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