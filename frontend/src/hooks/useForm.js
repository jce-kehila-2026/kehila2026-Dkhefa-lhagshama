import { useState, useCallback } from 'react'

export function useForm(initialValues = {}) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    setValues(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    // Clear error on change
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }, [errors])

  const handleBlur = useCallback((e) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
  }, [])

  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }, [errors])

  const setError = useCallback((name, msg) => {
    setErrors(prev => ({ ...prev, [name]: msg }))
  }, [])

  const setFieldErrors = useCallback((errs) => {
    setErrors(prev => ({ ...prev, ...errs }))
    // Mark all errored fields as touched
    const touchedFields = {}
    Object.keys(errs).forEach(k => { touchedFields[k] = true })
    setTouched(prev => ({ ...prev, ...touchedFields }))
  }, [])

  const reset = useCallback((newValues = initialValues) => {
    setValues(newValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  const isValid = Object.keys(errors).every(k => !errors[k])

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    setValue,
    setError,
    setFieldErrors,
    reset,
    isValid,
  }
}

export function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial }
    catch { return initial }
  })
  const update = useCallback((v) => {
    const next = typeof v === 'function' ? v(val) : v
    setVal(next)
    localStorage.setItem(key, JSON.stringify(next))
  }, [key, val])
  return [val, update]
}