import { describe, it, expect } from 'vitest'
import {
  newCard, grade, isDue, dueCards, stats, syncFile, todayISO, addDays,
  report, toAnkiText, fromAnkiText, ankiToMarkdown, ankiFieldToMarkdown, chunkCards,
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

describe('report', () => {
  const srs: SrsFile = {
    version: 1,
    cards: {
      a: card({ reps: 5, lapses: 0, ease: 2.5, due: '2026-07-19', file: 'A.md' }),
      b: card({ reps: 3, lapses: 2, ease: 2.1, due: '2026-07-22', file: 'A.md' }),
      c: card({ reps: 0, lapses: 0, ease: 2.5, due: '2026-07-21', file: 'B.md' }),
    },
  }

  it('counts learned cards and retention over the reviewed ones', () => {
    const r = report(srs, NOW)
    expect(r.learned).toBe(1)
    expect(r.retention).toBeCloseTo(0.5) // 1 clean out of 2 reviewed
  })

  it('reports retention as 0 when nothing was reviewed yet', () => {
    expect(report({ version: 1, cards: { x: card() } }, NOW).retention).toBe(0)
  })

  it('averages the ease', () => {
    expect(report(srs, NOW).averageEase).toBeCloseTo((2.5 + 2.1 + 2.5) / 3)
  })

  it('forecasts 14 days, with the backlog landing on day 0', () => {
    const r = report(srs, NOW)
    expect(r.forecast).toHaveLength(14)
    expect(r.forecast[0]).toEqual({ date: '2026-07-21', count: 2 }) // overdue + today
    expect(r.forecast[1]).toEqual({ date: '2026-07-22', count: 1 })
  })

  it('ranks the notes holding the most cards', () => {
    expect(report(srs, NOW).topFiles[0]).toEqual({ file: 'A.md', count: 2 })
  })
})

describe('Anki text exchange', () => {
  it('keeps the tags column out of the answer', () => {
    const { cards } = fromAnkiText(['#separator:tab', '#tags column:3', 'P\tR\tcardio uti'].join('\n'))
    expect(cards[0]).toEqual({ q: 'P', a: 'R', tags: ['cardio', 'uti'] })
  })

  it('treats a trailing third column as tags even without the directive', () => {
    const { cards } = fromAnkiText('P\tR\tcardio')
    expect(cards[0].a).toBe('R')
    expect(cards[0].tags).toEqual(['cardio'])
  })

  it('maps an Anki cloze onto the app cloze syntax', () => {
    const { cards } = fromAnkiText('A enzima {{c1::citrato sintase}} age\tcontexto')
    expect(cards[0].q).toBe('A enzima ==citrato sintase== age')
  })

  it('drops the hint of a cloze with one', () => {
    expect(ankiFieldToMarkdown('{{c1::termo::dica}}')).toBe('==termo==')
  })

  it('converts Anki LaTeX to the syntax KaTeX already renders', () => {
    expect(ankiFieldToMarkdown('Fórmula [$]x^2[/$]')).toBe('Fórmula $x^2$')
    expect(ankiFieldToMarkdown('[$$]y[/$$]')).toBe('$$y$$')
  })

  it('removes media references instead of leaving them raw', () => {
    expect(ankiFieldToMarkdown('Veja <img src="p.jpg"> aqui [sound:a.mp3]')).toBe('Veja aqui')
  })

  it('counts the cards whose media could not come along', () => {
    const { withMedia } = fromAnkiText('P1\t<img src="a.jpg">\nP2\tR2')
    expect(withMedia).toBe(1)
  })

  it('honours a semicolon separator declared in the header', () => {
    const { cards } = fromAnkiText('#separator:semicolon\nP;R')
    expect(cards[0]).toMatchObject({ q: 'P', a: 'R' })
  })

  it('puts the deck tags at the top of the note', () => {
    const md = ankiToMarkdown('Baralho', [{ q: 'P', a: 'R', tags: ['cardio', 'uti'] }])
    expect(md).toContain('#cardio #uti')
  })

  it('exports one tab-separated line per card', () => {
    expect(toAnkiText([{ q: 'P1', a: 'R1' }, { q: 'P2', a: 'R2' }])).toBe('P1\tR1\nP2\tR2')
  })

  it('turns newlines into <br> so a card stays on one line', () => {
    expect(toAnkiText([{ q: 'P', a: 'a\nb' }])).toBe('P\ta<br>b')
  })

  it('never lets a tab inside the text break the columns', () => {
    expect(toAnkiText([{ q: 'a\tb', a: 'c' }])).toBe('a b\tc')
  })

  it('imports tab-separated lines', () => {
    expect(fromAnkiText('P1\tR1\nP2\tR2').cards)
      .toMatchObject([{ q: 'P1', a: 'R1' }, { q: 'P2', a: 'R2' }])
  })

  it('accepts semicolons when there is no tab', () => {
    expect(fromAnkiText('P;R').cards).toMatchObject([{ q: 'P', a: 'R' }])
  })

  it('skips blank lines and # directives', () => {
    expect(fromAnkiText('#separator:tab\n\nP\tR').cards).toMatchObject([{ q: 'P', a: 'R' }])
  })

  it('strips the HTML Anki puts in its fields', () => {
    expect(fromAnkiText('<b>P</b>\tlinha1<br>linha2').cards)
      .toMatchObject([{ q: 'P', a: 'linha1 · linha2' }])
  })

  it('reads a trailing extra column as tags, not as part of the answer', () => {
    expect(fromAnkiText('P\tR\textra').cards)
      .toMatchObject([{ q: 'P', a: 'R', tags: ['extra'] }])
  })

  it('ignores a line with no answer', () => {
    expect(fromAnkiText('só pergunta').cards).toEqual([])
  })

  it('keeps a cloze note whose Extra field is empty', () => {
    // The shape a real AnkiWeb deck exports: Texto / Extra / tags
    const line = 'Mecanismos para condução de {{c1::seiva bruta}}.\t\tBOTANICA::BOTÂNICA'
    const { cards } = fromAnkiText('#separator:tab\n#tags column:3\n' + line)
    expect(cards).toHaveLength(1)
    expect(cards[0].cloze).toBe(true)
    expect(cards[0].q).toContain('==seiva bruta==')
  })

  it('translates Anki nested tags into this app nesting', () => {
    const { cards } = fromAnkiText('P\tR\tHISTOLOGIA::Classificação')
    expect(cards[0].tags).toEqual(['HISTOLOGIA/Classificação'])
  })

  it('writes a cloze note in the form extractCards reads as gaps', () => {
    const md = ankiToMarkdown('Deck', [{ q: 'A ==seiva bruta== sobe', a: '', tags: [], cloze: true }])
    expect(md).toContain('> [!card]\n> A ==seiva bruta== sobe')
    expect(md).not.toContain('[!card]-')
  })

  it('uses the Extra field as the title of a cloze card', () => {
    const md = ankiToMarkdown('Deck', [{ q: 'A ==x== sobe', a: 'Botânica', tags: [], cloze: true }])
    expect(md).toContain('> [!card] Botânica\n> A ==x== sobe')
  })

  it('splits a big deck so no single note becomes unusable', () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ q: `P${i}`, a: `R${i}`, tags: [] }))
    const chunks = chunkCards(many, 100)
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50])
  })

  it('keeps a small deck in one piece', () => {
    const few = [{ q: 'P', a: 'R', tags: [] }]
    expect(chunkCards(few, 100)).toEqual([few])
  })

  it('does not lose a card while splitting', () => {
    const many = Array.from({ length: 205 }, (_, i) => ({ q: `P${i}`, a: 'R', tags: [] }))
    expect(chunkCards(many, 100).flat()).toHaveLength(205)
  })

  it('round-trips through markdown as card callouts', () => {
    const md = ankiToMarkdown('Baralho', [{ q: 'P', a: 'R', tags: [] }])
    expect(md).toContain('# Baralho')
    expect(md).toContain('> [!card]- P\n> R')
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
