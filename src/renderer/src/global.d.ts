import type { InkwellApi } from '../../preload'

declare global {
  interface Window {
    /** Provided by the Electron preload script; missing when previewed in a plain browser. */
    inkwell?: InkwellApi
  }
}

export {}
