// Finding flashcards inside a note.
// A card is a callout plus a highlight — syntax the app already renders — so a
// note stays readable in any Markdown editor and the cards degrade into plain
// prose when the review engine is not there.

export type CardKind = 'qa' | 'cloze' | 'mnemonic'

export interface ExtractedCard {
  /** Stable while the question does not change */
  id: string
  kind: CardKind
  /** Shown in the review panel: the question, or the sentence with its gaps */
  q: string
  /** The answer, or the term hidden behind the gap */
  a: string
  /** 0-based index of the gap inside a cloze sentence */
  clozeIndex?: number
}

const CARD_TYPES = new Set(['card', 'flashcard', 'pergunta'])
const MNEMONIC_TYPES = new Set(['mnemonic', 'mnemonico', 'mnemônico'])

/** Placeholder that replaces the answer inside a cloze sentence. */
export const CLOZE_GAP = '[ … ]'

/**
 * Fowler/Noll/Vo 1a — a short, dependency-free hash. The id only needs to be
 * stable and collision-resistant enough for one vault's worth of cards.
 */
export function cardId(relativePath: string, question: string, suffix = ''): string {
  const input = `${relativePath}::${question}${suffix ? '::' + suffix : ''}`
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  // A second pass over the reversed input keeps ids apart for near-identical questions
  let h2 = 0x811c9dc5
  for (let i = input.length - 1; i >= 0; i--) {
    h2 ^= input.charCodeAt(i)
    h2 = Math.imul(h2, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

/** `==term==` occurrences, in order. */
export function clozeParts(text: string): string[] {
  return [...text.matchAll(/==([^=\n]+)==/g)].map((m) => m[1].trim())
}

/** Replaces the nth `==term==` with a gap and unwraps the others. */
export function renderCloze(text: string, hideIndex: number): string {
  let i = 0
  return text.replace(/==([^=\n]+)==/g, (_, term: string) => {
    const out = i === hideIndex ? CLOZE_GAP : term
    i++
    return out
  })
}

interface Callout {
  type: string
  fold: string
  title: string
  body: string
}

/** Callout blocks in raw markdown, with their `> ` prefixes removed. */
function parseCallouts(md: string): Callout[] {
  const out: Callout[] = []
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const head = /^>\s*\[!([\wÀ-ɏ]+)\]([-+?]?)\s*(.*)$/.exec(lines[i])
    if (!head) continue
    const body: string[] = []
    let j = i + 1
    while (j < lines.length && /^>/.test(lines[j])) {
      body.push(lines[j].replace(/^>\s?/, ''))
      j++
    }
    out.push({ type: head[1].toLowerCase(), fold: head[2], title: head[3].trim(), body: body.join('\n').trim() })
    i = j - 1
  }
  return out
}

/**
 * Cards declared in a note:
 * - `> [!card]- Question` with the answer in the body
 * - `> [!card]` whose body has `==highlights==` → one cloze card per highlight
 * - `> [!mnemonic]?` — a mnemonic marked as reviewable
 */
export function extractCards(relativePath: string, content: string): ExtractedCard[] {
  const cards: ExtractedCard[] = []
  // A card written inside a code fence is documentation about cards, not a card
  for (const callout of parseCallouts(stripFences(content))) {
    const isCard = CARD_TYPES.has(callout.type)
    const isMnemonic = MNEMONIC_TYPES.has(callout.type)
    if (!isCard && !isMnemonic) continue
    if (isMnemonic && callout.fold !== '?') continue // only `?` marks it reviewable

    const gaps = clozeParts(callout.body)
    if (isCard && gaps.length > 0) {
      gaps.forEach((term, index) => {
        const q = renderCloze(callout.body, index)
        cards.push({
          id: cardId(relativePath, callout.body, `c${index}`),
          kind: 'cloze',
          q: callout.title ? `${callout.title} — ${q}` : q,
          a: term,
          clozeIndex: index,
        })
      })
      continue
    }

    const question = callout.title || callout.body.split('\n')[0]
    if (!question) continue
    cards.push({
      id: cardId(relativePath, question),
      kind: isMnemonic ? 'mnemonic' : 'qa',
      q: question,
      a: callout.body,
    })
  }
  return cards
}

/** Blanks out fenced code so a card written as an example is not collected. */
function stripFences(md: string): string {
  return md.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, (block) => block.replace(/[^\n]/g, ' '))
}
