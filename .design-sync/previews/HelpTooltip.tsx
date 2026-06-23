import { HelpTooltip } from 'push-for-fulfillment-frontend'

export function BesideLabel() {
  return (
    <div style={{ padding: 24, maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Availability window</span>
      <HelpTooltip
        text="The hours you can take on new requests. We only match you within this window."
        label="More about availability"
      />
    </div>
  )
}

export function InFieldRow() {
  return (
    <div style={{ padding: 24, maxWidth: 420, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Preferred categories</span>
        <HelpTooltip
          text="Choose the kinds of requests you'd like to help with, such as groceries or rides."
          label="More about categories"
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Travel radius</span>
        <HelpTooltip
          text="How far you're willing to travel to meet a beneficiary, measured from your home address."
          label="More about travel radius"
        />
      </div>
    </div>
  )
}
