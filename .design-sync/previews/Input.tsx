import { Input, Label, FormGroup } from 'push-for-fulfillment-frontend'

const wrap = { display: 'grid', gap: 14, padding: 16, maxWidth: 380 } as const

export function Canonical() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="full-name" required>Full name</Label>
        <Input id="full-name" defaultValue="Dana Levi" placeholder="Enter your full name" />
      </FormGroup>
      <FormGroup>
        <Label htmlFor="org">Organization</Label>
        <Input id="org" placeholder="Business or charity name" />
      </FormGroup>
    </div>
  )
}

export function WithHint() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="phone" required>Phone number</Label>
        <Input id="phone" type="tel" defaultValue="054-218-3390" hint="We'll only call to follow up on your request." />
      </FormGroup>
    </div>
  )
}

export function ErrorState() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="email" required>Email address</Label>
        <Input id="email" defaultValue="dana.levi@" placeholder="you@example.org" error="Enter a valid email address." />
      </FormGroup>
    </div>
  )
}

export function Disabled() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="ref">Request reference</Label>
        <Input id="ref" defaultValue="REQ-4821" disabled hint="Assigned automatically once submitted." />
      </FormGroup>
    </div>
  )
}
