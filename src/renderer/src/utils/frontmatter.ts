// YAML frontmatter — the metadata format every Markdown tool shares (Obsidian,
// Jekyll, Hugo, Logseq). Parsing it is what makes an imported vault readable:
// without it the `---` block renders as a stray <h2> at the top of the note.

import { load } from 'js-yaml'

export type FrontmatterData = Record<string, unknown>

// A frontmatter block only counts when it opens on the very first line
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/**
 * Splits a note into its frontmatter fields and its body.
 * Invalid YAML yields `data: null` (and the body untouched) — a broken header
 * must never take the note's content down with it.
 */
export function parseFrontmatter(md: string): { data: FrontmatterData | null; body: string } {
  const m = FM_RE.exec(md)
  if (!m) return { data: null, body: md }
  const body = md.slice(m[0].length)
  try {
    const parsed = load(m[1])
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { data: null, body }
    return { data: parsed as FrontmatterData, body }
  } catch {
    return { data: null, body }
  }
}

/** Normalises a field that may be a list, a single value or a comma-separated string. */
export function asList(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  return String(value).split(',').map((v) => v.trim()).filter(Boolean)
}

/** Tags declared in the frontmatter, without the leading `#`, lowercased. */
export function frontmatterTags(data: FrontmatterData | null): string[] {
  if (!data) return []
  const raw = data.tags ?? data.tag
  return asList(raw).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean)
}

/** Alternative names for the note, as declared in `aliases:` / `alias:`. */
export function frontmatterAliases(data: FrontmatterData | null): string[] {
  if (!data) return []
  return asList(data.aliases ?? data.alias)
}
