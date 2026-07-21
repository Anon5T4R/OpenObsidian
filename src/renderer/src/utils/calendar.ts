// Month grid maths for the daily-note calendar.
// Pure and injectable: date code that reads the clock directly is the kind
// that breaks once a year, at a month boundary, on someone else's machine.

export interface CalendarDay {
  /** YYYY-MM-DD */
  iso: string
  day: number
  /** False for the leading/trailing days that pad the grid */
  inMonth: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayISO = (now: Date = new Date()): string => toISO(now)

/** Parses YYYY-MM-DD as a local date (not UTC, which shifts the day). */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function isDailyNoteName(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(name)
}

/** Adds months, clamping the day so 31 Jan + 1 month is the end of February. */
export function addMonths(iso: string, delta: number): string {
  const base = fromISO(iso)
  const target = new Date(base.getFullYear(), base.getMonth() + delta, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(base.getDate(), lastDay))
  return toISO(target)
}

/**
 * Six weeks of days covering the month `iso` falls in, padded with the
 * neighbouring months so the grid never changes height between months.
 * `weekStart` is 0 for Sunday, 1 for Monday.
 */
export function monthGrid(iso: string, weekStart = 0): CalendarDay[] {
  const base = fromISO(iso)
  const first = new Date(base.getFullYear(), base.getMonth(), 1)
  const offset = (first.getDay() - weekStart + 7) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)

  const days: CalendarDay[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    days.push({ iso: toISO(d), day: d.getDate(), inMonth: d.getMonth() === base.getMonth() })
  }
  return days
}

/** Month name plus year, in the user's locale. */
export function monthLabel(iso: string, locale: string): string {
  const d = fromISO(iso)
  const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Weekday initials in display order, starting at `weekStart`. */
export function weekdayLabels(locale: string, weekStart = 0): string[] {
  const out: string[] = []
  // 2026-07-05 is a Sunday — any known Sunday works as the anchor
  const sunday = new Date(2026, 6, 5)
  for (let i = 0; i < 7; i++) {
    const d = new Date(2026, 6, sunday.getDate() + ((i + weekStart) % 7))
    out.push(d.toLocaleDateString(locale, { weekday: 'narrow' }))
  }
  return out
}
