import { useEffect } from 'react'
import { Modal, useApp } from 'push-for-fulfillment-frontend'

function DriveModal({ title, content, footer }: { title: React.ReactNode; content: React.ReactNode; footer?: React.ReactNode }) {
  const { openModal } = useApp()
  useEffect(() => {
    openModal({ title, content, footer } as unknown as React.ReactNode)
  }, [openModal, title, content, footer])
  return <Modal />
}

export function RequestDetail() {
  return (
    <div style={{ padding: 16, minHeight: 360, position: 'relative' }}>
      <DriveModal
        title="Request REQ-4821"
        content={
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={{ margin: 0, color: 'var(--ink)', fontSize: 14 }}>
              Grocery delivery for an elderly beneficiary in Haifa. Preferred window: weekday mornings.
            </p>
            <p style={{ margin: 0, color: 'var(--gray-500)', fontSize: 13 }}>
              Submitted 3 days ago · No volunteer assigned yet.
            </p>
          </div>
        }
        footer={
          <>
            <button className="btn btn-outline">Close</button>
            <button className="btn btn-primary">Assign volunteer</button>
          </>
        }
      />
    </div>
  )
}

export function Notice() {
  return (
    <div style={{ padding: 16, minHeight: 360, position: 'relative' }}>
      <DriveModal
        title="Match confirmed"
        content={
          <p style={{ margin: 0, color: 'var(--ink)', fontSize: 14 }}>
            Dana Levi has accepted this request. We've notified the beneficiary and shared contact details.
          </p>
        }
        footer={<button className="btn btn-primary">Got it</button>}
      />
    </div>
  )
}
