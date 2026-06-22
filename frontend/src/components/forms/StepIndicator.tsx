/*
 * StepIndicator — presentational progress stepper for multi-step forms (e.g. the
 * UC-01 Smart Request Form's wizard). Renders an ordered list of step labels and
 * marks each as done / active / upcoming relative to `currentStep`, with a
 * connecting rail between nodes. Stateless and i18n-agnostic: the caller owns
 * step progression and passes already-translated labels + the aria landmark text.
 * Styling is split between the local CSS module (layout per step) and global
 * `.stepper*` classes (node/dot/rail visual states).
 *
 * Key invariant: `currentStep` is 1-indexed (1 = first step), matching the
 * displayed node numbers; `steps` order is the canonical step order.
 */
import { Check } from 'lucide-react'
import styles from './StepIndicator.module.css'

interface StepIndicatorProps {
  steps: string[]
  // 1-indexed pointer to the step the user is on; drives done/active/upcoming state.
  currentStep: number
  // localizes the progress landmark's aria-label; falls back to the English literal when omitted.
  progressLabel?: string
}

export default function StepIndicator({ steps, currentStep, progressLabel = 'Progress' }: StepIndicatorProps) {
  return (
    <div className="stepper" role="list" aria-label={progressLabel}>
      {steps.map((label, i) => {
        // num is the 1-indexed step number so it can be compared against currentStep directly.
        const num = i + 1
        const isDone = num < currentStep
        const isActive = num === currentStep
        const state = isDone ? 'is-done' : isActive ? 'is-active' : 'is-upcoming'
        return (
          // last step shrinks (0 0 auto) so it owns no trailing rail; earlier steps grow to fill the row.
          <div key={i} className={styles.step} style={{ flex: i < steps.length - 1 ? '1 1 auto' : '0 0 auto' }}>
            {/* aria-current="step" marks only the active node for assistive tech; the dot is decorative. */}
            <div className={`stepper-node ${state}`} role="listitem" aria-current={isActive ? 'step' : undefined}>
              <span className="stepper-dot" aria-hidden="true">
                {/* completed steps show a check; the rest show their step number */}
                {isDone ? <Check size={16} strokeWidth={3} /> : num}
              </span>
              <span className="stepper-label">{label}</span>
            </div>
            {/* connecting rail rendered after every node except the last; filled once that step is done */}
            {i < steps.length - 1 && (
              <span className={`stepper-rail ${isDone ? 'is-done' : ''}`} aria-hidden="true" />
            )}
          </div>
        )
      })}
    </div>
  )
}
