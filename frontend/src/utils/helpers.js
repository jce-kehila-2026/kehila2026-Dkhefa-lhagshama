// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

export const formatDate = (dateStr, lang = 'he') => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export const truncate = (str, n = 80) =>
  str.length <= n ? str : str.slice(0, n).trimEnd() + '…'
