import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Store, HeartHandshake, Handshake } from 'lucide-react'
import type { TNode } from '@/types'

type Props = {
  d: TNode
  activeTab: string
  tabStyle: (active: boolean) => CSSProperties
  selectTab: (tab: string) => void
  onTablistKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void
}

export default function DirectoryTabs({ d, activeTab, tabStyle, selectTab, onTablistKeyDown }: Props) {
  return (
    /* Segmented tab control sits at the header baseline (no overlap).
        Roving tabindex + arrow-key handling implement the WAI-ARIA tabs
        pattern; each tab controls the results panel below. */
    <div
      role="tablist"
      aria-label={d.pageTitle}
      className="dir-tabs"
      onKeyDown={onTablistKeyDown}
    >
      <button
        role="tab"
        id="dir-tab-business"
        aria-selected={activeTab === 'business'}
        aria-controls="dir-panel"
        tabIndex={activeTab === 'business' ? 0 : -1}
        className="dir-tab"
        style={tabStyle(activeTab === 'business')}
        onClick={() => selectTab('business')}
      >
        <Store size={15} aria-hidden="true" />
        {d.tabBusiness}
      </button>
      <button
        role="tab"
        id="dir-tab-ngo"
        aria-selected={activeTab === 'ngo'}
        aria-controls="dir-panel"
        tabIndex={activeTab === 'ngo' ? 0 : -1}
        className="dir-tab"
        style={tabStyle(activeTab === 'ngo')}
        onClick={() => selectTab('ngo')}
      >
        <HeartHandshake size={15} aria-hidden="true" />
        {d.tabNGO}
      </button>
      <button
        role="tab"
        id="dir-tab-partner"
        aria-selected={activeTab === 'partner'}
        aria-controls="dir-panel"
        tabIndex={activeTab === 'partner' ? 0 : -1}
        className="dir-tab"
        style={tabStyle(activeTab === 'partner')}
        onClick={() => selectTab('partner')}
      >
        <Handshake size={15} aria-hidden="true" />
        {d.tabPartner}
      </button>
    </div>
  )
}
