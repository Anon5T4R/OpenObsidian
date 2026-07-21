// A small query block, the 80% of Dataview that this vault actually needs.
//
// ```query
// tag: sis-cardio
// path: Patologias
// tipo: patologia          ← any frontmatter field
// sort: titulo
// limit: 20
// ```
//
// Manual indexes go stale, and a stale index is worse than none because you
// trust it. This keeps them derived from what the notes already say.

import type { NoteFile } from '../store/vaultStore'
import type { FrontmatterData } from './frontmatter'

export type SortKey = 'titulo' | 'title' | 'modificado' | 'modified' | 'criado' | 'created' | 'caminho' | 'path'

export interface QuerySpec {
  tags: string[]
  paths: string[]
  /** Frontmatter field → accepted values (any of them matches) */
  fields: Record<string, string[]>
  /** Fields that only need to exist */
  has: string[]
  sort: SortKey
  desc: boolean
  limit: number | null
  /** Lines that were not understood, echoed back so mistakes are visible */
  unknown: string[]
}

const SORT_KEYS: SortKey[] = ['titulo', 'title', 'modificado', 'modified', 'criado', 'created', 'caminho', 'path']

const RESERVED = new Set(['tag', 'tags', 'path', 'pasta', 'sort', 'ordenar', 'limit', 'limite', 'has', 'tem'])

const splitValues = (raw: string): string[] =>
  raw.split(',').map((v) => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean)

export function parseQueryBlock(source: string): QuerySpec {
  const spec: QuerySpec = {
    tags: [], paths: [], fields: {}, has: [],
    sort: 'titulo', desc: false, limit: null, unknown: [],
  }

  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue // comment
    const m = /^([\wÀ-ÿ.-]+)\s*:\s*(.*)$/.exec(line)
    if (!m) { spec.unknown.push(line); continue }

    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (!value) { spec.unknown.push(line); continue }

    switch (key) {
      case 'tag':
      case 'tags':
        spec.tags.push(...splitValues(value).map((v) => v.replace(/^#/, '').toLowerCase()))
        break
      case 'path':
      case 'pasta':
        spec.paths.push(...splitValues(value).map((v) => v.toLowerCase()))
        break
      case 'has':
      case 'tem':
        spec.has.push(...splitValues(value).map((v) => v.toLowerCase()))
        break
      case 'sort':
      case 'ordenar': {
        const desc = /\s+(desc|descending|inverso)$/i.test(value)
        const name = value.replace(/\s+(desc|asc|descending|ascending|inverso)$/i, '').trim().toLowerCase()
        if ((SORT_KEYS as string[]).includes(name)) { spec.sort = name as SortKey; spec.desc = desc }
        else spec.unknown.push(line)
        break
      }
      case 'limit':
      case 'limite': {
        const n = parseInt(value, 10)
        if (Number.isFinite(n) && n > 0) spec.limit = n
        else spec.unknown.push(line)
        break
      }
      default:
        if (RESERVED.has(key)) { spec.unknown.push(line); break }
        // Anything else is a frontmatter field
        spec.fields[key] = [...(spec.fields[key] ?? []), ...splitValues(value).map((v) => v.toLowerCase())]
    }
  }
  return spec
}

export interface QueryNote {
  file: NoteFile
  tags: string[]
  frontmatter: FrontmatterData | null
  mtime?: number
}

const asStrings = (value: unknown): string[] => {
  if (value == null) return []
  if (Array.isArray(value)) return value.map((v) => String(v).toLowerCase())
  return [String(value).toLowerCase()]
}

/** True when the note satisfies every condition in the spec. */
export function matchesQuery(note: QueryNote, spec: QuerySpec): boolean {
  // A parent tag matches its children, same as everywhere else in the app
  for (const tag of spec.tags) {
    if (!note.tags.some((t) => t === tag || t.startsWith(`${tag}/`))) return false
  }

  const rel = note.file.relativePath.replace(/\\/g, '/').toLowerCase()
  for (const p of spec.paths) if (!rel.includes(p)) return false

  const fm = note.frontmatter ?? {}
  for (const field of spec.has) {
    if (fm[field] == null || fm[field] === '') return false
  }

  for (const [field, wanted] of Object.entries(spec.fields)) {
    const actual = asStrings(fm[field])
    if (actual.length === 0) return false
    if (!wanted.some((w) => actual.includes(w))) return false
  }
  return true
}

function sortValue(note: QueryNote, key: SortKey): string | number {
  switch (key) {
    case 'modificado':
    case 'modified':
      return note.mtime ?? 0
    case 'criado':
    case 'created':
      // Frontmatter is the only place a creation date can come from
      return String(note.frontmatter?.created ?? note.frontmatter?.criado ?? '')
    case 'caminho':
    case 'path':
      return note.file.relativePath.toLowerCase()
    default:
      return note.file.name.toLowerCase()
  }
}

export function runQuery(notes: QueryNote[], spec: QuerySpec): QueryNote[] {
  const found = notes.filter((n) => matchesQuery(n, spec))
  found.sort((a, b) => {
    const va = sortValue(a, spec.sort)
    const vb = sortValue(b, spec.sort)
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb))
    return spec.desc ? -cmp : cmp
  })
  return spec.limit ? found.slice(0, spec.limit) : found
}

/** An empty spec would list the whole vault, which is never what was meant. */
export function isEmptySpec(spec: QuerySpec): boolean {
  return spec.tags.length === 0 && spec.paths.length === 0 &&
    spec.has.length === 0 && Object.keys(spec.fields).length === 0
}

// ── Sorting by creation date ───────────────────────────────────────────────
//
// `criado` is the one sort key the app cannot always honour, and until now it
// failed silently — the only place a query gave a *wrong* answer instead of an
// empty one or a warning.
//
// There is no creation date on disk that survives a sync or a copy, so it can
// only come from the frontmatter, and it arrives as text. Two ways that goes
// wrong:
//
//   - No note declares the field. Every value is '', every comparison ties,
//     and a stable sort hands back the vault scan order — which looks sorted.
//   - The value is not ISO. Comparison is textual, so `03/01/2026` sorts before
//     `21/07/2025`: by day, then month, and the year never gets a say.
//
// Deliberately *not* fixed by normalising `DD/MM/YYYY`: `03/01/2026` is the 3rd
// of January to half the world and the 1st of March to the other half. Guessing
// would trade a visible-once-you-look error for an invisible one. The app's rule
// is the other way round — say what cannot be done.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

export type SortIssue =
  | { kind: 'created-missing'; missing: number; total: number }
  | { kind: 'created-not-iso'; sample: string }

/** Reads the creation date a note declares, if any. */
export function createdValue(note: QueryNote): string {
  const fm = note.frontmatter ?? {}
  const raw = fm.created ?? fm.criado
  return raw == null ? '' : String(raw).trim()
}

/**
 * Whether the result can actually be ordered the way the block asked.
 *
 * Returns what is wrong rather than a message, so the wording stays in the
 * locale files and this stays testable.
 */
export function sortIssues(notes: QueryNote[], spec: QuerySpec): SortIssue[] {
  if (spec.sort !== 'criado' && spec.sort !== 'created') return []
  if (notes.length === 0) return []

  const values = notes.map(createdValue)
  const missing = values.filter((v) => v === '').length
  if (missing === values.length) {
    return [{ kind: 'created-missing', missing, total: values.length }]
  }

  const issues: SortIssue[] = []
  // Partly missing is still worth flagging: those notes clump at one end and
  // the list looks ordered
  if (missing > 0) issues.push({ kind: 'created-missing', missing, total: values.length })

  const offender = values.find((v) => v !== '' && !ISO_DATE.test(v))
  if (offender) issues.push({ kind: 'created-not-iso', sample: offender })
  return issues
}
