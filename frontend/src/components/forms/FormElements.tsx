import { useId } from 'react'
import { AlertCircle } from 'lucide-react'
import type { CSSProperties, ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface FormGroupProps {
  children?: ReactNode
  style?: CSSProperties
}

export function FormGroup({ children, style }: FormGroupProps) {
  return <div className="form-group" style={style}>{children}</div>
}

interface LabelProps {
  htmlFor?: string
  children?: ReactNode
  required?: boolean
}

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

export function FormRow({ children }: { children?: ReactNode }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
      {children}
    </div>
  )
}