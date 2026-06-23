import { MagneticButton } from 'push-for-fulfillment-frontend'

export function Variants() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 24, alignItems: 'center' }}>
      <MagneticButton className="btn btn-primary">Submit request</MagneticButton>
      <MagneticButton className="btn btn-ember">Get involved</MagneticButton>
      <MagneticButton className="btn btn-outline">Learn more</MagneticButton>
      <MagneticButton className="btn btn-ghost">Cancel</MagneticButton>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 24, alignItems: 'center' }}>
      <MagneticButton className="btn btn-primary btn-sm">Small</MagneticButton>
      <MagneticButton className="btn btn-primary">Default</MagneticButton>
      <MagneticButton className="btn btn-primary btn-lg">Large</MagneticButton>
    </div>
  )
}
