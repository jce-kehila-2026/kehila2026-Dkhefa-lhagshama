// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

export const formatDate = (dateStr?: string | number | Date | null, lang: string = 'he'): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export const truncate = (str?: string | null, n: number = 80): string =>
  !str ? '' : str.length <= n ? str : str.slice(0, n).trimEnd() + '…'
