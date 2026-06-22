import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Phone, Mail, MapPin, Globe } from 'lucide-react'
import { safeHref } from '../../lib/safeUrl'
import type { TNode } from '@/types'
import type { Bilingual, DirRecord } from './constants'

// ── DETAIL MODALS (Note 2) ────────────────────────────────────
// The shared <Modal> (pages/_app.tsx) renders an object payload as
// { title, content, footer }; openModal is typed ReactNode so we cast the
// structured payload through unknown. Content is built in the active language
// and direction; CTAs reuse existing button classes/tokens.

type ModalDeps = {
  L: (v: Bilingual) => string
  d: TNode
  openModal: (node: ReactNode) => void
}

export function makeOpenBusinessModal({ L, d, openModal }: ModalDeps) {
  return (biz: DirRecord) => {
    const name = L(biz.name)
    const phone = biz.phone ? String(biz.phone) : ''
    // safeHref gates the link to http(s) at render time (defense-in-depth on
    // top of the server-side scheme validation); a non-http value renders no
    // link instead of an injectable href.
    const website = safeHref(biz.website)
    const categoryLabel = (d.categories as Record<string, string>)?.[biz.category as string] || String(biz.category ?? '')
    const callLabel = String(d.modal.call)
    const visitLabel = String(d.modal.visitWebsite)
    const content = (
      <div className="dir-modal-content">
        <div className="dir-modal-chips">
          {categoryLabel && (
            <span className="dir-modal-cat">{categoryLabel}</span>
          )}
          {L(biz.city) && (
            <span className="dir-modal-city">
              <MapPin size={13} aria-hidden="true" /> {L(biz.city)}
            </span>
          )}
        </div>
        {L(biz.description) && (
          <p className="dir-modal-body">{L(biz.description)}</p>
        )}
      </div>
    )
    const footer = (
      <>
        {phone && (
          <a href={`tel:${phone}`} className="btn btn-outline btn-sm dir-modal-cta" style={{ textDecoration: 'none' }}>
            <Phone size={14} aria-hidden="true" /> {callLabel}
          </a>
        )}
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" className="btn btn-ember btn-sm dir-modal-cta" style={{ textDecoration: 'none' }}>
            <Globe size={14} aria-hidden="true" /> {visitLabel}
          </a>
        )}
      </>
    )
    openModal({ title: name, content, footer } as unknown as ReactNode)
  }
}

type AnswerModalDeps = ModalDeps & {
  closeModal: () => void
  router: { push: (path: string) => void }
  ArrowIcon: LucideIcon
}

export function makeOpenAnswerModal({ L, d, openModal, closeModal, router, ArrowIcon }: AnswerModalDeps) {
  return (answer: DirRecord) => {
    const title = L(answer.title) || String(d.untitledOrg)
    const region = L(answer.region)
    const audience = L(answer.audience)
    // Contact details now arrive on the answer (NGO data import): phone is a
    // free string (tel: action), email a mailto:, website the existing http(s)
    // link. All optional — only rendered when present, mirroring the business
    // card/modal styling.
    const phone = answer.phone ? String(answer.phone) : ''
    const email = answer.email ? String(answer.email) : ''
    // safeHref gates the link to http(s) at render time (see business modal).
    const website = safeHref(answer.sourceUrl)
    const startLabel = String(d.modal.startRequest)
    const callLabel = String(d.modal.call)
    const emailLabel = String(d.modal.email)
    const visitLabel = String(d.modal.visitWebsite)
    const content = (
      <div className="dir-modal-content">
        {(region || audience) && (
          <div className="dir-modal-meta">
            {region}{region && audience ? ' • ' : ''}{audience}
          </div>
        )}
        {L(answer.body) && (
          <p className="dir-modal-body">{L(answer.body)}</p>
        )}
      </div>
    )
    const footer = (
      <>
        {phone && (
          <a href={`tel:${phone}`} className="btn btn-outline btn-sm dir-modal-cta" style={{ textDecoration: 'none' }}>
            <Phone size={14} aria-hidden="true" /> {callLabel}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="btn btn-outline btn-sm dir-modal-cta" style={{ textDecoration: 'none' }}>
            <Mail size={14} aria-hidden="true" /> {emailLabel}
          </a>
        )}
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm dir-modal-cta" style={{ textDecoration: 'none' }}>
            <Globe size={14} aria-hidden="true" /> {visitLabel}
          </a>
        )}
        <button
          className="btn btn-ember btn-sm dir-modal-cta"
          onClick={() => { closeModal(); router.push('/requests') }}
        >
          {startLabel}
          <ArrowIcon size={14} aria-hidden="true" />
        </button>
      </>
    )
    openModal({ title, content, footer } as unknown as ReactNode)
  }
}
