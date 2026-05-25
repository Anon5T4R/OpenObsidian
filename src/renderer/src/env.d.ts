/// <reference types="vite/client" />
import type { AppAPI } from '../../../types/shared'

declare global {
  interface Window {
    api: AppAPI
  }
}
