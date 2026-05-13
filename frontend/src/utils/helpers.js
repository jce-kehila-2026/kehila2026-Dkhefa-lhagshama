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

export const generateTrackingId = () => {
  const year = new Date().getFullYear()
  const num = String(Math.floor(Math.random() * 9000) + 1000)
  return `PFF-${year}-${num}`
}

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export const exportToCSV = (data, filename) => {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const csv = [
    keys.join(','),
    ...data.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const debounce = (fn, delay = 300) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export const slugify = (str) =>
  str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')

export const truncate = (str, n = 80) =>
  str.length <= n ? str : str.slice(0, n).trimEnd() + '…'

export const getStatusColor = (status) => ({
  pending:    'badge-pending',
  review:     'badge-review',
  approved:   'badge-approved',
  rejected:   'badge-rejected',
  inProgress: 'badge-review',
  completed:  'badge-approved',
}[status] || 'badge-pending')

export const getCategoryIcon = (cat) => ({
  education:  '🎓',
  employment: '💼',
  legal:      '⚖️',
  social:     '🤝',
}[cat] || '📋')

export const getCategoryColor = (cat) => ({
  education:  { bg: '#EBF3FF', text: '#1A5EA0' },
  employment: { bg: '#E8F5EC', text: '#15803D' },
  legal:      { bg: '#FBF0C8', text: '#7C5F00' },
  social:     { bg: '#F5EBF8', text: '#6D28D9' },
}[cat] || { bg: '#F2F2F2', text: '#555' })

export const printElement = (id) => {
  const el = document.getElementById(id)
  if (!el) return
  const content = el.innerHTML
  const w = window.open('', '_blank')
  w.document.write(`
    <html dir="${document.documentElement.dir}" lang="${document.documentElement.lang}">
    <head>
      <title>Push for Fulfillment</title>
      <style>body{font-family:sans-serif;padding:24px;direction:inherit}</style>
    </head>
    <body>${content}</body>
    </html>`)
  w.document.close()
  w.print()
}