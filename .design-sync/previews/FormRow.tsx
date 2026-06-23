import { FormRow, FormGroup, Label, Input, Select } from 'push-for-fulfillment-frontend'

const wrap = { padding: 16, maxWidth: 520 } as const

export function TwoFields() {
  return (
    <div style={wrap}>
      <FormRow>
        <FormGroup>
          <Label htmlFor="first" required>First name</Label>
          <Input id="first" defaultValue="Noa" />
        </FormGroup>
        <FormGroup>
          <Label htmlFor="last" required>Last name</Label>
          <Input id="last" defaultValue="Mizrahi" />
        </FormGroup>
      </FormRow>
    </div>
  )
}

export function MixedFields() {
  return (
    <div style={wrap}>
      <FormRow>
        <FormGroup>
          <Label htmlFor="city" required>City</Label>
          <Input id="city" defaultValue="Tel Aviv" />
        </FormGroup>
        <FormGroup>
          <Label htmlFor="district">District</Label>
          <Select id="district" defaultValue="center">
            <option value="north">Northern</option>
            <option value="center">Central</option>
            <option value="south">Southern</option>
          </Select>
        </FormGroup>
      </FormRow>
    </div>
  )
}

export function WithError() {
  return (
    <div style={wrap}>
      <FormRow>
        <FormGroup>
          <Label htmlFor="phone" required>Phone</Label>
          <Input id="phone" defaultValue="052" error="Phone number is too short." />
        </FormGroup>
        <FormGroup>
          <Label htmlFor="ext">Extension</Label>
          <Input id="ext" placeholder="Optional" />
        </FormGroup>
      </FormRow>
    </div>
  )
}
