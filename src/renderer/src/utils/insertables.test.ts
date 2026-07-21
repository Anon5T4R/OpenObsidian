import { describe, it, expect } from 'vitest'
import {
  INSERTABLES, CATEGORY_ORDER, CATEGORY_LABEL,
  resolve, searchInsertables, primarySlash,
} from './insertables'

describe('the catalogue itself', () => {
  it('gives every slash command to exactly one item', () => {
    // Two items answering `/card` would make the menu a coin toss
    const seen = new Map<string, string>()
    for (const item of INSERTABLES) {
      for (const s of item.slash) {
        expect(seen.has(s), `"/${s}" is on both ${seen.get(s)} and ${item.id}`).toBe(false)
        seen.set(s, item.id)
      }
    }
  })

  it('has unique ids', () => {
    expect(new Set(INSERTABLES.map((i) => i.id)).size).toBe(INSERTABLES.length)
  })

  it('gives every item at least one command and an icon', () => {
    for (const item of INSERTABLES) {
      expect(item.slash.length, item.id).toBeGreaterThan(0)
      expect(item.icon.length, item.id).toBeGreaterThan(0)
    }
  })

  it('writes commands without the slash, since the code adds it', () => {
    for (const item of INSERTABLES) {
      for (const s of item.slash) expect(s.startsWith('/'), item.id).toBe(false)
    }
  })

  it('puts every item in a category the menu renders', () => {
    for (const item of INSERTABLES) {
      expect(CATEGORY_ORDER, item.id).toContain(item.category)
    }
  })

  it('gives every category a heading', () => {
    for (const c of CATEGORY_ORDER) expect(CATEGORY_LABEL[c]).toBeTruthy()
  })

  it('fills every category with something', () => {
    for (const c of CATEGORY_ORDER) {
      expect(INSERTABLES.some((i) => i.category === c), c).toBe(true)
    }
  })

  it('never puts the caret outside the snippet', () => {
    // A cursor past the start would land in the previous line, silently
    for (const item of INSERTABLES) {
      const { text, cursor } = resolve(item)
      expect(text.length + cursor, `${item.id} lands at ${text.length + cursor}`).toBeGreaterThanOrEqual(0)
      expect(cursor, item.id).toBeLessThanOrEqual(0)
    }
  })

  it('never drops the caret in the middle of a word', () => {
    // The bounds check above passed while three snippets were unusable: `/card`
    // opened at `Questi|on` and `/queryfield` inside `s|ort`, so the first thing
    // you typed shredded the snippet. A caret between two word characters is
    // always a miscount — every real slot sits next to punctuation or a newline.
    const isWord = (c: string) => /\w/.test(c)
    const broken: string[] = []
    for (const item of INSERTABLES) {
      const { text, cursor } = resolve(item)
      const at = text.length + cursor
      if (at > 0 && at < text.length && isWord(text[at - 1]) && isWord(text[at])) {
        broken.push(`${item.id} → ${JSON.stringify(text.slice(at - 8, at))}|${JSON.stringify(text.slice(at, at + 8))}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('opens the fillable slot of each block, not somewhere near it', () => {
    // Asserted by content, not by offset: an offset assertion just restates the
    // constant and would have agreed with every one of the three bugs above.
    const caret = (id: string) => {
      const { text, cursor } = resolve(INSERTABLES.find((i) => i.id === id)!)
      return { before: text.slice(0, text.length + cursor), after: text.slice(text.length + cursor) }
    }

    // `tag: ` — ready for the tag name, with the space already there
    expect(caret('queryTag').before.endsWith('tag: ')).toBe(true)
    expect(caret('queryTag').after.startsWith('\n')).toBe(true)

    expect(caret('queryField').before.endsWith('tipo: ')).toBe(true)
    expect(caret('queryField').after.startsWith('\n')).toBe(true)

    // End of the placeholder, so the question is edited in place
    expect(caret('cardQa').before.endsWith('Question')).toBe(true)
    expect(caret('cardQa').after.startsWith('\n')).toBe(true)
  })

  it('inserts something for every item', () => {
    for (const item of INSERTABLES) {
      expect(resolve(item).text.length, item.id).toBeGreaterThan(0)
    }
  })
})

describe('the features that were missing before', () => {
  const has = (id: string) => INSERTABLES.some((i) => i.id === id)

  it('offers flashcards, which nothing in the UI used to mention', () => {
    expect(has('cardQa')).toBe(true)
    expect(has('cardCloze')).toBe(true)
    expect(has('mnemonic')).toBe(true)
  })

  it('offers Mermaid, maths, queries, embeds and callouts', () => {
    expect(has('mermaidFlow')).toBe(true)
    expect(has('mathBlock')).toBe(true)
    expect(has('queryTag')).toBe(true)
    expect(has('embedNote')).toBe(true)
    expect(has('calloutWarning')).toBe(true)
  })

  it('writes a card the extractor can actually read', () => {
    const card = INSERTABLES.find((i) => i.id === 'cardQa')!
    // Same shape utils/cards.ts looks for: a callout of type `card`
    expect(card.snippet).toMatch(/^> \[!card\]-/)
  })

  it('writes a cloze card with a highlight in it', () => {
    const cloze = INSERTABLES.find((i) => i.id === 'cardCloze')!
    expect(cloze.snippet).toMatch(/==[^=]+==/)
  })

  it('writes a mermaid block the preview will pick up', () => {
    const flow = INSERTABLES.find((i) => i.id === 'mermaidFlow')!
    expect(flow.snippet.startsWith('```mermaid\n')).toBe(true)
    expect(flow.snippet.trimEnd().endsWith('```')).toBe(true)
  })

  it('writes a query block the runner will pick up', () => {
    const q = INSERTABLES.find((i) => i.id === 'queryTag')!
    expect(q.snippet.startsWith('```query\n')).toBe(true)
  })
})

describe('resolve', () => {
  it('uses today, not the day the app was launched', () => {
    const today = INSERTABLES.find((i) => i.id === 'today')!
    expect(resolve(today, new Date(2026, 6, 21)).text).toBe('2026-07-21')
    expect(resolve(today, new Date(2027, 0, 5)).text).toBe('2027-01-05')
  })

  it('pads the time to two digits', () => {
    const now = INSERTABLES.find((i) => i.id === 'now')!
    expect(resolve(now, new Date(2026, 6, 21, 9, 5)).text).toBe('09:05')
  })

  it('puts the caret inside the bold markers', () => {
    const bold = INSERTABLES.find((i) => i.id === 'bold')!
    const { text, cursor } = resolve(bold)
    expect(text.length + cursor).toBe(text.indexOf('text') + 4)
  })

  it('puts the caret inside the empty wikilink', () => {
    const w = INSERTABLES.find((i) => i.id === 'wikilink')!
    const { text, cursor } = resolve(w)
    expect(text.slice(0, text.length + cursor)).toBe('[[')
  })
})

describe('searchInsertables', () => {
  it('returns everything for an empty query', () => {
    expect(searchInsertables('')).toHaveLength(INSERTABLES.length)
  })

  it('finds by the start of the command', () => {
    expect(searchInsertables('card').map((i) => i.id)).toContain('cardQa')
  })

  it('finds through an alias', () => {
    // `/flashcard` and `/card` are the same thing
    expect(searchInsertables('flash')[0].id).toBe('cardQa')
  })

  it('ranks an exact command above a mere id match', () => {
    const results = searchInsertables('tag')
    expect(results[0].id).toBe('tag')
  })

  it('returns nothing for gibberish', () => {
    expect(searchInsertables('zzzznothing')).toHaveLength(0)
  })

  it('ignores case and spaces', () => {
    expect(searchInsertables('  TABLE ').map((i) => i.id)).toContain('table')
  })
})

describe('primarySlash', () => {
  it('shows the first command, with the slash', () => {
    const card = INSERTABLES.find((i) => i.id === 'cardQa')!
    expect(primarySlash(card)).toBe('/card')
  })
})
