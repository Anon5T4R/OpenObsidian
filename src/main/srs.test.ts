import { describe, it, expect } from 'vitest'
import {
  newCard, grade, isDue, dueCards, stats, syncFile, todayISO, addDays,
  CardState, SrsFile,
} from './srs'

const NOW = new Date(2026, 6, 21, 10, 0, 0) // 2026-07-21, local time
const TODAY = '2026-07-21'

const card = (over: Partial<CardState> = {}): CardState => ({
  file: 'Sepse.md', q: 'Tríade do qSOFA?',
  ease: 2.5, interval: 0, reps: 0, due: TODAY, lapses: 0,
  ...over,
})

describe('todayISO / addDays', () => {
  it('formats the local date, not UTC', () => {
    expect(todayISO(NOW)).toBe(TODAY)
  })

  it('adds days across a month boundary', () => {
    expect(addDays('2026-07-30', 3)).toBe('2026-08-02')
  })

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('newCard', () => {
  it('starts due today — writing a card means wanting to learn it', () => {
    const c = newCard('a.md', 'q', NOW)
    expect(c.due).toBe(TODAY)
    expect(c.ease).toBe(2.5)
    expect(c.reps).toBe(0)
  })
})

describe('grade', () => {
  it('"again" resets reps, keeps it due today and counts a lapse', () => {
    const c = grade(card({ reps: 5, interval: 30, lapses: 1 }), 'again', NOW)
    expect(c.reps).toBe(0)
    expect(c.interval).toBe(0)
    expect(c.due).toBe(TODAY)
    expect(c.lapses).toBe(2)
    expect(c.ease).toBeCloseTo(2.3)
  })

  it('never lets ease fall below 1.3', () => {
    let c = card({ ease: 1.35 })
    c = grade(c, 'again', NOW)
    c = grade(c, 'again', NOW)
    expect(c.ease).toBe(1.3)
  })

  it('"good" on a new card schedules 1 day', () => {
    const c = grade(card(), 'good', NOW)
    expect(c.interval).toBe(1)
    expect(c.due).toBe('2026-07-22')
    expect(c.reps).toBe(1)
  })

  it('"good" on the second review schedules 6 days', () => {
    const c = grade(card({ reps: 1, interval: 1 }), 'good', NOW)
    expect(c.interval).toBe(6)
    expect(c.due).toBe('2026-07-27')
  })

  it('"good" afterwards multiplies by the ease', () => {
    const c = grade(card({ reps: 2, interval: 6, ease: 2.5 }), 'good', NOW)
    expect(c.interval).toBe(15)
  })

  it('"hard" grows slowly and lowers the ease', () => {
    const c = grade(card({ reps: 3, interval: 10, ease: 2.5 }), 'hard', NOW)
    expect(c.interval).toBeCloseTo(12)
    expect(c.ease).toBeCloseTo(2.35)
  })

  it('"easy" grows faster and raises the ease', () => {
    const c = grade(card({ reps: 3, interval: 10, ease: 2.5 }), 'easy', NOW)
    expect(c.interval).toBeCloseTo(32.5)
    expect(c.ease).toBeCloseTo(2.65)
  })

  it('never returns an interval below one day after a success', () => {
    const c = grade(card({ reps: 4, interval: 0.5, ease: 1.3 }), 'good', NOW)
    expect(c.interval).toBeGreaterThanOrEqual(1)
  })

  it('does not mutate the card it was given', () => {
    const original = card({ reps: 2, interval: 6 })
    grade(original, 'again', NOW)
    expect(original.reps).toBe(2)
    expect(original.interval).toBe(6)
  })
})

describe('isDue / dueCards', () => {
  const srs: SrsFile = {
    version: 1,
    cards: {
      a: card({ due: '2026-07-20', q: 'a' }),
      b: card({ due: '2026-07-21', q: 'b' }),
      c: card({ due: '2026-07-22', q: 'c' }),
      d: card({ due: '2026-07-01', q: 'd', suspended: true }),
    },
  }

  it('a card due today counts as due', () => {
    expect(isDue(card({ due: TODAY }), NOW)).toBe(true)
  })

  it('a suspended card is never due', () => {
    expect(isDue(card({ due: '2020-01-01', suspended: true }), NOW)).toBe(false)
  })

  it('lists only what is due, oldest first', () => {
    expect(dueCards(srs, NOW).map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('stats', () => {
  it('counts total, due, suspended and never-reviewed', () => {
    const srs: SrsFile = {
      version: 1,
      cards: {
        a: card({ due: '2026-07-01' }),
        b: card({ due: '2026-08-01', reps: 3 }),
        c: card({ due: '2026-07-01', suspended: true }),
      },
    }
    expect(stats(srs, NOW)).toEqual({ total: 3, due: 1, suspended: 1, fresh: 2 })
  })
})

describe('syncFile', () => {
  const base: SrsFile = { version: 1, cards: { keep: card({ reps: 4, interval: 20, due: '2026-08-10' }) } }

  it('adds a new card as due today', () => {
    const { srs, added } = syncFile(base, 'Sepse.md', [
      { id: 'keep', q: 'Tríade do qSOFA?' },
      { id: 'novo', q: 'Nova pergunta?' },
    ], NOW)
    expect(added).toBe(1)
    expect(srs.cards.novo.due).toBe(TODAY)
  })

  it('keeps the schedule of a card that is still there', () => {
    const { srs } = syncFile(base, 'Sepse.md', [{ id: 'keep', q: 'Tríade do qSOFA?' }], NOW)
    expect(srs.cards.keep.interval).toBe(20)
    expect(srs.cards.keep.due).toBe('2026-08-10')
  })

  it('prunes a card whose question disappeared from the note', () => {
    const { srs, removed } = syncFile(base, 'Sepse.md', [], NOW)
    expect(removed).toBe(1)
    expect(srs.cards.keep).toBeUndefined()
  })

  it('never prunes cards from other notes', () => {
    const other: SrsFile = { version: 1, cards: { x: card({ file: 'Outra.md' }) } }
    const { srs, removed } = syncFile(other, 'Sepse.md', [], NOW)
    expect(removed).toBe(0)
    expect(srs.cards.x).toBeDefined()
  })

  it('does not mutate the schedule it was given', () => {
    syncFile(base, 'Sepse.md', [], NOW)
    expect(base.cards.keep).toBeDefined()
  })
})
