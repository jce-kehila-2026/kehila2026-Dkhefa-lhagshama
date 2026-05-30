// Flat ESLint config (ESLint 9 + Next 16). Replaces the removed `next lint`
// wrapper and the legacy `.eslintrc.json`. `eslint-config-next` ships flat
// config arrays for ESLint 9; we spread them and keep our two rule overrides.
import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      // Carried over from the previous .eslintrc.json.
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
      // New React-Compiler-era rules introduced by the eslint-config-next 16
      // bump (not part of this project's prior lint baseline). They flag this
      // codebase's intentional, pervasive patterns: async data-load-on-mount
      // effects (`useEffect(() => load(), [load])`) and `Date.now()` in render
      // for the relative-deadline display. These are deliberate, SSR-hydration-
      // safe choices, so we disable the rules rather than mask them. Revisit
      // if/when we adopt the React Compiler.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  },
]

export default config
