import { Star, Phone, MapPin, Store } from 'lucide-react'
import Pagination from '@/components/data-display/Pagination'
import Reveal from '../../components/motion/Reveal'
import type { TNode } from '@/types'
import { PER_PAGE, BIZ_CAT_ICONS } from './constants'
import type { Bilingual, DirRecord } from './constants'

type Props = {
  d: TNode
  bizPageData: DirRecord[]
  filteredBizLength: number
  bizPage: number
  setBizPage: (v: number) => void
  L: (v: Bilingual) => string
  L_arr: (v: Bilingual) => string[]
  openBusinessModal: (biz: DirRecord) => void
}

export default function BusinessResults({
  d,
  bizPageData,
  filteredBizLength,
  bizPage,
  setBizPage,
  L,
  L_arr,
  openBusinessModal,
}: Props) {
  return (
    <>
      {bizPageData.length > 0 ? (
        <div className="dir-grid">
          {bizPageData.map((biz, i) => {
            const BannerIcon = BIZ_CAT_ICONS[biz.category as string] || Store
            const photo = biz.photo ? String(biz.photo) : ''
            return (
            <Reveal key={biz.id} delay={Math.min(i, 5) * 0.06} className="card card-interactive dir-biz-card">
              {/* Banner — photo when present, else a flat ink panel with the
                  category glyph. No gradient (brand constraint). */}
              <div
                className="dir-biz-banner"
                style={photo
                  ? { backgroundImage: `url("${photo}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : undefined
                }
                aria-hidden="true"
              >
                {!photo && <BannerIcon size={52} color="var(--cream)" strokeWidth={1.5} />}
                {biz.featured && (
                  <span className="dir-biz-featured">
                    <Star size={10} fill="var(--ember)" color="var(--ember)" aria-hidden="true" /> {d.featured}
                  </span>
                )}
              </div>
              <div className="dir-biz-body">
                <div className="dir-biz-name">{L(biz.name)}</div>
                <div className="dir-biz-meta">
                  <MapPin size={12} aria-hidden="true" />
                  {d.categories[biz.category] || biz.category} • {L(biz.city)}
                </div>
                <p className="dir-biz-desc">
                  {L(biz.description)}
                </p>
                <div className="dir-tags">
                  {L_arr(biz.tags).map(tag => (
                    <span key={tag} className="dir-tag">{tag}</span>
                  ))}
                </div>
                {/* Rating only renders when the business actually has
                    reviews. There is no review-submission feature yet, so
                    a zero-review business shows no fabricated star/score
                    (matches the seed's rating:0/reviews:0). */}
                {Number(biz.reviews) > 0 && (
                  <div className="dir-rating">
                    <Star size={15} fill="var(--ember)" color="var(--ember)" aria-hidden="true" />
                    <span className="dir-rating-value">{biz.rating}</span>
                    <span className="dir-rating-count">({biz.reviews})</span>
                  </div>
                )}
                <div className="dir-card-actions">
                  <a href={`tel:${biz.phone}`} className="btn btn-outline btn-sm dir-biz-call" aria-label={`${L(biz.name)} — ${biz.phone}`}>
                    <Phone size={14} aria-hidden="true" /> {biz.phone}
                  </a>
                  <button className="btn btn-ember btn-sm" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }} onClick={() => openBusinessModal(biz)}>{d.moreBtn}</button>
                </div>
              </div>
            </Reveal>
            )
          })}
        </div>
      ) : (
        <div className="dir-state">
          <span className="dir-state-icon">
            <Store size={26} aria-hidden="true" />
          </span>
          <h3 className="section-display dir-state-title">{d.emptyBiz}</h3>
          <p className="dir-state-hint">{d.noResultsHint}</p>
        </div>
      )}
      <Pagination total={filteredBizLength} perPage={PER_PAGE} current={bizPage} onChange={setBizPage} />
    </>
  )
}
