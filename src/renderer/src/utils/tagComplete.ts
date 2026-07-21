// Tags offered after `#` in the editor.
//
// The vault knows every tag it has and how often each is used — that index
// already feeds the sidebar strip. It was never offered at the moment it is
// actually needed: writing the tag line under a heading, or filling `tag:`
// inside a ```query block. So tags were typed from memory, and a typo does not
// fail loudly: it silently creates a new tag with one note in it.

export interface TagOption {
  tag: string
  /** Notes carrying it — the ranking signal, and worth showing in the menu */
  count: number
}

/**
 * Tags matching `query`, best first.
 *
 * A tag that *starts* with what was typed always beats one that merely contains
 * it, because that is what someone typing a prefix means. Within each group the
 * most-used wins: in a vault of hundreds of tags the alphabetical tail is noise.
 */
export function rankTags(
  index: Record<string, string[]>,
  query: string,
  limit = 40,
): TagOption[] {
  const q = query.trim().toLowerCase()

  const prefix: TagOption[] = []
  const contains: TagOption[] = []

  for (const [tag, notes] of Object.entries(index)) {
    const lower = tag.toLowerCase()
    const option = { tag, count: notes.length }
    if (!q) prefix.push(option)
    else if (lower.startsWith(q)) prefix.push(option)
    else if (lower.includes(q)) contains.push(option)
  }

  const byUse = (a: TagOption, b: TagOption) =>
    b.count - a.count || a.tag.localeCompare(b.tag)

  prefix.sort(byUse)
  contains.sort(byUse)
  return [...prefix, ...contains].slice(0, limit)
}

/**
 * Whether a `#` starts a tag rather than something else.
 *
 * Mirrors the rule the renderer and the indexer already share: a tag begins a
 * word, so `foo#bar` is not one.
 */
export function startsTag(charBefore: string): boolean {
  return charBefore === '' || /[\s(>]/.test(charBefore)
}

/** Where the tag being typed starts, and what has been typed so far. */
export interface TagMatch {
  /** Column of the `#`, counted from the start of the line */
  from: number
  /** What follows the `#` */
  query: string
}

// At least one tag character after the `#`. This is the whole reason headings
// are safe: a heading is `#` followed by a space, so it can never match, and no
// special case for it is needed. `##` cannot match either — `#` is not a tag
// character. The menu opening on every `# Título` in a vault of 470 notes would
// have made the feature worse than not having it.
const TAG_AT_CURSOR = /#([\p{L}\p{N}_/-]+)$/u

/**
 * The tag being typed at the end of `lineUpToCursor`, if any.
 *
 * Takes the line rather than an editor so the trigger rules — the part that
 * decides whether a menu appears while someone is writing a heading — can be
 * tested without a running editor.
 */
export function matchTagQuery(lineUpToCursor: string): TagMatch | null {
  const m = TAG_AT_CURSOR.exec(lineUpToCursor)
  if (!m) return null
  const from = m.index
  if (!startsTag(from === 0 ? '' : lineUpToCursor[from - 1])) return null
  return { from, query: m[1] }
}
