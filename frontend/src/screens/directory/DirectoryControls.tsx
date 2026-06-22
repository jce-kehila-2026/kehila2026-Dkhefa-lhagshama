import { Search, LayoutGrid } from 'lucide-react'
import type { TNode } from '@/types'
import { BIZ_CAT_ICONS, NGO_AREA_ICONS, BIZ_CATS } from './constants'

type Props = {
  d: TNode
  activeTab: string
  bizSearch: string
  answerSearch: string
  setBizSearch: (v: string) => void
  setBizPage: (v: number) => void
  setAnswerSearch: (v: string) => void
  setAnswerPage: (v: number) => void
  bizCat: string
  setBizCat: (v: string) => void
  answerCategory: string
  setAnswerCategory: (v: string) => void
  NGO_AREAS: string[]
  catLabel: (id: string) => string
  userInteracted: { current: boolean }
  answerRegion: string
  setAnswerRegion: (v: string) => void
  answerAudience: string
  setAnswerAudience: (v: string) => void
}

export default function DirectoryControls({
  d,
  activeTab,
  bizSearch,
  answerSearch,
  setBizSearch,
  setBizPage,
  setAnswerSearch,
  setAnswerPage,
  bizCat,
  setBizCat,
  answerCategory,
  setAnswerCategory,
  NGO_AREAS,
  catLabel,
  userInteracted,
  answerRegion,
  setAnswerRegion,
  answerAudience,
  setAnswerAudience,
}: Props) {
  return (
    /* ── CONTROLS: search + chips + secondary filters in one block ── */
    <div
      className="dir-controls"
      id="dir-panel"
      role="tabpanel"
      aria-labelledby={`dir-tab-${activeTab}`}
    >
      {/* ── SEARCH (always visible, above fold) ────────────────────── */}
      <div className="dir-search">
        <Search size={17} aria-hidden="true" className="dir-search-icon" />
        <input
          type="search"
          value={activeTab === 'business' ? bizSearch : answerSearch}
          onChange={e => {
            if (activeTab === 'business') { setBizSearch(e.target.value); setBizPage(1) }
            else { setAnswerSearch(e.target.value); setAnswerPage(1) }
          }}
          placeholder={activeTab === 'business' ? d.searchPH : d.searchNGO}
          className="form-input dir-search-input"
          aria-label={activeTab === 'business' ? d.searchPH : d.searchNGO}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
      </div>

      {/* ── CATEGORY CHIPS (always visible, each with a lucide icon) ── */}
      {activeTab === 'business' ? (
        <div className="dir-chip-row" role="group" aria-label={d.filters}>
          {BIZ_CATS.map(cat => {
            const Icon = BIZ_CAT_ICONS[cat] || LayoutGrid
            return (
              <button
                key={cat}
                className={`filter-chip dir-chip${bizCat === cat ? ' active' : ''}`}
                aria-pressed={bizCat === cat}
                onClick={() => { setBizCat(cat); setBizPage(1) }}
              >
                <Icon size={15} aria-hidden="true" />
                {cat === 'all' ? d.filterAll : d.categories[cat]}
              </button>
            )
          })}
        </div>
      ) : (
        <>
          <div className="dir-chip-row" role="group" aria-label={d.filters}>
            {NGO_AREAS.map(area => {
              const Icon = NGO_AREA_ICONS[area] || LayoutGrid
              return (
                <button
                  key={area}
                  className={`filter-chip dir-chip${answerCategory === area ? ' active' : ''}`}
                  aria-pressed={answerCategory === area}
                  onClick={() => { userInteracted.current = true; setAnswerCategory(area); setAnswerPage(1) }}
                >
                  <Icon size={15} aria-hidden="true" />
                  {area === 'all' ? d.filterAll : catLabel(area)}
                </button>
              )
            })}
          </div>
          <div className="dir-filter-row">
            <input
              type="text"
              value={answerRegion}
              onChange={e => { setAnswerRegion(e.target.value); setAnswerPage(1) }}
              placeholder={d.regionPH}
              aria-label={d.regionPH}
              className="form-input"
            />
            <input
              type="text"
              value={answerAudience}
              onChange={e => { setAnswerAudience(e.target.value); setAnswerPage(1) }}
              placeholder={d.audiencePH}
              aria-label={d.audiencePH}
              className="form-input"
            />
          </div>
        </>
      )}
    </div>
  )
}
