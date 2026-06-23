import { useState, useCallback } from 'react'
import type { ChangeEvent } from 'react'

type FormFieldEvent = ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>

export function useForm<T extends Record<string, unknown>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const handleChange = useCallback((e: FormFieldEvent) => {
    const target = e.target as HTMLInputElement
    const { name, value, type, checked } = target
    setValues((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }) as T)
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

  const isValid = Object.keys(errors).every((k) => !errors[k])

  return { values, errors, touched, handleChange, handleBlur, setValue, setError, setFieldErrors, reset, isValid }
}
