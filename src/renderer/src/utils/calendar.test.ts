import { describe, it, expect } from 'vitest'
import { toISO, fromISO, addMonths, monthGrid, isDailyNoteName, weekdayLabels } from './calendar'

describe('toISO / fromISO', () => {
  it('formats a local date', () => {
    expect(toISO(new Date(2026, 6, 5))).toBe('2026-07-05')
  })

  it('round-trips without shifting the day', () => {
    expect(toISO(fromISO('2026-01-01'))).toBe('2026-01-01')
    expect(toISO(fromISO('2026-12-31'))).toBe('2026-12-31')
  })

  it('reads YYYY-MM-DD as local, not UTC', () => {
    expect(fromISO('2026-07-21').getDate()).toBe(21)
  })
})

describe('isDailyNoteName', () => {
  it('accepts an ISO date name', () => {
    expect(isDailyNoteName('2026-07-21')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isDailyNoteName('Sepse')).toBe(false)
    expect(isDailyNoteName('2026-7-1')).toBe(false)
    expect(isDailyNoteName('2026-07-21 notas')).toBe(false)
  })
})

describe('addMonths', () => {
  it('moves forward and back', () => {
    expect(addMonths('2026-07-21', 1)).toBe('2026-08-21')
    expect(addMonths('2026-07-21', -1)).toBe('2026-06-21')
  })

  it('crosses the year boundary', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
  })

  it('clamps the day when the target month is shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29') // leap year
  })
})

describe('monthGrid', () => {
  it('always returns six weeks, so the grid never jumps', () => {
    expect(monthGrid('2026-07-21')).toHaveLength(42)
    expect(monthGrid('2026-02-10')).toHaveLength(42)
  })

  it('marks which days belong to the month', () => {
    const grid = monthGrid('2026-07-21')
    expect(grid.filter((d) => d.inMonth)).toHaveLength(31)
  })

  it('starts the week on Sunday by default', () => {
    // 1 July 2026 is a Wednesday, so the grid opens on Sunday 28 June
    expect(monthGrid('2026-07-21')[0].iso).toBe('2026-06-28')
  })

  it('can start the week on Monday', () => {
    expect(monthGrid('2026-07-21', 1)[0].iso).toBe('2026-06-29')
  })

  it('covers the whole month with no gaps', () => {
    const inMonth = monthGrid('2026-02-10').filter((d) => d.inMonth).map((d) => d.day)
    expect(inMonth[0]).toBe(1)
    expect(inMonth[inMonth.length - 1]).toBe(28)
  })

  it('handles a month starting exactly on the first grid day', () => {
    // 1 Feb 2026 is a Sunday
    expect(monthGrid('2026-02-01')[0].iso).toBe('2026-02-01')
  })
})

describe('weekdayLabels', () => {
  it('returns seven labels', () => {
    expect(weekdayLabels('pt-BR')).toHaveLength(7)
  })

  it('rotates when the week starts on Monday', () => {
    const sunday = weekdayLabels('en-US', 0)
    const monday = weekdayLabels('en-US', 1)
    expect(monday[0]).toBe(sunday[1])
    expect(monday[6]).toBe(sunday[0])
  })
})
