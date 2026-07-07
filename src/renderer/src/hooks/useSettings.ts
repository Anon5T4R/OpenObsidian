import { useState, useEffect, useCallback } from 'react'
import type { Locale } from '../i18n'
import { detectLocale } from '../i18n'

export type Theme = 'dark' | 'light'
export type SidebarSort = 'name' | 'name-desc' | 'modified'

export interface Settings {
  theme: Theme
  fontSize: number
  editorFont: string
  sidebarWidth: number
  sidebarSort: SidebarSort
  locale: Locale
}

const DEFAULTS: Settings = {
  theme:       'dark',
  fontSize:    14,
  editorFont:  'JetBrains Mono, Fira Code, monospace',
  sidebarWidth: 240,
  sidebarSort: 'name',
  locale:      detectLocale(),
}

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('oo-settings') ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(load)

  useEffect(() => {
    localStorage.setItem('oo-settings', JSON.stringify(settings))
    const root = document.documentElement
    root.setAttribute('data-theme', settings.theme)
    root.style.setProperty('--font-size-editor', `${settings.fontSize}px`)
    root.style.setProperty('--editor-font', settings.editorFont)
  }, [settings])

  // Stable identity — memoized children receive this (directly or wrapped)
  const setSettings = useCallback((patch: Partial<Settings>) =>
    setSettingsState((s) => ({ ...s, ...patch })), [])

  return { settings, setSettings }
}
