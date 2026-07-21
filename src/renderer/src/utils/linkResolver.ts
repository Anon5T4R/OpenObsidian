// Resolving a [[wikilink]] target to a note in the vault.
// Pure and dependency-free so it can be unit-tested and reused by the preview,
// the embed expansion and the navigation handler alike.

import type { NoteFile } from '../store/vaultStore'

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
): NoteFile | null {
  const wanted = norm(target)
  if (!wanted) return null

  const matches = wanted.includes('/')
    ? files.filter((f) => norm(f.relativePath) === wanted || norm(f.relativePath).endsWith(`/${wanted}`))
    : files.filter((f) => f.name.toLowerCase() === wanted)

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
): UnresolvedLink[] {
  const broken: UnresolvedLink[] = []
  for (const [raw, sources] of Object.entries(backlinks)) {
    const { target } = parseWikiTarget(raw)
    if (!target) continue // `[[#Seção]]` points inside the note itself
    if (resolveNote(files, target)) continue
    broken.push({ target: raw, sources: [...sources].sort((a, b) => a.localeCompare(b)) })
  }
  // Most-linked first: those are the ones costing the most navigation
  return broken.sort((a, b) => b.sources.length - a.sources.length || a.target.localeCompare(b.target))
}

/** True when the vault has a note for this raw wikilink target (anchor included). */
export function noteExists(files: NoteFile[], raw: string, fromPath?: string): boolean {
  const { target } = parseWikiTarget(raw)
  // `[[#Seção]]` points inside the current note — always valid
  if (!target) return true
  return resolveNote(files, target, fromPath) !== null
}
