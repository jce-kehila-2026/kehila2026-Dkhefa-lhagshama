import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import styles from './Pagination.module.css'

interface PaginationProps {
  total: number
  perPage?: number
  current: number
  onChange: (page: number) => void
}

export default function Pagination({ total, perPage = 10, current, onChange }: PaginationProps) {
  const { t, isRTL } = useLanguage()
  const pages = Math.ceil(total / perPage)
  if (pages <= 1) return null

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft
  const NextIcon = isRTL ? ChevronLeft : ChevronRight

  const getPages = (): Array<number | '...'> => {
    const arr: Array<number | '...'> = []
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) arr.push(i)
    } else {
      arr.push(1)
      if (current > 3) arr.push('...')
      for (let i = Math.max(2, current - 1); i <= Math.min(pages - 1, current + 1); i++) arr.push(i)
      if (current < pages - 2) arr.push('...')
      arr.push(pages)
    }
    return arr
  }

  return (
    <div className={styles.root}>
      <button className="page-btn" onClick={() => onChange(current - 1)} disabled={current === 1}>
        <PrevIcon size={14} />
      </button>
      {getPages().map((p, i) => (
        p === '...'
          ? <span key={i} className={styles.ellipsis}>…</span>
          : <button key={i} className={`page-btn${p === current ? ' active' : ''}`} onClick={() => onChange(p)}>{p}</button>
      ))}
      <button className="page-btn" onClick={() => onChange(current + 1)} disabled={current === pages}>
        <NextIcon size={14} />
      </button>
      <span className={styles.count}>
        {t.common.page} {current} {t.common.of} {pages}
      </span>
    </div>
  )
}