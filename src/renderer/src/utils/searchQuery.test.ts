import { describe, it, expect } from 'vitest'
import { parseQuery, isEmptyQuery, matchNote, compileRegex, SearchableNote } from './searchQuery'

const note = (over: Partial<SearchableNote> = {}): SearchableNote => ({
  name: 'Sepse',
  relativePath: 'Patologias/Sepse.md',
  content: '# Sepse\n\nLactato alto na admissão.\nRepetir lactato em 2h.\nAntibiótico em 1h.',
  tags: ['uti', 'sistema/cardio', 'sistema'],
  ...over,
})

describe('parseQuery', () => {
  it('reads plain terms', () => {
    expect(parseQuery('lactato sepse').terms).toEqual(['lactato', 'sepse'])
  })

  it('keeps a quoted phrase whole', () => {
    expect(parseQuery('"choque séptico" uti')).toMatchObject({
      phrases: ['choque séptico'],
      terms: ['uti'],
    })
  })

  it('reads exclusions', () => {
    expect(parseQuery('sepse -pediatria').excluded).toEqual(['pediatria'])
  })

  it('excludes a quoted phrase', () => {
    expect(parseQuery('-"choque séptico"').excluded).toEqual(['choque séptico'])
  })

  it('reads the field operators', () => {
    expect(parseQuery('tag:uti path:emergencia file:sepse')).toMatchObject({
      tags: ['uti'], paths: ['emergencia'], files: ['sepse'],
    })
  })

  it('accepts tag: with a leading #', () => {
    expect(parseQuery('tag:#uti').tags).toEqual(['uti'])
  })

  it('is case-insensitive in operators and values', () => {
    expect(parseQuery('TAG:UTI').tags).toEqual(['uti'])
  })

  it('ignores an operator with no value', () => {
    expect(isEmptyQuery(parseQuery('tag:'))).toBe(true)
  })

  it('survives an unclosed quote', () => {
    expect(parseQuery('"sem fim').phrases).toEqual(['sem fim'])
  })

  it('treats an empty query as empty', () => {
    expect(isEmptyQuery(parseQuery('   '))).toBe(true)
  })
})

describe('matchNote', () => {
  it('returns every occurrence, with no cap', () => {
    const m = matchNote(note(), parseQuery('lactato'))
    expect(m).toHaveLength(2)
    expect(m?.[0]).toEqual({ line: 3, text: 'Lactato alto na admissão.' })
  })

  it('requires all terms to be present in the note', () => {
    expect(matchNote(note(), parseQuery('lactato inexistente'))).toBeNull()
  })

  it('matches terms that live on different lines', () => {
    expect(matchNote(note(), parseQuery('lactato antibiótico'))).not.toBeNull()
  })

  it('filters by tag', () => {
    expect(matchNote(note(), parseQuery('tag:uti'))).toEqual([])
    expect(matchNote(note(), parseQuery('tag:pediatria'))).toBeNull()
  })

  it('a parent tag matches its children', () => {
    expect(matchNote(note({ tags: ['sistema/cardio'] }), parseQuery('tag:sistema'))).toEqual([])
  })

  it('filters by path', () => {
    expect(matchNote(note(), parseQuery('path:patologias'))).toEqual([])
    expect(matchNote(note(), parseQuery('path:emergencia'))).toBeNull()
  })

  it('filters by file name', () => {
    expect(matchNote(note(), parseQuery('file:seps'))).toEqual([])
    expect(matchNote(note(), parseQuery('file:outro'))).toBeNull()
  })

  it('combines a filter with a term', () => {
    expect(matchNote(note(), parseQuery('tag:uti lactato'))).toHaveLength(2)
    expect(matchNote(note(), parseQuery('tag:pediatria lactato'))).toBeNull()
  })

  it('drops a note that contains an excluded term', () => {
    expect(matchNote(note(), parseQuery('lactato -antibiótico'))).toBeNull()
  })

  it('requires the exact phrase', () => {
    expect(matchNote(note(), parseQuery('"repetir lactato"'))).toHaveLength(1)
    expect(matchNote(note(), parseQuery('"lactato repetir"'))).toBeNull()
  })

  it('matches by regex when one is given', () => {
    const m = matchNote(note(), parseQuery('lactat.'), compileRegex('lactat.'))
    expect(m).toHaveLength(2)
  })

  it('returns null when the regex finds nothing', () => {
    expect(matchNote(note(), parseQuery('xyz+'), compileRegex('xyz+'))).toBeNull()
  })

  it('does not get stuck on a global regex between lines', () => {
    const m = matchNote(note(), parseQuery('lactato'), new RegExp('lactato', 'gi'))
    expect(m).toHaveLength(2)
  })
})

describe('compileRegex', () => {
  it('compiles a valid pattern', () => {
    expect(compileRegex('^a.*b$')).toBeInstanceOf(RegExp)
  })

  it('returns null for an invalid pattern instead of throwing', () => {
    expect(compileRegex('[unclosed')).toBeNull()
  })
})
