/*
 * Footer.tsx — global site footer rendered on every page (via the shared layout).
 * Presentational only: no data fetching, no state. All copy comes from the shared
 * i18n table (LanguageContext `t`), so the footer flips HE/EN with the rest of the app;
 * the brand name and a couple of literals are inlined per-language where there's no t key.
 * Columns: brand+socials, quick links, services (driven by t.services.items), contact, legal/reg.
 */
import type { ComponentProps, ReactNode } from 'react'
import NextLink from 'next/link'
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import styles from './Footer.module.css'

// shim: prototype used react-router's <Link to="...">. forward `to` → next/link `href`
// so the ported JSX below stays unchanged. local-only, not exported.
type LinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & { to: string; children?: ReactNode }
const Link = ({ to, children, ...rest }: LinkProps) => <NextLink href={to} {...rest}>{children}</NextLink>

// site footer. `f` is the footer i18n slice; other slices (nav, services) read directly off `t`.
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
            ].map(l => (
              <div key={l.to} className={styles.linkRow}>
                <Link to={l.to} className={styles.link}>{l.label}</Link>
              </div>
            ))}
          </div>

          {/* SERVICES */}
          <div>
            <h4 className={styles.colHead}>{f.services}</h4>
            {/* one link per service in the i18n table; all point at /requests (no per-service deep link) */}
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
                {/* rows with an href (tel:/mailto:) render as links; address/hours are plain text */}
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
        </div>
        <div className={styles.reg}>
          {f.reg}
        </div>
      </div>
    </footer>
  )
}
