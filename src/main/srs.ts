// Spaced repetition (SM-2, the classic Anki algorithm).
// Kept free of electron/fs imports so the scheduling maths can be tested on
// its own — a bug here silently ruins months of review scheduling.

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface CardState {
  /** Note the card lives in, relative to the vault */
  file: string
  /** The question, kept so the review panel can show it without re-reading */
  q: string
  ease: number
  /** Days until the next review */
  interval: number
  reps: number
  /** ISO date (YYYY-MM-DD) */
  due: string
  lapses: number
  suspended?: boolean
}

export interface SrsFile {
  version: 1
  cards: Record<string, CardState>
}

const MIN_EASE = 1.3
const DAY = 86_400_000

export const todayISO = (now: Date = new Date()): string =>
  new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

export function addDays(iso: string, days: number): string {
  const base = new Date(`${iso}T00:00:00`)
  return todayISO(new Date(base.getTime() + Math.round(days) * DAY))
}

export function newCard(file: string, q: string, now: Date = new Date()): CardState {
  // New cards are due immediately: writing a card means wanting to learn it
  return { file, q, ease: 2.5, interval: 0, reps: 0, due: todayISO(now), lapses: 0 }
}

/**
 * SM-2. Returns a new state — never mutates, so a failed write cannot leave
 * the schedule half-updated.
 */
export function grade(card: CardState, g: Grade, now: Date = new Date()): CardState {
  const today = todayISO(now)

  if (g === 'again') {
    return {
      ...card,
      reps: 0,
      interval: 0,
      ease: Math.max(MIN_EASE, card.ease - 0.2),
      lapses: card.lapses + 1,
      due: today, // seen again in this same session
    }
  }

  let interval: number
  if (card.reps === 0)      interval = g === 'easy' ? 4 : 1
  else if (card.reps === 1) interval = g === 'easy' ? 8 : 6
  else {
    const factor = g === 'hard' ? 1.2 : g === 'easy' ? card.ease * 1.3 : card.ease
    interval = Math.max(1, card.interval * factor)
  }

  const ease = g === 'hard' ? Math.max(MIN_EASE, card.ease - 0.15)
    : g === 'easy' ? card.ease + 0.15
    : card.ease

  return {
    ...card,
    reps: card.reps + 1,
    interval,
    ease,
    due: addDays(today, interval),
  }
}

export function isDue(card: CardState, now: Date = new Date()): boolean {
  return !card.suspended && card.due <= todayISO(now)
}

/** Cards to review, oldest due date first so the backlog drains in order. */
export function dueCards(
  file: SrsFile,
  now: Date = new Date(),
): { id: string; card: CardState }[] {
  return Object.entries(file.cards)
    .filter(([, card]) => isDue(card, now))
    .map(([id, card]) => ({ id, card }))
    .sort((a, b) => a.card.due.localeCompare(b.card.due) || a.card.q.localeCompare(b.card.q))
}

export interface SrsStats {
  total: number
  due: number
  suspended: number
  /** Cards never reviewed */
  fresh: number
}

export function stats(file: SrsFile, now: Date = new Date()): SrsStats {
  const cards = Object.values(file.cards)
  return {
    total: cards.length,
    due: cards.filter((c) => isDue(c, now)).length,
    suspended: cards.filter((c) => c.suspended).length,
    fresh: cards.filter((c) => c.reps === 0).length,
  }
}

/**
 * Reconciles the cards found in a note with what the schedule knows.
 * New cards start due today; cards whose question disappeared are pruned, but
 * only within the file being synced — the rest of the vault is untouched.
 */
export function syncFile(
  srs: SrsFile,
  file: string,
  found: { id: string; q: string }[],
  now: Date = new Date(),
): { srs: SrsFile; added: number; removed: number } {
  const cards = { ...srs.cards }
  const seen = new Set(found.map((c) => c.id))
  let added = 0
  let removed = 0

  for (const { id, q } of found) {
    if (cards[id]) {
      // Editing the answer must not reset the schedule; keep the state as is
      if (cards[id].file !== file || cards[id].q !== q) cards[id] = { ...cards[id], file, q }
    } else {
      cards[id] = newCard(file, q, now)
      added++
    }
  }

  for (const [id, card] of Object.entries(cards)) {
    if (card.file === file && !seen.has(id)) { delete cards[id]; removed++ }
  }

  return { srs: { version: 1, cards }, added, removed }
}
