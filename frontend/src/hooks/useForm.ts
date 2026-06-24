/*
 * useForm.ts — the app's tiny controlled-form state hook.
 * Owns the three pieces of state every form needs: field `values`, per-field `errors`, and
 * which fields have been `touched` (blurred). It is intentionally validation-agnostic — callers
 * decide when something is wrong and push it in via setError/setFieldErrors (e.g. after a server
 * 400). Generic over the form shape `T` so `values` stays typed at the call site.
 * Big-picture invariant: an error auto-clears the moment its field changes (handleChange/setValue),
 * so stale errors never linger while the user is fixing them.
 */
import { useState, useCallback } from 'react'
import type { ChangeEvent } from 'react'

type FormFieldEvent = ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>

export function useForm<T extends Record<string, unknown>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const handleChange = useCallback((e: FormFieldEvent) => {
    // Cast to the widest input type so checkbox `checked` is reachable; checkboxes store
    // their boolean, every other control stores its string value.
    const target = e.target as HTMLInputElement
    const { name, value, type, checked } = target
    setValues((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }) as T)
    // Editing a field clears its error; only allocate a new object if there was one to clear.
    setErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))
  }, [])

  const handleBlur = useCallback((e: FormFieldEvent) => {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
  }, [])

  const setValue = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }) as T)
    setErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev))
  }, [])

  const setError = useCallback((name: string, msg: string) => {
    setErrors((prev) => ({ ...prev, [name]: msg }))
  }, [])

  // Bulk-apply errors (e.g. a server validation map) and mark each named field touched, so the
  // messages show immediately even on fields the user never blurred.
  const setFieldErrors = useCallback((errs: Record<string, string>) => {
    setErrors((prev) => ({ ...prev, ...errs }))
    setTouched((prev) => {
      const next = { ...prev }
      Object.keys(errs).forEach((k) => { next[k] = true })
      return next
    })
  }, [])

  const reset = useCallback((newValues: T = initialValues) => {
    setValues(newValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  // Valid means no error message is currently non-empty (cleared entries count as valid).
  const isValid = Object.keys(errors).every((k) => !errors[k])

  return { values, errors, touched, handleChange, handleBlur, setValue, setError, setFieldErrors, reset, isValid }
}
