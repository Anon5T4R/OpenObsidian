import { describe, it, expect } from 'vitest'
import { noteRowToCard, isApkg, deckNameFor } from './apkg'

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
