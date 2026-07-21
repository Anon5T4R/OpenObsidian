// Reading an Anki `.apkg` directly, so importing a shared deck does not
// require installing Anki Desktop just to re-export it as text.
//
// An .apkg is a ZIP holding a SQLite collection. We read it with sql.js
// (SQLite compiled to WASM): no native module, so the Electron build matrix
// stays as it is.

import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import initSqlJs from 'sql.js'
import { decompress as zstdDecompress } from 'fzstd'
import { AnkiCard, ankiFieldToMarkdown } from './srs'

/** Anki joins a note's fields with the unit separator. */
const FIELD_SEP = String.fromCharCode(0x1f)

export interface ApkgResult {
  cards: AnkiCard[]
  withMedia: number
}

/**
 * One row of Anki's `notes` table → a card.
 * Pure, so the mapping is testable without a database: `flds` is the raw
 * field blob and `tags` the raw space-separated string.
 */
export function noteRowToCard(flds: string, tags: string): AnkiCard | null {
  const fields = flds.split(FIELD_SEP)
  if (fields.length === 0) return null

  // Cloze is detected from the text, not from the note type: the note type
  // lives in a different table whose format changed between Anki versions
  const cloze = /\{\{c\d+::/.test(fields[0])
  const q = ankiFieldToMarkdown(fields[0])
  const a = ankiFieldToMarkdown(fields.slice(1).join(' '))
  if (!q || (!a && !cloze)) return null

  const tagList = tags.trim().split(/\s+/).filter(Boolean)
    // Anki nests tags with `::`; this app nests them with `/`
    .map((t) => t.replace(/^#/, '').replace(/::/g, '/'))

  return { q, a, tags: tagList, ...(cloze ? { cloze: true } : {}) }
}

const MEDIA_RE = /<img\b[^>]*>|\[sound:[^\]]*\]/i

const SQLITE_MAGIC = 'SQLite format 3'
// Zstandard frame magic 0xFD2FB528, little endian on disk
const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

const isSqlite = (b: Buffer) => b.subarray(0, 15).toString('latin1') === SQLITE_MAGIC
const isZstd   = (b: Buffer) => b.subarray(0, 4).equals(ZSTD_MAGIC)

/**
 * The SQLite collection inside the archive, newest layout first.
 * Anki 2.1.50+ writes `collection.anki21b` compressed with zstd. Electron's
 * Node has no zstd, so it is decompressed in pure JS.
 */
export function findCollection(zip: Pick<AdmZip, 'getEntry'>): Buffer | null {
  for (const name of ['collection.anki21b', 'collection.anki21', 'collection.anki2']) {
    const entry = zip.getEntry(name)
    if (!entry) continue
    let data: Buffer
    try { data = entry.getData() } catch { continue }
    if (isSqlite(data)) return data
    if (isZstd(data)) {
      try {
        const plain = Buffer.from(zstdDecompress(new Uint8Array(data)))
        if (isSqlite(plain)) return plain
      } catch { /* fall through to the next candidate */ }
    }
  }
  return null
}

let sqlPromise: Promise<initSqlJs.SqlJsStatic> | null = null

function loadSql(): Promise<initSqlJs.SqlJsStatic> {
  // In the packaged app the wasm sits next to sql.js inside node_modules
  const wasmDir = path.join(require.resolve('sql.js'), '..')
  const started = sqlPromise
    ?? initSqlJs({ locateFile: (file: string) => path.join(wasmDir, file) })
  sqlPromise = started
  return started
}

export async function readApkg(filePath: string): Promise<ApkgResult | { error: string }> {
  let data: Buffer | null
  try {
    data = findCollection(new AdmZip(filePath))
  } catch (e) {
    return { error: `could not open the .apkg: ${String(e)}` }
  }
  if (!data) return { error: 'no readable collection inside the .apkg' }

  const SQL = await loadSql()
  let db: initSqlJs.Database
  try {
    db = new SQL.Database(new Uint8Array(data))
  } catch (e) {
    return { error: `could not read the collection: ${String(e)}` }
  }

  const cards: AnkiCard[] = []
  let withMedia = 0
  try {
    const stmt = db.prepare('SELECT flds, tags FROM notes')
    while (stmt.step()) {
      const [flds, tags] = stmt.get() as [string, string]
      if (typeof flds !== 'string') continue
      if (MEDIA_RE.test(flds)) withMedia++
      const card = noteRowToCard(flds, typeof tags === 'string' ? tags : '')
      if (card) cards.push(card)
    }
    stmt.free()
  } catch (e) {
    return { error: `could not read the notes table: ${String(e)}` }
  } finally {
    db.close()
  }

  return { cards, withMedia }
}

/** True when the path looks like an Anki package rather than a text export. */
export function isApkg(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.apkg'
}

/** Deck name to use for the imported notes. */
export function deckNameFor(filePath: string): string {
  return path.basename(filePath, path.extname(filePath))
}

// Re-exported so the import handler does not need to know about fs here
export const fileExists = (p: string): boolean => fs.existsSync(p)
