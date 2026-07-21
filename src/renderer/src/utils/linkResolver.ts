// Resolving a [[wikilink]] target to a note in the vault.
// Pure and dependency-free so it can be unit-tested and reused by the preview,
// the embed expansion and the navigation handler alike.

import type { NoteFile } from '../store/vaultStore'
import { frontmatterAliases, FrontmatterData } from './frontmatter'

/** alias (lowercase) → path of the note that declares it. */
export type AliasIndex = Map<string, string>

/**
 * In medicine almost everything has three names (IAM / infarto / síndrome
 * coronariana). Without aliases either the file name becomes a list of
 * synonyms, or the note is unreachable by the other names.
 * First declaration wins, so a duplicated alias stays predictable.
 */
export function buildAliasIndex(frontmatter: Record<string, FrontmatterData>): AliasIndex {
  const index: AliasIndex = new Map()
  for (const [path, data] of Object.entries(frontmatter)) {
    for (const alias of frontmatterAliases(data)) {
      const key = alias.trim().toLowerCase()
      if (key && !index.has(key)) index.set(key, path)
    }
  }
  return index
}

/** Splits `Nota#Seção` / `Pasta/Nota#^bloco` into its target and anchor parts. */
export function parseWikiTarget(raw: string): { target: string; hash: string | null } {
  const idx = raw.indexOf('#')
  if (idx === -1) return { target: raw.trim(), hash: null }
  const hash = raw.slice(idx + 1).trim()
  return { target: raw.slice(0, idx).trim(), hash: hash || null }
}

const norm = (s: string) => s.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase()

/** Number of leading path segments two notes share — Obsidian's "closest note wins". */
function sharedDepth(a: string, b: string): number {
  const pa = norm(a).split('/').slice(0, -1)
  const pb = norm(b).split('/').slice(0, -1)
  let i = 0
  while (i < pa.length && i < pb.length && pa[i] === pb[i]) i++
  return i
}

/**
 * Finds the note a wikilink target points at.
 * A target containing `/` is matched against the relative path, otherwise
 * against the file name. When several notes share a name, the one closest to
 * the linking note wins — otherwise the match would depend on scan order.
 * `fromPath` is the absolute path of the note holding the link.
 */
export function resolveNote(
  files: NoteFile[],
  target: string,
  fromPath?: string,
  aliases?: AliasIndex,
): NoteFile | null {
  const wanted = norm(target)
  if (!wanted) return null

  const matches = wanted.includes('/')
    ? files.filter((f) => norm(f.relativePath) === wanted || norm(f.relativePath).endsWith(`/${wanted}`))
    : files.filter((f) => f.name.toLowerCase() === wanted)

  // A real file name always wins over an alias
  if (matches.length === 0 && aliases) {
    const path = aliases.get(wanted)
    if (path) return files.find((f) => f.path === path) ?? null
  }

  if (matches.length <= 1) return matches[0] ?? null
  if (!fromPath) return matches[0]

  let best = matches[0]
  let bestDepth = -1
  for (const m of matches) {
    const d = sharedDepth(m.path, fromPath)
    if (d > bestDepth) { best = m; bestDepth = d }
  }
  return best
}

export interface UnresolvedLink {
  target: string
  sources: string[]
}

/**
 * Link targets with no note behind them, derived from the backlink index that
 * buildBacklinks already produces. Without this list a dead link is invisible:
 * the user clicks and nothing happens.
 */
export function findUnresolvedLinks(
  backlinks: Record<string, string[]>,
  files: NoteFile[],
  aliases?: AliasIndex,
): UnresolvedLink[] {
  const broken: UnresolvedLink[] = []
  for (const [raw, sources] of Object.entries(backlinks)) {
    const { target } = parseWikiTarget(raw)
    if (!target) continue // `[[#Seção]]` points inside the note itself
    if (resolveNote(files, target, undefined, aliases)) continue
    broken.push({ target: raw, sources: [...sources].sort((a, b) => a.localeCompare(b)) })
  }
  // Most-linked first: those are the ones costing the most navigation
  return broken.sort((a, b) => b.sources.length - a.sources.length || a.target.localeCompare(b.target))
}

/** Alias → note name pairs, with the original casing, for the `[[` autocomplete. */
export function listAliases(
  frontmatter: Record<string, FrontmatterData>,
  files: NoteFile[],
): { alias: string; note: string }[] {
  const byPath = new Map(files.map((f) => [f.path, f.name]))
  const out: { alias: string; note: string }[] = []
  for (const [path, data] of Object.entries(frontmatter)) {
    const note = byPath.get(path)
    if (!note) continue
    for (const alias of frontmatterAliases(data)) {
      if (alias.trim()) out.push({ alias: alias.trim(), note })
    }
  }
  return out.sort((a, b) => a.alias.localeCompare(b.alias))
}

export interface NameCollision {
  name: string
  files: NoteFile[]
}

/**
 * Notes sharing a file name. `[[Name]]` still resolves predictably (closest
 * note wins), but the user has no way of knowing two notes compete for it —
 * and reading the outdated twin is how wrong information survives.
 */
export function findNameCollisions(files: NoteFile[]): NameCollision[] {
  const byName = new Map<string, NoteFile[]>()
  for (const file of files) {
    const key = file.name.toLowerCase()
    const list = byName.get(key)
    if (list) list.push(file)
    else byName.set(key, [file])
  }
  return [...byName.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({ name: group[0].name, files: group }))
    .sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name))
}

/**
 * Notes nothing links to. They exist but are unreachable by navigation, so in
 * practice they disappear from the vault.
 */
export function findOrphanNotes(files: NoteFile[], backlinks: Record<string, string[]>): NoteFile[] {
  const linked = new Set<string>()
  for (const [raw, sources] of Object.entries(backlinks)) {
    if (sources.length === 0) continue
    const { target } = parseWikiTarget(raw)
    if (target) linked.add(target.toLowerCase().replace(/\.md$/i, ''))
  }
  return files
    .filter((f) => {
      if (linked.has(f.name.toLowerCase())) return false
      // A path link (`[[Pasta/Nota]]`) counts too
      const rel = f.relativePath.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase()
      return !linked.has(rel)
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** True when the vault has a note for this raw wikilink target (anchor included). */
export function noteExists(
  files: NoteFile[],
  raw: string,
  fromPath?: string,
  aliases?: AliasIndex,
): boolean {
  const { target } = parseWikiTarget(raw)
  // `[[#Seção]]` points inside the current note — always valid
  if (!target) return true
  return resolveNote(files, target, fromPath, aliases) !== null
}
