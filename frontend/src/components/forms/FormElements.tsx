/**
 * FormElements — shared presentational form primitives used across every form
 * in the app (request intake, login, admin editors, etc). Thin wrappers over
 * native inputs that bake in the project's styling + accessible error/hint UX.
 *
 * Styling note: most class names are GLOBAL (`form-input`, `form-error`, ...)
 * defined in the global stylesheet; only FormRow uses the local CSS module.
 * Error a11y: when `error` is set the control gets aria-invalid + an
 * aria-describedby pointing at a `role="alert"` block (id from useId so it
 * stays unique per mounted instance). `hint` is suppressed while an error shows.
 * These are dumb/controlled-by-parent: validation state is passed in, not owned.
 */
import { useId } from 'react'
import { AlertCircle } from 'lucide-react'
import type { CSSProperties, ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import styles from './FormElements.module.css'

interface FormGroupProps {
  children?: ReactNode
  style?: CSSProperties
}

// vertical field wrapper (label + control + error/hint); takes optional inline style for one-off layout tweaks
export function FormGroup({ children, style }: FormGroupProps) {
  return <div className="form-group" style={style}>{children}</div>
}

interface LabelProps {
  htmlFor?: string
  children?: ReactNode
  required?: boolean
}

// field label; renders a visual `*` marker when `required` so callers don't hand-author it
export function Label({ htmlFor, children, required }: LabelProps) {
  return (
    <label className="form-label" htmlFor={htmlFor}>
      {children}
      {required && <span className="required">*</span>}
    </label>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: ReactNode
  hint?: ReactNode
}

// text input wrapper; passes through all native input props. `error` adds the shake/error style
// + wires aria, otherwise falls back to any aria the caller set. shows error block OR hint, never both.
export function Input({ error, hint, ...props }: InputProps) {
  const errorId = useId()
  return (
    <>
      <input
        className={`form-input${error ? ' error shake' : ''}`}
        {...props}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={error ? errorId : props['aria-describedby']}
      />
      {error && (
        <div id={errorId} className="form-error" role="alert">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </div>
      )}
      {hint && !error && <div className="form-hint">{hint}</div>}
    </>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: ReactNode
  hint?: ReactNode
  children?: ReactNode
}

// native select wrapper; same error/hint + aria behavior as Input, with `children` for <option>s.
// spread order (props then aria) mirrors Input so error-state aria overrides caller aria.
export function Select({ error, hint, children, ...props }: SelectProps) {
  const errorId = useId()
  return (
    <>
      <select
        className={`form-select${error ? ' error shake' : ''}`}
        {...props}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={error ? errorId : props['aria-describedby']}
      >
        {children}
      </select>
      {error && (
        <div id={errorId} className="form-error" role="alert">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </div>
      )}
      {hint && !error && <div className="form-hint">{hint}</div>}
    </>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: ReactNode
  hint?: ReactNode
}

// multiline input wrapper; identical error/hint + aria handling to Input.
export function Textarea({ error, hint, ...props }: TextareaProps) {
  const errorId = useId()
  return (
    <>
      <textarea
        className={`form-textarea${error ? ' error shake' : ''}`}
        {...props}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={error ? errorId : props['aria-describedby']}
      />
      {error && (
        <div id={errorId} className="form-error" role="alert">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </div>
      )}
      {hint && !error && <div className="form-hint">{hint}</div>}
    </>
  )
}

// horizontal row for laying multiple fields side by side; uses the local CSS module (not global classes)
export function FormRow({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.formRow}>
      {children}
    </div>
  )
}