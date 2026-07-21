import { useCallback } from 'react'
import { useSettings } from '../hooks/useSettings'
import { en, translations } from './translations'

// ── Types ─────────────────────────────────────────────────────────────────────
export type Locale = keyof typeof translations
export type TranslationKey = keyof typeof en

export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'pt-BR',    label: '🇧🇷 Português (BR)' },
  { value: 'en-US',    label: '🇺🇸 English (US)'   },
  { value: 'es-LATAM', label: '🌎 Español (LATAM)'  },
]

// Maps our locale keys to BCP-47 tags used by Intl APIs
export const DATE_LOCALE: Record<Locale, string> = {
  'pt-BR':    'pt-BR',
  'en-US':    'en-US',
  'es-LATAM': 'es-419',
}

// ── Core t() function ─────────────────────────────────────────────────────────
// Fallback chain: requested locale → en-US → key string (never throws/breaks)
export function t(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const str: string =
    (translations[locale] as Record<string, string>)[key] ??
    (translations['en-US'] as Record<string, string>)[key] ??
    (key as string)

  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

// ── useT() hook ───────────────────────────────────────────────────────────────
// Returns a bound translate function for the current locale.
// New reference only when locale changes — safe to use in dependency arrays.
export function useT() {
  const { settings } = useSettings()
  const locale = settings.locale
  return useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      t(locale, key, vars),
    [locale],
  )
}

// ── detectLocale() ────────────────────────────────────────────────────────────
// Maps navigator.language to one of our supported locales.
export function detectLocale(): Locale {
  const lang = navigator.language ?? 'en'
  if (lang.startsWith('pt')) return 'pt-BR'
  if (lang.startsWith('es')) return 'es-LATAM'
  return 'en-US'
}

// ── formatDailyDate() ─────────────────────────────────────────────────────────
// Returns the display date for the daily note heading (localized, long format).
// The filename always stays YYYY-MM-DD for correct sorting.
export function formatDailyDate(locale: Locale, date: Date = new Date()): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  }).format(date)
}
