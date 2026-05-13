import { useLanguage } from '../contexts/LanguageContext'
import { getStatusColor } from '../utils/helpers'

export default function StatusBadge({ status }) {
  const { t } = useLanguage()
  return (
    <span className={`badge ${getStatusColor(status)}`}>
      {t.status[status] || status}
    </span>
  )
}