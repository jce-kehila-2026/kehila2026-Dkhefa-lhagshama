import { StepIndicator } from 'push-for-fulfillment-frontend'

const wrap = { padding: 16, maxWidth: 560 } as const
const steps = ['Your details', 'Describe need', 'Attachments', 'Review & submit']

export function InProgress() {
  return (
    <div style={wrap}>
      <StepIndicator steps={steps} currentStep={2} progressLabel="Request progress" />
    </div>
  )
}

export function FirstStep() {
  return (
    <div style={wrap}>
      <StepIndicator steps={steps} currentStep={1} progressLabel="Request progress" />
    </div>
  )
}

export function FinalStep() {
  return (
    <div style={wrap}>
      <StepIndicator steps={steps} currentStep={4} progressLabel="Request progress" />
    </div>
  )
}
