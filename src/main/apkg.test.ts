import { describe, it, expect } from 'vitest'
import { noteRowToCard, isApkg, deckNameFor, findCollection, parseMediaMap } from './apkg'

// Anki joins a note's fields with the unit separator
const F = (...fields: string[]) => fields.join(String.fromCharCode(0x1f))

describe('noteRowToCard', () => {
  it('reads a basic note', () => {
    expect(noteRowToCard(F('Principal obra de Raul Pompeia:', 'O Ateneu'), ''))
      .toEqual({ q: 'Principal obra de Raul Pompeia:', a: 'O Ateneu', tags: [] })
  })

  it('keeps a cloze note whose second field is empty', () => {
    const card = noteRowToCard(F('Condução de {{c1::seiva bruta}}.', ''), '')
    expect(card?.cloze).toBe(true)
    expect(card?.q).toBe('Condução de ==seiva bruta==.')
  })

  it('translates nested tags', () => {
    expect(noteRowToCard(F('P', 'R'), 'BOTANICA::BOTÂNICA HISTOLOGIA::Classificação')?.tags)
      .toEqual(['BOTANICA/BOTÂNICA', 'HISTOLOGIA/Classificação'])
  })

  it('strips the HTML and the media Anki leaves in the fields', () => {
    expect(noteRowToCard(F('<b>P</b>', 'R <img src="x.jpg"> [sound:a.mp3]'), '')?.a).toBe('R')
  })

  it('converts Anki LaTeX', () => {
    expect(noteRowToCard(F('Fórmula [$]E=mc^2[/$]', 'Einstein'), '')?.q).toBe('Fórmula $E=mc^2$')
  })

  it('joins the extra fields of a multi-field note type into the answer', () => {
    expect(noteRowToCard(F('P', 'R', 'contexto'), '')?.a).toBe('R contexto')
  })

  it('drops a note with no question', () => {
    expect(noteRowToCard(F('', 'R'), '')).toBeNull()
  })

  it('drops a non-cloze note with no answer', () => {
    expect(noteRowToCard(F('P', ''), '')).toBeNull()
  })
})

describe('findCollection', () => {
  const sqlite = Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.alloc(16)])
  const zip = (entries: Record<string, Buffer>) => ({
    getEntry: (name: string) =>
      entries[name] ? ({ getData: () => entries[name] } as never) : null,
  })

  it('prefers the newest layout when several are present', () => {
    const older = Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.from([0xaa])])
    const found = findCollection(zip({ 'collection.anki21': sqlite, 'collection.anki2': older }))
    expect(found?.equals(sqlite)).toBe(true)
  })

  it('reads a plain collection', () => {
    expect(findCollection(zip({ 'collection.anki2': sqlite }))).not.toBeNull()
  })

  it('returns null when nothing inside is a collection', () => {
    expect(findCollection(zip({ media: Buffer.from('{}') }))).toBeNull()
  })

  it('does not mistake random bytes for a collection', () => {
    expect(findCollection(zip({ 'collection.anki21': Buffer.from('não é sqlite') }))).toBeNull()
  })

  it('falls back to an older entry when the newest one is unreadable', () => {
    const broken = { getData: () => { throw new Error('corrupt') } } as never
    const z = {
      getEntry: (name: string) =>
        name === 'collection.anki21b' ? broken : name === 'collection.anki2' ? ({ getData: () => sqlite } as never) : null,
    }
    expect(findCollection(z)).not.toBeNull()
  })
})

describe('isApkg / deckNameFor', () => {
  it('recognises a package by extension', () => {
    expect(isApkg('C:/x/Biologia.apkg')).toBe(true)
    expect(isApkg('C:/x/Biologia.APKG')).toBe(true)
    expect(isApkg('C:/x/Biologia.txt')).toBe(false)
  })

  it('names the deck after the file', () => {
    expect(deckNameFor('C:/x/Biologia Geral.apkg')).toBe('Biologia Geral')
    expect(deckNameFor('C:/x/export.txt')).toBe('export')
  })
})

describe('parseMediaMap', () => {
  it('inverts the entry → real name map Anki ships', () => {
    expect(parseMediaMap('{"0":"foto.jpg","1":"som.mp3"}'))
      .toEqual({ 'foto.jpg': '0', 'som.mp3': '1' })
  })

  it('survives a package without a usable media entry', () => {
    expect(parseMediaMap('')).toEqual({})
    expect(parseMediaMap('[]')).toEqual({})
    expect(parseMediaMap('{"0":123,"1":"  "}')).toEqual({})
  })
})
