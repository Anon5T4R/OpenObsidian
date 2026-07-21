import { describe, it, expect } from 'vitest'
import { rankTags, startsTag, matchTagQuery } from './tagComplete'

const index = {
  'sis-cardio': ['A', 'B', 'C', 'D'],
  'sis-pneumo': ['E', 'F'],
  'sx-dispneia': ['A', 'E', 'G'],
  'tipo-ficha': ['H'],
  cardiopatia: ['I', 'J', 'K', 'L', 'M'],
  'sistema/cardio': ['N'],
}

describe('rankTags', () => {
  it('puts a prefix match above a mere substring match', () => {
    // `cardiopatia` has more notes, but `sis-cardio` is what "sis" starts
    const result = rankTags(index, 'sis').map((t) => t.tag)
    expect(result[0]).toBe('sis-cardio')
    expect(result[1]).toBe('sis-pneumo')
  })

  it('ranks the most used first within a group', () => {
    const result = rankTags(index, 's').map((t) => t.tag)
    // sx-dispneia (3) before sis-pneumo (2), both after sis-cardio (4)
    expect(result.slice(0, 3)).toEqual(['sis-cardio', 'sx-dispneia', 'sis-pneumo'])
  })

  it('still finds a tag by its middle', () => {
    expect(rankTags(index, 'cardio').map((t) => t.tag)).toContain('sistema/cardio')
  })

  it('offers everything, most used first, when nothing is typed yet', () => {
    const result = rankTags(index, '')
    expect(result).toHaveLength(Object.keys(index).length)
    expect(result[0].tag).toBe('cardiopatia')
  })

  it('carries the note count, which is what makes the order legible', () => {
    expect(rankTags(index, 'sis-cardio')[0].count).toBe(4)
  })

  it('ignores case', () => {
    expect(rankTags(index, 'SIS-Cardio').map((t) => t.tag)).toContain('sis-cardio')
  })

  it('offers nested tags, which the index already stores whole', () => {
    expect(rankTags(index, 'sistema/').map((t) => t.tag)).toEqual(['sistema/cardio'])
  })

  it('returns nothing rather than everything for a miss', () => {
    expect(rankTags(index, 'zzzz')).toEqual([])
  })

  it('honours the limit, so a huge vault cannot flood the menu', () => {
    expect(rankTags(index, '', 2)).toHaveLength(2)
  })

  it('breaks ties alphabetically, so the order never shuffles between renders', () => {
    const tied = { beta: ['A'], alpha: ['B'] }
    expect(rankTags(tied, '').map((t) => t.tag)).toEqual(['alpha', 'beta'])
  })
})

describe('matchTagQuery — when the menu is allowed to open', () => {
  const q = (line: string) => matchTagQuery(line)?.query ?? null

  it('opens on a tag being typed', () => {
    expect(q('#sis')).toBe('sis')
    expect(q('texto solto #sis-car')).toBe('sis-car')
  })

  it('stays shut while a heading is being written', () => {
    // The one that would have made this feature hated: every `# Título` in the
    // vault popping a tag menu. A heading is `#` + space, so it cannot match.
    expect(q('# ')).toBe(null)
    expect(q('# Sepse e Choque')).toBe(null)
    expect(q('## ')).toBe(null)
    expect(q('### Diagnóstico')).toBe(null)
  })

  it('stays shut on a bare # with nothing typed yet', () => {
    // Which is also the instant before a heading becomes a heading
    expect(q('#')).toBe(null)
    expect(q('##')).toBe(null)
  })

  it('opens inside a query block, which is the point of all this', () => {
    expect(q('tag: #sis-car')).toBe('sis-car')
  })

  it('opens inside a callout', () => {
    expect(q('> #sis')).toBe('sis')
  })

  it('stays shut mid-word, so a URL fragment is not a tag', () => {
    expect(q('http://x.com/p#secao')).toBe(null)
    expect(q('nota#ancora')).toBe(null)
  })

  it('accepts accents and nesting, like the indexer does', () => {
    expect(q('#pré-natal')).toBe('pré-natal')
    expect(q('#sistema/cardio')).toBe('sistema/cardio')
  })

  it('reports where the # is, so the replacement covers it', () => {
    expect(matchTagQuery('abc #sis')).toEqual({ from: 4, query: 'sis' })
  })

  it('only looks at the tag touching the cursor', () => {
    expect(q('#tipo-patologia #sis-car')).toBe('sis-car')
  })
})

describe('startsTag', () => {
  it('accepts the start of a line', () => {
    expect(startsTag('')).toBe(true)
  })

  it('accepts after a space — this is the `tag: #x` case inside a query block', () => {
    expect(startsTag(' ')).toBe(true)
  })

  it('accepts inside a callout, after the `>`', () => {
    expect(startsTag('>')).toBe(true)
  })

  it('rejects mid-word, so a URL fragment does not offer tags', () => {
    expect(startsTag('o')).toBe(false)
    expect(startsTag('/')).toBe(false)
  })
})
