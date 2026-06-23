import { ConfirmDialog } from 'push-for-fulfillment-frontend'

export function DangerVariant() {
  return (
    <div style={{ padding: 16, minHeight: 360, position: 'relative' }}>
      <ConfirmDialog
        open
        variant="danger"
        title="Reject this request?"
        message="The beneficiary will be notified that we couldn't fulfill REQ-4821. This can't be undone."
        confirmLabel="Reject request"
        cancelLabel="Keep open"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </div>
  )
}

export function DefaultVariant() {
  return (
    <div style={{ padding: 16, minHeight: 360, position: 'relative' }}>
      <ConfirmDialog
        open
        title="Assign to Dana Levi?"
        message="Dana will receive the request details and the beneficiary's contact information."
        confirmLabel="Assign volunteer"
        cancelLabel="Cancel"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </div>
  )
}

export function SingleAction() {
  return (
    <div style={{ padding: 16, minHeight: 360, position: 'relative' }}>
      <ConfirmDialog
        open
        title="Profile saved"
        message="Your availability and preferred categories have been updated."
        confirmLabel="Got it"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </div>
  )
}
