import { AlertCircle } from 'lucide-react'

export function FormGroup({ children, style }) {
  return <div className="form-group" style={style}>{children}</div>
}

export function Label({ htmlFor, children, required }) {
  return (
    <label className="form-label" htmlFor={htmlFor}>
      {children}
      {required && <span className="required">*</span>}
    </label>
  )
}

export function Input({ error, hint, ...props }) {
  return (
    <>
      <input className={`form-input${error ? ' error' : ''}`} {...props} />
      {error && (
        <div className="form-error">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
      {hint && !error && <div className="form-hint">{hint}</div>}
    </>
  )
}

export function Select({ error, hint, children, ...props }) {
  return (
    <>
      <select className={`form-select${error ? ' error' : ''}`} {...props}>
        {children}
      </select>
      {error && (
        <div className="form-error">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
      {hint && !error && <div className="form-hint">{hint}</div>}
    </>
  )
}

export function Textarea({ error, hint, ...props }) {
  return (
    <>
      <textarea className={`form-textarea${error ? ' error' : ''}`} {...props} />
      {error && (
        <div className="form-error">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
      {hint && !error && <div className="form-hint">{hint}</div>}
    </>
  )
}

export function FormRow({ children }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
      {children}
    </div>
  )
}