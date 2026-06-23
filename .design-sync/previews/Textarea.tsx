import { Textarea, Label, FormGroup } from 'push-for-fulfillment-frontend'

const wrap = { display: 'grid', gap: 14, padding: 16, maxWidth: 380 } as const

export function Canonical() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="details" required>Describe your request</Label>
        <Textarea
          id="details"
          rows={4}
          defaultValue="Our family needs help moving a refrigerator and a bed frame to a new apartment in Haifa next week."
        />
      </FormGroup>
    </div>
  )
}

export function WithHint() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="notes">Notes for the volunteer</Label>
        <Textarea
          id="notes"
          rows={4}
          placeholder="Anything the volunteer should know before arriving..."
          hint="Optional. Visible only to the assigned volunteer."
        />
      </FormGroup>
    </div>
  )
}

export function ErrorState() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="reason" required>Reason for rejection</Label>
        <Textarea
          id="reason"
          rows={3}
          defaultValue="Out"
          error="Please give the beneficiary at least 20 characters of context."
        />
      </FormGroup>
    </div>
  )
}

export function Disabled() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="original">Original request</Label>
        <Textarea
          id="original"
          rows={3}
          disabled
          defaultValue="Requesting school supplies for two children before the new term."
        />
      </FormGroup>
    </div>
  )
}
