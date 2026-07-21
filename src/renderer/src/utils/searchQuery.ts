// Parsing and matching for the search panel.
// The vault's central use case is "search by symptom, land on the conduct
// fast", which is a faceted search — hence the tag:/path:/file: operators.
// Pure functions so the whole grammar is unit-tested.

export interface ParsedQuery {
  terms: string[]     // free text, all must appear
  phrases: string[]   // "exact phrase", all must appear
  excluded: string[]  // -term / -"phrase", none may appear
  tags: string[]      // tag:x
  paths: string[]     // path:x
  files: string[]     // file:x
}

/** Splits on whitespace but keeps "quoted phrases" (and -"negated" ones) whole. */
function tokenize(raw: string): string[] {
  return raw.match(/-?"[^"]*"?|\S+/g) ?? []
}

const unquote = (s: string) => s.replace(/^"|"$/g, '')

export function parseQuery(raw: string): ParsedQuery {
  const q: ParsedQuery = { terms: [], phrases: [], excluded: [], tags: [], paths: [], files: [] }

  for (const token of tokenize(raw)) {
    const negated = token.startsWith('-') && token.length > 1
    const body = negated ? token.slice(1) : token

    const field = /^(tag|path|file):(.*)$/i.exec(body)
    if (field) {
      const value = unquote(field[2]).toLowerCase()
      if (!value) continue
      const key = field[1].toLowerCase()
      if (key === 'tag')  q.tags.push(value.replace(/^#/, ''))
      if (key === 'path') q.paths.push(value)
      if (key === 'file') q.files.push(value)
      continue
    }

    const isPhrase = body.startsWith('"')
    const value = unquote(body).toLowerCase().trim()
    if (!value) continue
    if (negated) q.excluded.push(value)
    else if (isPhrase) q.phrases.push(value)
    else q.terms.push(value)
  }
  return q
}

export function isEmptyQuery(q: ParsedQuery): boolean {
  return q.terms.length === 0 && q.phrases.length === 0 && q.excluded.length === 0 &&
    q.tags.length === 0 && q.paths.length === 0 && q.files.length === 0
}

/** The parts a note's text is searched for — what gets highlighted in results. */
export function textNeedles(q: ParsedQuery): string[] {
  return [...q.phrases, ...q.terms]
}

export interface SearchableNote {
  name: string
  relativePath: string
  content: string
  tags: string[]
  /** Frontmatter aliases — `file:iam` should find the note called SCA */
  aliases?: string[]
}

export interface NoteMatch {
  line: number
  text: string
}

const includesAll = (haystack: string, needles: string[]) => needles.every((n) => haystack.includes(n))

/**
 * Decides whether a note satisfies the query and returns the matching lines.
 * A note can satisfy the filters without any matching line (`tag:cardio` alone),
 * in which case the match list is empty but the note is still a result.
 */
export function matchNote(
  note: SearchableNote,
  q: ParsedQuery,
  regex: RegExp | null = null,
): NoteMatch[] | null {
  const lowerContent = note.content.toLowerCase()

  // A tag filter matches the tag itself or any of its children
  for (const tag of q.tags) {
    if (!note.tags.some((t) => t === tag || t.startsWith(`${tag}/`))) return null
  }
  const relative = note.relativePath.replace(/\\/g, '/').toLowerCase()
  if (!includesAll(relative, q.paths)) return null
  // `file:` matches the file name or any of its aliases
  const names = [note.name.toLowerCase(), ...(note.aliases ?? []).map((a) => a.toLowerCase())]
  if (!q.files.every((needle) => names.some((n) => n.includes(needle)))) return null

  const needles = textNeedles(q)
  if (!regex && !includesAll(lowerContent, needles)) return null
  if (q.excluded.some((e) => lowerContent.includes(e))) return null

  const matches: NoteMatch[] = []
  if (regex || needles.length > 0) {
    const lines = note.content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const hit = regex
        ? regex.test(line)
        : needles.some((n) => line.toLowerCase().includes(n))
      if (regex) regex.lastIndex = 0
      if (hit) matches.push({ line: i + 1, text: line.trim() })
    }
    // Regex mode has no whole-note pre-check, so no lines means no result
    if (regex && matches.length === 0) return null
  }
  return matches
}

/** Compiles the free-text part as a regex; invalid patterns yield null. */
export function compileRegex(raw: string): RegExp | null {
  try {
    return new RegExp(raw, 'i')
  } catch {
    return null
  }
}
