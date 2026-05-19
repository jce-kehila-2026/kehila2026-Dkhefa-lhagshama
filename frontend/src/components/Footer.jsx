import NextLink from 'next/link'
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

// Shim: prototype used react-router's <Link to="...">.
// We forward `to` → `href` and render next/link so the rest of the JSX is unchanged.
const Link = ({ to, children, ...rest }) => <NextLink href={to} {...rest}>{children}</NextLink>

export default function Footer() {
  const { t } = useLanguage()
  const f = t.footer

  return (
    <footer style={{ background:'var(--ink)', color:'rgba(244,238,224,0.75)', paddingTop:'56px' }}>
      <div className="page-container">
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',
          gap:'40px',
          paddingBottom:'48px',
          borderBottom:'1px solid rgba(244,238,224,0.1)',
        }}>
          {/* BRAND */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
              <img
                src="/logo.jpg"
                alt={t.lang === 'he' ? 'דחיפה להגשמה' : 'Push for Fulfillment'}
                width={42}
                height={42}
                style={{ borderRadius:'50%', objectFit:'cover', background:'var(--cream)' }}
              />
              <span style={{ color:'var(--cream)', fontFamily:'Frank Ruhl Libre, serif', fontWeight:700, fontSize:'18px' }}>
                {t.lang === 'he' ? 'דחיפה להגשמה' : 'Push for Fulfillment'}
              </span>
            </div>
            <p style={{ fontSize:'13.5px', lineHeight:1.7, marginBottom:'20px' }}>{f.tagline}</p>
            <div style={{ display:'flex', gap:'10px' }}>
              {[Facebook, Instagram, Twitter].map((Icon, i) => (
                <a key={i} href="#" style={{
                  width:'34px', height:'34px',
                  borderRadius:'8px', background:'rgba(244,238,224,0.08)',
                  border:'1px solid rgba(244,238,224,0.12)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'rgba(244,238,224,0.7)',
                  transition:'all .2s',
                }}
                onMouseEnter={e => {e.currentTarget.style.background='rgba(185,105,78,0.25)'; e.currentTarget.style.color='var(--ember)'}}
                onMouseLeave={e => {e.currentTarget.style.background='rgba(244,238,224,0.08)'; e.currentTarget.style.color='rgba(244,238,224,0.7)'}}
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* QUICK LINKS */}
          <div>
            <h4 style={{
  color:'var(--cream)',
  fontSize:'11px',
  fontWeight:500,
  fontFamily:'ui-monospace, "SF Mono", Menlo, monospace',
  letterSpacing:'0.12em',
  textTransform:'uppercase',
  marginBottom:'18px',
}}>{f.quickLinks}</h4>
            {[
              { to:'/', label: t.nav.home },
              { to:'/requests', label: t.nav.requests },
              { to:'/directory', label: t.nav.directory },
              { to:'/volunteer', label: t.nav.volunteers },
              { to:'/track', label: t.nav.track },
            ].map(l => (
              <div key={l.to} style={{ marginBottom:'9px' }}>
                <Link to={l.to} style={{ color:'rgba(244,238,224,0.7)', fontSize:'13.5px', textDecoration:'none', transition:'color .2s' }}
                  onMouseEnter={e => e.currentTarget.style.color='var(--ember)'}
                  onMouseLeave={e => e.currentTarget.style.color='rgba(244,238,224,0.7)'}
                >{l.label}</Link>
              </div>
            ))}
          </div>

          {/* SERVICES */}
          <div>
            <h4 style={{
  color:'var(--cream)',
  fontSize:'11px',
  fontWeight:500,
  fontFamily:'ui-monospace, "SF Mono", Menlo, monospace',
  letterSpacing:'0.12em',
  textTransform:'uppercase',
  marginBottom:'18px',
}}>{f.services}</h4>
            {Object.values(t.services.items).map((s, i) => (
              <div key={i} style={{ marginBottom:'9px' }}>
                <Link to="/requests" style={{ color:'rgba(244,238,224,0.7)', fontSize:'13.5px', textDecoration:'none', transition:'color .2s' }}
                  onMouseEnter={e => e.currentTarget.style.color='var(--ember)'}
                  onMouseLeave={e => e.currentTarget.style.color='rgba(244,238,224,0.7)'}
                >{s.title}</Link>
              </div>
            ))}
          </div>

          {/* CONTACT */}
          <div>
            <h4 style={{
  color:'var(--cream)',
  fontSize:'11px',
  fontWeight:500,
  fontFamily:'ui-monospace, "SF Mono", Menlo, monospace',
  letterSpacing:'0.12em',
  textTransform:'uppercase',
  marginBottom:'18px',
}}>{f.contact}</h4>
            {[
              { Icon: Phone, text: '03-000-0000' },
              { Icon: Mail,  text: 'info@push4ful.org.il' },
              { Icon: MapPin,text: t.lang === 'he' ? 'תל אביב, ישראל' : 'Tel Aviv, Israel' },
              { Icon: Clock, text: t.lang === 'he' ? 'א׳–ה׳ 9:00–18:00' : 'Sun–Thu 9:00–18:00' },
            ].map(({ Icon, text }, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'10px' }}>
                <Icon size={14} style={{ color:'var(--ember)', marginTop:'3px', flexShrink:0 }} />
                <span style={{ fontSize:'13.5px' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div style={{
          padding:'20px 0',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          flexWrap:'wrap', gap:'12px',
          fontSize:'12.5px',
        }}>
          <div>{f.rights}</div>
          <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
            <span style={{ color:'rgba(244,238,224,0.3)' }}>|</span>
            <Link to="/privacy" style={{ color:'rgba(244,238,224,0.55)', textDecoration:'none' }}
              onMouseEnter={e => e.currentTarget.style.color='var(--ember)'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(244,238,224,0.55)'}
            >{f.privacy}</Link>
            <Link to="/terms" style={{ color:'rgba(244,238,224,0.55)', textDecoration:'none' }}
              onMouseEnter={e => e.currentTarget.style.color='var(--ember)'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(244,238,224,0.55)'}
            >{f.terms}</Link>
            <Link to="/accessibility" style={{ color:'rgba(244,238,224,0.55)', textDecoration:'none' }}
              onMouseEnter={e => e.currentTarget.style.color='var(--ember)'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(244,238,224,0.55)'}
            >{f.accessibility}</Link>
          </div>
        </div>
        <div style={{ textAlign:'center', padding:'12px 0 20px', fontSize:'11.5px', color:'rgba(244,238,224,0.35)' }}>
          {f.reg}
        </div>
      </div>
    </footer>
  )
}