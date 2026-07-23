import type { InkwellApi } from './index'

declare global {
  interface Window {
    inkwell: InkwellApi
  }
}
