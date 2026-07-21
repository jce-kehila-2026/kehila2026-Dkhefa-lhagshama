/**
 * CitySelect — the searchable locality picker used by EVERY city field.
 *
 * Replaces free-text city inputs and the old hardcoded 15-city <select>. The
 * committed value is the CBS locality code from GET /api/cities, never the
 * display name: names vary by language and spelling ("תל אביב" / "תל אביב - יפו"
 * / "Tel Aviv - Yafo") and a string comparison treats each as a different
 * place, which is what silently disabled the matcher's same-city signal.
 *
 * Typed text is a QUERY, not a value — unmatched text is discarded on blur and
 * the field snaps back to the last committed selection, so it is impossible to
 * store a locality that is not on the official list.
 *
 * Search matches the Hebrew name AND the Latin transliteration regardless of
 * the active UI language (typing "tel" in the Hebrew UI still finds תל אביב),
 * after folding away punctuation so "בני-ברק" matches "בני ברק".
 *
 * a11y: the WAI-ARIA combobox + listbox pattern (aria-expanded / aria-controls /
 * aria-activedescendant, roving highlight via keyboard). RTL-safe: layout uses
 * logical properties, no directional offsets.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { AlertCircle, ChevronDown, X } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCities } from '@/hooks/useCities'
import type { City } from '@/types'
import styles from './CitySelect.module.css'

/** Cap the rendered list: 1,310 localities is far too many DOM nodes to paint. */
const MAX_RESULTS = 50

/**
 * Fold a name or query to a comparable form: lowercase, strip the punctuation
 * that varies between spellings (hyphens, apostrophes, the Hebrew geresh and
 * gershayim, quotes, parens, dots), and collapse whitespace. Keeps letters and
 * digits only, so "בני-ברק" ≡ "בני ברק" and "BE'ER SHEVA" ≡ "beer sheva".
 */
function fold(value: string): string {
  return value
    .toLocaleLowerCase('he')
    .replace(/[-'"׳״()./\\,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Rank matches so the obvious answer is first: names that START with the query
 * outrank names that merely contain it; ties keep the API's Hebrew sort.
 * Returns at most MAX_RESULTS + a flag for whether more were dropped.
 */
function searchCities(cities: City[], query: string): { results: City[]; truncated: boolean } {
  const q = fold(query)
  if (!q) return { results: cities.slice(0, MAX_RESULTS), truncated: cities.length > MAX_RESULTS }

  const prefix: City[] = []
  const contains: City[] = []

  for (const city of cities) {
    const he = fold(city.nameHe)
    const en = fold(city.nameEn)
    if (he.startsWith(q) || en.startsWith(q)) prefix.push(city)
    else if (he.includes(q) || en.includes(q)) contains.push(city)
  }

  const all = [...prefix, ...contains]
  return { results: all.slice(0, MAX_RESULTS), truncated: all.length > MAX_RESULTS }
}

interface CitySelectProps {
  id: string
  /** Committed CBS locality code ('' when nothing is chosen). */
  value: string
  /** Fires with the code (and the full record) on selection, or '' when cleared. */
  onChange: (code: string, city: City | null) => void
  /**
   * Display-only name for a record written before the picker existed, which
   * stored free text and no code. Shown when `value` is empty so an editor sees
   * the current locality instead of a blank field; it is never submitted — only
   * a real pick sets a value.
   */
  fallbackName?: string
  error?: ReactNode
  hint?: ReactNode
  required?: boolean
  disabled?: boolean
  placeholder?: string
  /** Marks the field invalid for callers that validate outside `error`. */
  'aria-invalid'?: boolean
}

export default function CitySelect({
  id,
  value,
  onChange,
  fallbackName,
  error,
  hint,
  required,
  disabled,
  placeholder,
  'aria-invalid': ariaInvalid,
}: CitySelectProps) {
  const { t, lang } = useLanguage()
  const c = t.common.citySelect
  const { cities, loading, labelFor } = useCities()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const errorId = useId()
  const listId = useId()
  const statusId = useId()

  // Display text: the committed selection's name while closed, the live query
  // while the user is searching. With no committed code, fall back to a legacy
  // free-text name so an editor can still see what the record holds.
  const selectedLabel = labelFor(value, lang) || (value ? '' : (fallbackName ?? ''))
  const displayValue = open ? query : selectedLabel

  const { results, truncated } = useMemo(
    () => searchCities(cities, open ? query : ''),
    [cities, query, open],
  )

  // Keep the highlight in range whenever the result set changes under it.
  useEffect(() => {
    setActiveIndex((i) => (i >= results.length ? 0 : i))
  }, [results.length])

  // Scroll the highlighted option into view during keyboard navigation.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  // Close (and discard any unmatched query) when focus or a click leaves.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  /** Leave search mode. The query is deliberately dropped — only a real pick commits. */
  function close() {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  function openSearch() {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setActiveIndex(0)
  }

  function commit(city: City) {
    onChange(city.code, city)
    close()
    inputRef.current?.focus()
  }

  function clear() {
    onChange('', null)
    close()
    inputRef.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return

    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault()
      openSearch()
      return
    }
    if (!open) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(Math.max(0, results.length - 1))
        break
      case 'Enter': {
        e.preventDefault()
        const picked = results[activeIndex]
        if (picked) commit(picked)
        break
      }
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        // Let focus move on, but never keep a half-typed query as the value.
        close()
        break
      default:
        break
    }
  }

  const describedBy = [error ? errorId : null, statusId].filter(Boolean).join(' ')

  return (
    <>
      <div className={styles.wrap} ref={wrapRef}>
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          className={`form-input ${styles.input}${error ? ' error shake' : ''}`}
          value={displayValue}
          placeholder={loading ? c.loading : (placeholder || c.placeholder)}
          disabled={disabled || loading}
          required={required}
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[activeIndex] ? `${listId}-${results[activeIndex].code}` : undefined}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={describedBy || undefined}
          onFocus={openSearch}
          onClick={openSearch}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIndex(0)
            if (!open) setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />

        {/* Clear is only meaningful once something is committed. */}
        {value && !open && !disabled ? (
          <button type="button" className={styles.trailingBtn} onClick={clear} aria-label={c.clear}>
            <X size={16} aria-hidden="true" />
          </button>
        ) : (
          <span className={styles.trailingIcon} aria-hidden="true">
            <ChevronDown size={16} />
          </span>
        )}

        {open && (
          <ul className={styles.list} id={listId} role="listbox" ref={listRef} aria-label={c.instructions}>
            {results.length === 0 ? (
              <li className={styles.empty} role="presentation">
                {cities.length === 0 ? c.loadFailed : c.noResults}
              </li>
            ) : (
              <>
                {results.map((city, i) => (
                  <li
                    key={city.code}
                    id={`${listId}-${city.code}`}
                    role="option"
                    aria-selected={city.code === value}
                    data-active={i === activeIndex}
                    className={`${styles.option}${i === activeIndex ? ` ${styles.optionActive}` : ''}`}
                    // mousedown (not click) so the pick lands before the input blurs
                    onMouseDown={(e) => {
                      e.preventDefault()
                      commit(city)
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className={styles.optionPrimary}>{lang === 'he' ? city.nameHe : city.nameEn}</span>
                    {/* Show the other-language name so a picker is unambiguous either way. */}
                    <span className={styles.optionSecondary}>{lang === 'he' ? city.nameEn : city.nameHe}</span>
                  </li>
                ))}
                {truncated && (
                  <li className={styles.more} role="presentation">
                    {c.moreResults.replace('{n}', String(MAX_RESULTS))}
                  </li>
                )}
              </>
            )}
          </ul>
        )}
      </div>

      {/* Result count for screen readers, announced as the query narrows. */}
      <span id={statusId} className="sr-only" role="status" aria-live="polite">
        {open ? String(results.length) : ''}
      </span>

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
