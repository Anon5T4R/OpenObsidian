import { describe, it, expect } from 'vitest'
import { extractCards, cardId, clozeParts, renderCloze, CLOZE_GAP } from './cards'

describe('cardId', () => {
  it('is stable for the same note and question', () => {
    expect(cardId('a.md', 'Pergunta?')).toBe(cardId('a.md', 'Pergunta?'))
  })

  it('changes when the question changes', () => {
    expect(cardId('a.md', 'Pergunta?')).not.toBe(cardId('a.md', 'Outra?'))
  })

  it('changes when the note changes', () => {
    expect(cardId('a.md', 'P?')).not.toBe(cardId('b.md', 'P?'))
  })

  it('separates the gaps of one cloze sentence', () => {
    expect(cardId('a.md', 'frase', 'c0')).not.toBe(cardId('a.md', 'frase', 'c1'))
  })

  it('keeps near-identical questions apart', () => {
    expect(cardId('a.md', 'abc')).not.toBe(cardId('a.md', 'acb'))
  })
})

describe('clozeParts / renderCloze', () => {
  const s = 'A ==citrato sintase== condensa ==acetil-CoA=='

  it('lists the highlighted terms in order', () => {
    expect(clozeParts(s)).toEqual(['citrato sintase', 'acetil-CoA'])
  })

  it('hides only the requested gap and unwraps the rest', () => {
    expect(renderCloze(s, 0)).toBe(`A ${CLOZE_GAP} condensa acetil-CoA`)
    expect(renderCloze(s, 1)).toBe(`A citrato sintase condensa ${CLOZE_GAP}`)
  })
})

describe('extractCards', () => {
  it('reads a question/answer card', () => {
    const md = '> [!card]- Qual a tríade do qSOFA?\n> FR ≥ 22 · PAS ≤ 100 · Glasgow < 15.'
    const [card] = extractCards('Sepse.md', md)
    expect(card.kind).toBe('qa')
    expect(card.q).toBe('Qual a tríade do qSOFA?')
    expect(card.a).toContain('FR ≥ 22')
  })

  it('accepts the aliases of the card type', () => {
    expect(extractCards('a.md', '> [!flashcard]- P\n> R')).toHaveLength(1)
    expect(extractCards('a.md', '> [!pergunta]- P\n> R')).toHaveLength(1)
  })

  it('makes one cloze card per highlight', () => {
    const md = '> [!card] Ciclo de Krebs\n> A ==citrato sintase== condensa ==acetil-CoA=='
    const cards = extractCards('Krebs.md', md)
    expect(cards).toHaveLength(2)
    expect(cards[0].kind).toBe('cloze')
    expect(cards[0].q).toContain(CLOZE_GAP)
    expect(cards[0].a).toBe('citrato sintase')
    expect(cards[1].a).toBe('acetil-CoA')
  })

  it('gives each gap its own id', () => {
    const cards = extractCards('a.md', '> [!card] T\n> ==um== e ==dois==')
    expect(cards[0].id).not.toBe(cards[1].id)
  })

  it('only takes a mnemonic marked with ?', () => {
    expect(extractCards('a.md', '> [!mnemonic] 5H e 5T\n> Hipovolemia…')).toHaveLength(0)
    expect(extractCards('a.md', '> [!mnemonic]? 5H e 5T\n> Hipovolemia…')).toHaveLength(1)
  })

  it('ignores other callout types', () => {
    expect(extractCards('a.md', '> [!warning] Cuidado\n> texto')).toHaveLength(0)
  })

  it('ignores a card written inside a code fence', () => {
    const md = '```\n> [!card]- Exemplo\n> resposta\n```'
    expect(extractCards('a.md', md)).toHaveLength(0)
  })

  it('reads several cards from one note', () => {
    const md = '> [!card]- A\n> ra\n\ntexto\n\n> [!card]- B\n> rb'
    expect(extractCards('a.md', md).map((c) => c.q)).toEqual(['A', 'B'])
  })

  it('falls back to the first body line when there is no title', () => {
    const [card] = extractCards('a.md', '> [!card]\n> Só o corpo')
    expect(card.q).toBe('Só o corpo')
  })

  it('returns nothing for a note with no cards', () => {
    expect(extractCards('a.md', '# Título\n\ntexto comum')).toEqual([])
  })

  it('keeps the id stable when only the answer is edited', () => {
    const a = extractCards('a.md', '> [!card]- P?\n> resposta velha')[0]
    const b = extractCards('a.md', '> [!card]- P?\n> resposta nova')[0]
    expect(a.id).toBe(b.id)
  })
})
