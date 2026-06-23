import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const PKG = process.argv[2] || '.ds-pkg'
const SRC = `${PKG}/src/components`
const OUT = `${PKG}/.ds-build/exports-barrel.ts`

const files = []
;(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(tsx|ts)$/.test(e)) files.push(p)
  }
})(SRC)

const patterns = [
  /export\s+default\s+function\s+([A-Z]\w*)/,
  /export\s+default\s+class\s+([A-Z]\w*)/,
  /export\s+default\s+(?:React\.)?memo\(\s*(?:function\s+)?([A-Z]\w*)/,
  /export\s+default\s+(?:React\.)?forwardRef\([^)]*?function\s+([A-Z]\w*)/,
  /export\s+default\s+([A-Z]\w*)\s*;?\s*$/m,
]

const lines = []
const skipped = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  if (!/export\s+default/.test(src)) continue
  let name = null
  for (const re of patterns) {
    const m = src.match(re)
    if (m) { name = m[1]; break }
  }
  const imp = '@/components/' + relative(SRC, f).replace(/\.(tsx|ts)$/, '')
  if (name) lines.push(`export { default as ${name} } from '${imp}'`)
  else skipped.push(imp)
}

writeFileSync(OUT, lines.join('\n') + '\n')
console.error(`barrel: ${lines.length} default-export components` +
  (skipped.length ? `; UNRESOLVED defaults: ${skipped.join(', ')}` : ''))
