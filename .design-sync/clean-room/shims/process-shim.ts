declare const globalThis: any

if (typeof globalThis.process === 'undefined') {
  globalThis.process = { env: {} }
} else if (typeof globalThis.process.env === 'undefined') {
  globalThis.process.env = {}
}

export const __dsProcessShim = true
