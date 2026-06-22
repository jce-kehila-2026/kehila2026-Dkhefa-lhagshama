import type { ComponentProps, ReactNode } from 'react'
import NextLink from 'next/link'
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import styles from './Footer.module.css'

// Shim: prototype used react-router's <Link to="...">.
// We forward `to` → `href` and render next/link so the rest of the JSX is unchanged.
type LinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & { to: string; children?: ReactNode }
const Link = ({ to, children, ...rest }: LinkProps) => <NextLink href={to} {...rest}>{children}</NextLink>

export default function Footer() {
  const { t } = useLanguage()
  const f = t.footer

  return (
    <footer className={styles.footer}>
      <div className="page-container">
        <div className={styles.grid}>
          {/* BRAND */}
          <div>
            <div className={styles.brandRow}>
              <img
                src="/logo.jpg"
                alt={t.lang === 'he' ? 'דחיפה להגשמה' : 'Push for Fulfillment'}
                width={42}
                height={42}
                className={styles.logo}
              />
              <span className={styles.brandName}>
                {t.lang === 'he' ? 'דחיפה להגשמה' : 'Push for Fulfillment'}
              </span>
            </div>
            <p className={styles.tagline}>{f.tagline}</p>
            <div className={styles.social}>
              {[Facebook, Instagram, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="social-icon">
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* QUICK LINKS */}
          <div>
            <h4 className={styles.colHead}>{f.quickLinks}</h4>
            {[
              { to:'/', label: t.nav.home },
              { to:'/requests', label: t.nav.requests },
              { to:'/directory', label: t.nav.directory },
              { to:'/volunteer', label: t.nav.volunteers },
              { to:'/track', label: t.nav.track },
            ].map(l => (
              <div key={l.to} className={styles.linkRow}>
                <Link to={l.to} className={styles.link}>{l.label}</Link>
              </div>
            ))}
          </div>

          {/* SERVICES */}
          <div>
            <h4 className={styles.colHead}>{f.services}</h4>
            {Object.values(t.services.items).map((s, i) => (
              <div key={i} className={styles.linkRow}>
                <Link to="/requests" className={styles.link}>{s.title}</Link>
              </div>
            ))}
          </div>

          {/* CONTACT */}
          <div>
            <h4 className={styles.colHead}>{f.contact}</h4>
            {[
              { Icon: Phone, text: f.phone, href: 'tel:+972546720113' },
              { Icon: Mail,  text: 'info@push4ful.org.il', href: 'mailto:info@push4ful.org.il' },
              { Icon: MapPin,text: f.address },
              { Icon: Clock, text: t.lang === 'he' ? 'א׳–ה׳ 9:00–18:00' : 'Sun–Thu 9:00–18:00' },
            ].map(({ Icon, text, href }, i) => (
              <div key={i} className={styles.contactRow}>
                <Icon size={14} className={styles.contactIcon} />
                {href ? (
                  <a href={href} className={styles.link}>{text}</a>
                ) : (
                  <span className={styles.contactText}>{text}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className={styles.bottomBar}>
          <div>{f.rights}</div>
          <div className={styles.legal}>
            <span className={styles.sep}>|</span>
            <Link to="/privacy" className={styles.legalLink}>{f.privacy}</Link>
            <Link to="/terms" className={styles.legalLink}>{f.terms}</Link>
            <Link to="/accessibility" className={styles.legalLink}>{f.accessibility}</Link>
          </div>
        </div>
        <div className={styles.reg}>
          {f.reg}
        </div>
      </div>
    </footer>
  )
}
