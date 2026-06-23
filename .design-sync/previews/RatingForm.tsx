import { RatingForm } from 'push-for-fulfillment-frontend'

const wrap = { padding: 16, maxWidth: 420 } as const

export function Empty() {
  return (
    <div style={wrap}>
      <RatingForm onSubmit={() => {}} />
    </div>
  )
}

export function Prefilled() {
  return (
    <div style={wrap}>
      <RatingForm
        onSubmit={() => {}}
        initialStars={4}
        initialComment="The volunteer arrived on time and helped us move everything. Thank you for the support."
      />
    </div>
  )
}

export function Submitting() {
  return (
    <div style={wrap}>
      <RatingForm onSubmit={() => {}} initialStars={5} submitting />
    </div>
  )
}
