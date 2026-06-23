import { Select, Label, FormGroup } from 'push-for-fulfillment-frontend'

const wrap = { display: 'grid', gap: 14, padding: 16, maxWidth: 380 } as const

export function Canonical() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="category" required>Request category</Label>
        <Select id="category" defaultValue="food">
          <option value="food">Food &amp; groceries</option>
          <option value="furniture">Furniture &amp; appliances</option>
          <option value="legal">Legal guidance</option>
          <option value="tutoring">Tutoring &amp; mentorship</option>
        </Select>
      </FormGroup>
    </div>
  )
}

export function WithHint() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="region">Preferred region</Label>
        <Select id="region" defaultValue="" hint="Choose the area closest to the beneficiary.">
          <option value="" disabled>Select a region</option>
          <option value="north">Northern District</option>
          <option value="center">Central District</option>
          <option value="jerusalem">Jerusalem District</option>
          <option value="south">Southern District</option>
        </Select>
      </FormGroup>
    </div>
  )
}

export function ErrorState() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="urgency" required>Urgency level</Label>
        <Select id="urgency" defaultValue="" error="Please choose an urgency level.">
          <option value="" disabled>Select urgency</option>
          <option value="low">Within a month</option>
          <option value="medium">Within two weeks</option>
          <option value="high">This week</option>
        </Select>
      </FormGroup>
    </div>
  )
}

export function Disabled() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="status">Assignment status</Label>
        <Select id="status" defaultValue="matched" disabled>
          <option value="matched">Matched with volunteer</option>
        </Select>
      </FormGroup>
    </div>
  )
}
