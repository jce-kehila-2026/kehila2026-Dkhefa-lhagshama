import { Check } from 'lucide-react'

export default function StepIndicator({ steps, currentStep }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      marginBottom:'36px', flexWrap:'nowrap',
    }}>
      {steps.map((label, i) => {
        const num = i + 1
        const isDone   = num < currentStep
        const isActive = num === currentStep
        return (
          <div key={i} style={{ display:'flex', alignItems:'center' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div className={`step-dot ${isDone ? 'done' : isActive ? 'active' : 'todo'}`}>
                {isDone ? <Check size={14} strokeWidth={3} /> : num}
              </div>
              <span style={{
                fontSize:'11.5px',
                marginTop:'6px',
                color: isActive ? 'var(--navy)' : isDone ? 'var(--gold)' : 'var(--gray-400)',
                fontWeight: isActive ? 600 : 400,
                whiteSpace:'nowrap',
                maxWidth:'76px', textAlign:'center', lineHeight:1.3,
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`step-connector ${isDone ? 'done' : ''}`}
                style={{ marginBottom:'20px', marginInline:'6px' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}