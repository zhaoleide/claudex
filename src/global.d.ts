import type { ClaudexApi } from '../electron/preload'

declare global {
  interface Window {
    claudex: ClaudexApi
  }
}

export {}
