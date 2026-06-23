import { Label, Input, FormGroup } from 'push-for-fulfillment-frontend'

const wrap = { display: 'grid', gap: 14, padding: 16, maxWidth: 380 } as const

export function Default() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="city">City</Label>
        <Input id="city" defaultValue="Be'er Sheva" />
      </FormGroup>
    </div>
  )
}

export function Required() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="contact" required>Contact name</Label>
        <Input id="contact" placeholder="Who should we reach?" />
      </FormGroup>
    </div>
  )
}

export function Standalone() {
  return (
    <div style={{ ...wrap, gap: 18 }}>
      <Label>Volunteer availability</Label>
      <Label required>Donation amount</Label>
    </div>
  )
}
