import { FormGroup, Label, Input, Select, Textarea } from 'push-for-fulfillment-frontend'

const wrap = { padding: 16, maxWidth: 380 } as const

export function Stacked() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="g-name" required>Full name</Label>
        <Input id="g-name" defaultValue="Yael Cohen" />
      </FormGroup>
      <FormGroup>
        <Label htmlFor="g-cat" required>Category</Label>
        <Select id="g-cat" defaultValue="furniture">
          <option value="food">Food &amp; groceries</option>
          <option value="furniture">Furniture &amp; appliances</option>
          <option value="legal">Legal guidance</option>
        </Select>
      </FormGroup>
      <FormGroup>
        <Label htmlFor="g-msg">Message</Label>
        <Textarea id="g-msg" rows={3} placeholder="Add any helpful details..." />
      </FormGroup>
    </div>
  )
}

export function WithError() {
  return (
    <div style={wrap}>
      <FormGroup>
        <Label htmlFor="g-email" required>Email address</Label>
        <Input id="g-email" defaultValue="yael@" error="Enter a valid email address." />
      </FormGroup>
    </div>
  )
}
