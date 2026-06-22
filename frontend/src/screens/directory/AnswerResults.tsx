import type { LucideIcon } from 'lucide-react'
import { HeartHandshake, Handshake } from 'lucide-react'
import Pagination from '@/components/data-display/Pagination'
import Reveal from '../../components/motion/Reveal'
import type { TNode } from '@/types'
import { PER_PAGE } from './constants'
import type { Bilingual, DirRecord } from './constants'

type Props = {
  d: TNode
  activeTab: string
  answerPageData: DirRecord[]
  filteredAnswersLength: number
  answerPage: number
  setAnswerPage: (v: number) => void
  L: (v: Bilingual) => string
  catLabel: (id: string) => string
  openAnswerModal: (answer: DirRecord) => void
  ArrowIcon: LucideIcon
}

export default function AnswerResults({
  d,
  activeTab,
  answerPageData,
  filteredAnswersLength,
  answerPage,
  setAnswerPage,
  L,
  catLabel,
  openAnswerModal,
  ArrowIcon,
}: Props) {
  return (
    <>
      {answerPageData.length > 0 ? (
        <div className="dir-grid">
          {answerPageData.map((answer, i) => {
            const aTitle = L(answer.title)
            const aRegion = L(answer.region)
            const aAudience = L(answer.audience)
            const areaLabel = answer.category && (answer.category === 'all' ? d.filterAll : catLabel(String(answer.category)))
            return (
            <Reveal key={answer.id} delay={Math.min(i, 5) * 0.06} className="card card-interactive dir-answer-card">
              {areaLabel && (
                <span className="dir-answer-badge">
                  {areaLabel}
                </span>
              )}
              <h3 className="dir-answer-title">
                {aTitle || d.untitledOrg}
              </h3>
              {(aRegion || aAudience) && (
                <div className="dir-answer-sub">
                  {aRegion}{aRegion && aAudience ? ' • ' : ''}{aAudience}
                </div>
              )}
              <p className="dir-answer-body">
                {L(answer.body)}
              </p>
              <div className="dir-tags">
                {aRegion && (
                  <span className="dir-tag">{aRegion}</span>
                )}
                {aAudience && (
                  <span className="dir-tag">{aAudience}</span>
                )}
              </div>
              <div className="dir-answer-footer">
                <button className="btn btn-navy btn-sm dir-answer-cta" onClick={() => openAnswerModal(answer)}>
                  {d.moreBtn}
                  <ArrowIcon size={14} aria-hidden="true" />
                </button>
              </div>
            </Reveal>
            )
          })}
        </div>
      ) : (
        <div className="dir-state">
          <span className="dir-state-icon">
            {activeTab === 'partner'
              ? <Handshake size={26} aria-hidden="true" />
              : <HeartHandshake size={26} aria-hidden="true" />}
          </span>
          <h3 className="section-display dir-state-title">
            {activeTab === 'partner' ? d.emptyPartners : d.emptyAnswers}
          </h3>
          <p className="dir-state-hint">{d.noResultsHint}</p>
        </div>
      )}
      <Pagination total={filteredAnswersLength} perPage={PER_PAGE} current={answerPage} onChange={setAnswerPage} />
    </>
  )
}
