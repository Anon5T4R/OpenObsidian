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

export interface SrsReport extends SrsStats {
  /** Reviewed at least once and never failed since */
  learned: number
  /** Share of reviewed cards that never lapsed, 0–1 */
  retention: number
  averageEase: number
  /** How many come due on each of the next 14 days */
  forecast: { date: string; count: number }[]
  /** Notes holding the most cards */
  topFiles: { file: string; count: number }[]
}

export function report(file: SrsFile, now: Date = new Date()): SrsReport {
  const cards = Object.values(file.cards)
  const reviewed = cards.filter((c) => c.reps > 0)
  const clean = reviewed.filter((c) => c.lapses === 0)

  const forecast: { date: string; count: number }[] = []
  for (let i = 0; i < 14; i++) {
    const date = addDays(todayISO(now), i)
    forecast.push({
      date,
      // Day 0 carries the backlog: everything overdue is waiting today
      count: cards.filter((c) => !c.suspended && (i === 0 ? c.due <= date : c.due === date)).length,
    })
  }

  const byFile = new Map<string, number>()
  for (const c of cards) byFile.set(c.file, (byFile.get(c.file) ?? 0) + 1)

  return {
    ...stats(file, now),
    learned: clean.length,
    retention: reviewed.length === 0 ? 0 : clean.length / reviewed.length,
    averageEase: cards.length === 0 ? 0 : cards.reduce((sum, c) => sum + c.ease, 0) / cards.length,
    forecast,
    topFiles: [...byFile.entries()]
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
      .slice(0, 8),
  }
}

// ── Anki plain-text exchange ───────────────────────────────────────────────
// The .apkg format is a zipped SQLite database; Anki's own import/export
// speaks tab-separated text, which covers the same need without a DB driver.

export function toAnkiText(cards: { q: string; a: string }[]): string {
  const clean = (s: string) => s.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>')
  return cards.map((c) => `${clean(c.q)}\t${clean(c.a)}`).join('\n')
}

export interface AnkiCard {
  q: string
  a: string
  tags: string[]
  /** A cloze note: the gaps are the answer, so an empty second field is normal */
  cloze?: boolean
}

export interface AnkiImport {
  cards: AnkiCard[]
  /** Cards that referenced an image or audio the text export cannot carry */
  withMedia: number
}

/**
 * Anki's newer exports declare their layout on `#` lines, e.g.
 * `#separator:tab`, `#tags column:3`. Reading that is what keeps the tags
 * from being glued onto the answer.
 */
function readDirectives(text: string): { tagsColumn: number | null; separator: string | null } {
  let tagsColumn: number | null = null
  let separator: string | null = null
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('#')) break
    const tags = /^#tags column:\s*(\d+)/i.exec(line)
    if (tags) tagsColumn = Number(tags[1]) - 1 // Anki counts from 1
    const sep = /^#separator:\s*(\w+)/i.exec(line)
    if (sep) separator = sep[1].toLowerCase()
  }
  return { tagsColumn, separator }
}

const MEDIA_RE = /<img\b[^>]*>|\[sound:[^\]]*\]/i

/** Parses an Anki text export into cards, tags included. */
export function fromAnkiText(text: string): AnkiImport {
  const { tagsColumn, separator } = readDirectives(text)
  const splitOn = separator === 'semicolon' ? ';' : separator === 'comma' ? ',' : null
  const cards: AnkiCard[] = []
  let withMedia = 0

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue // directives and comments
    const parts = splitOn
      ? line.split(splitOn)
      : line.includes('\t') ? line.split('\t') : line.split(';')
    if (parts.length < 2) continue

    if (MEDIA_RE.test(line)) withMedia++

    // The tags column is metadata, never part of the answer
    const tagIdx = tagsColumn !== null && tagsColumn < parts.length
      ? tagsColumn
      : parts.length > 2 ? parts.length - 1 : -1
    const tags = tagIdx > 1 ? splitTags(parts[tagIdx]) : []
    const answerParts = parts.slice(1).filter((_, i) => i + 1 !== tagIdx)

    // A cloze note carries its answer inside the sentence, and its second
    // field ("Extra") is usually empty. Requiring an answer silently threw
    // every one of them away.
    const cloze = /\{\{c\d+::/.test(parts[0])
    const q = ankiFieldToMarkdown(parts[0])
    const a = ankiFieldToMarkdown(answerParts.join(' '))
    if (q && (a || cloze)) cards.push({ q, a, tags, ...(cloze ? { cloze } : {}) })
  }
  return { cards, withMedia }
}

function splitTags(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean).map((t) =>
    // Anki nests tags with `::`; this app nests them with `/`
    t.replace(/^#/, '').replace(/::/g, '/'),
  )
}

/**
 * One Anki field → Markdown.
 * `{{c1::term}}` becomes `==term==`, which is exactly this app's cloze syntax,
 * and `[$]x[/$]` becomes `$x$`, which KaTeX already renders.
 */
export function ankiFieldToMarkdown(s: string, keepMedia = false): string {
  return s
    .replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '==$1==')
    .replace(/\[\$\$\]([\s\S]*?)\[\/\$\$\]/g, '$$$$$1$$$$')
    .replace(/\[\$\]([\s\S]*?)\[\/\$\]/g, '$$$1$$')
    // With keepMedia the file name is kept as a plain Markdown reference; the
    // importer rewrites it to the real path once the file has been extracted
    // The leading space keeps it off the end of the sentence; the collapse
    // below removes it again when there was already one
    .replace(/\[sound:([^\]]*)\]/gi, keepMedia ? ' [$1]($1)' : '')
    .replace(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, keepMedia ? ' ![]($1)' : '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/<\/?(div|p)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Anki cards → a Markdown note made of card callouts.
 * A cloze note becomes `> [!card]` with the sentence in the body, which is the
 * shape extractCards turns into one gap-fill card per `==highlight==`.
 */
export function ankiToMarkdown(title: string, cards: AnkiCard[]): string {
  const tags = [...new Set(cards.flatMap((c) => c.tags))]
  const header = tags.length > 0 ? `${tags.map((t) => `#${t}`).join(' ')}\n\n` : ''
  const body = cards
    .map((c) => {
      const quote = (s: string) => s.replace(/\n/g, '\n> ')
      if (c.cloze) {
        // The Extra field, when there is one, becomes the card's title
        return `> [!card]${c.a ? ' ' + quote(c.a) : ''}\n> ${quote(c.q)}`
      }
      return `> [!card]- ${c.q}\n> ${quote(c.a)}`
    })
    .join('\n\n')
  return `# ${title}\n\n${header}${body}\n`
}

const MEDIA_REF_RE = /!?\[[^\]]*\]\(([^)]+)\)/g

/** File names the deck refers to, so only those get extracted. */
export function collectMediaRefs(cards: AnkiCard[]): Set<string> {
  const refs = new Set<string>()
  for (const card of cards) {
    for (const text of [card.q, card.a]) {
      let m: RegExpExecArray | null
      MEDIA_REF_RE.lastIndex = 0
      while ((m = MEDIA_REF_RE.exec(text)) !== null) {
        const target = m[1].trim()
        // A URL, or something already pointing at a folder, is not media here
        if (target && !/^[a-z]+:\/\//i.test(target) && !target.includes('/')) refs.add(target)
      }
    }
  }
  return refs
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Points the references at the files that were actually written. */
export function rewriteMediaRefs(
  cards: AnkiCard[],
  written: Record<string, string>,
  prefix: string,
): AnkiCard[] {
  const names = Object.keys(written)
  if (names.length === 0) return cards
  // Longest first, so `foto.jpg` never eats the start of `foto.jpg.png`
  names.sort((a, b) => b.length - a.length)

  const fix = (text: string) => {
    let out = text
    for (const name of names) {
      // Anki file names are full of spaces, and `![](a b.png)` is not an image
      // in Markdown — the destination has to be escaped
      const target = `${prefix}${written[name]}`.replace(/ /g, '%20')
      out = out.replace(new RegExp(`(\\]\\()${escapeRe(name)}(\\))`, 'g'), `$1${target}$2`)
    }
    return out
  }
  return cards.map((c) => ({ ...c, q: fix(c.q), a: fix(c.a) }))
}

/**
 * Splits a deck into notes of at most `size` cards.
 * A single note of 2000 cards takes ~900ms to render every time it is opened;
 * at 100 per note that is ~45ms, which is the difference between usable and not.
 */
export function chunkCards(cards: AnkiCard[], size = 100): AnkiCard[][] {
  if (cards.length <= size) return [cards]
  const out: AnkiCard[][] = []
  for (let i = 0; i < cards.length; i += size) out.push(cards.slice(i, i + size))
  return out
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
