import React from 'react'

const NEXT_ONLY = new Set([
  'prefetch', 'scroll', 'replace', 'shallow', 'passHref',
  'legacyBehavior', 'locale', 'as',
])

export default function Link(props: any) {
  const { href, to, children, ...rest } = props
  const domProps: Record<string, unknown> = {}
  for (const k of Object.keys(rest)) {
    if (!NEXT_ONLY.has(k)) domProps[k] = rest[k]
  }
  const resolved =
    typeof href === 'string' ? href : href?.pathname ?? to ?? '#'
  return React.createElement('a', { href: resolved, ...domProps }, children)
}
