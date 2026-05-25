import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light'

export interface Settings {
  theme: Theme
  fontSize: number
  editorFont: string
  sidebarWidth: number
}

const DEFAULTS: Settings = {
  theme: 'dark',
  fontSize: 14,
  editorFont: 'JetBrains Mono, Fira Code, monospace',
  sidebarWidth: 240
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

  const setSettings = (patch: Partial<Settings>) =>
    setSettingsState((s) => ({ ...s, ...patch }))

  return { settings, setSettings }
}
