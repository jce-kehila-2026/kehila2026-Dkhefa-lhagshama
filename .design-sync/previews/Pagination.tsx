import { Pagination } from 'push-for-fulfillment-frontend'

export function FirstPage() {
  return (
    <div style={{ padding: 16, maxWidth: 560 }}>
      <Pagination total={48} perPage={10} current={1} onChange={() => {}} />
    </div>
  )
}

export function MiddleWithEllipsis() {
  return (
    <div style={{ padding: 16, maxWidth: 560 }}>
      <Pagination total={240} perPage={10} current={12} onChange={() => {}} />
    </div>
  )
}

export function FewPages() {
  return (
    <div style={{ padding: 16, maxWidth: 560 }}>
      <Pagination total={35} perPage={10} current={2} onChange={() => {}} />
    </div>
  )
}

export function LastPage() {
  return (
    <div style={{ padding: 16, maxWidth: 560 }}>
      <Pagination total={132} perPage={10} current={14} onChange={() => {}} />
    </div>
  )
}
