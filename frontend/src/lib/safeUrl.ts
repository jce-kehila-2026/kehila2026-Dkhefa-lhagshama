// Shared href guard for externally-sourced URLs (answer.sourceUrl,
// business.website, suggestion.sourceUrl). The backend write paths already
// scheme-validate to http(s), but rendering links self-defending here removes
// the only place a non-http value (legacy doc, manual console edit) could turn
// into a javascript:/data: link-injection sink. Returns the URL only when it
// parses to an http(s) scheme, otherwise undefined so callers fall back to
// rendering plain text.

// true only when value is a non-empty string that parses to an http(s) URL.
// the WHATWG URL parser does the scheme/structure validation; we just gate on protocol.
export function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    // unparseable input (relative, malformed, javascript:, etc.) is not a usable href
    return false
  }
}

// returns the trimmed http(s) url for use as an href, or undefined when unsafe
// (caller then renders plain text instead of a link).
export function safeHref(value: unknown): string | undefined {
  return isHttpUrl(value) ? String(value).trim() : undefined
}
