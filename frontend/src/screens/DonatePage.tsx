/**
 * DonatePage: public, static bank-transfer details (route `/donate`).
 *
 * No payment processor: donors copy the details into their own banking app.
 * The details themselves live in `data/donation.ts`; all copy comes from
 * `t.donate` (i18n/overhaul.public.ts). Each field has a copy-to-clipboard
 * button with a short "copied" state plus a polite live-region announcement.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { BANK_DETAILS, type DonationFieldKey } from '@/data/donation'
import styles from './DonatePage.module.css'

// How long a button shows "copied" before reverting.
const COPIED_MS = 2000

// Clipboard API needs a secure context; fall back to a hidden textarea +
// execCommand for older/in-app browsers that lack it.
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function DonatePage() {
  const { t, lang } = useLanguage()
  const [copiedKey, setCopiedKey] = useState<DonationFieldKey | null>(null)
  const [failed, setFailed] = useState(false)
  const [announce, setAnnounce] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const onCopy = async (key: DonationFieldKey, value: string) => {
    const ok = await copyText(value)
    clearTimeout(timer.current)
    setFailed(!ok)
    if (!ok) {
      setCopiedKey(null)
      setAnnounce(t.donate.copyFailed)
      return
    }
    setCopiedKey(key)
    setAnnounce(t.donate.copiedAnnounce(t.donate.fields[key]))
    timer.current = setTimeout(() => setCopiedKey(null), COPIED_MS)
  }

  return (
    <main className={`page-enter ${styles.main}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={`eyebrow ${styles.eyebrow}`}>{t.donate.eyebrow}</span>
          <h1 className={styles.title}>{t.donate.title}</h1>
          <p className={`section-lede ${styles.lede}`}>{t.donate.lede}</p>
        </header>

        <section className={styles.card} aria-labelledby="donate-details-title">
          <h2 id="donate-details-title" className={styles.cardTitle}>
            {t.donate.detailsTitle}
          </h2>
          <p className={styles.howTo}>{t.donate.howTo}</p>

          <dl className={styles.list}>
            {BANK_DETAILS.map(({ key, value, note, ltr }) => {
              const label = t.donate.fields[key]
              const copied = copiedKey === key
              return (
                <div key={key} className={styles.row}>
                  <dt className={styles.label}>{label}</dt>
                  <dd className={styles.valueCell}>
                    <span className={styles.valueGroup}>
                      {/* Numbers are isolated LTR so they never reorder in RTL;
                          text (the account name) follows its own direction. */}
                      <span
                        className={`${styles.value}${ltr ? ` ${styles.code}` : ''}`}
                        dir={ltr ? 'ltr' : 'auto'}
                      >
                        {value}
                      </span>
                      {note && <span className={styles.note}>{note[lang]}</span>}
                    </span>
                    <button
                      type="button"
                      className={`${styles.copyBtn}${copied ? ` ${styles.copied}` : ''}`}
                      onClick={() => onCopy(key, value)}
                      aria-label={t.donate.copyAria(label)}
                    >
                      {copied ? (
                        <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                      ) : (
                        <Copy size={16} strokeWidth={2} aria-hidden="true" />
                      )}
                      <span aria-hidden="true">{copied ? t.donate.copied : t.donate.copy}</span>
                    </button>
                  </dd>
                </div>
              )
            })}
          </dl>

          {failed && <p className={styles.error}>{t.donate.copyFailed}</p>}
          <span className={styles.srOnly} role="status" aria-live="polite">
            {announce}
          </span>
        </section>

        <p className={styles.questions}>{t.donate.questions}</p>
      </div>
    </main>
  )
}
