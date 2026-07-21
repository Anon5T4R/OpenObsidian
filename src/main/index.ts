import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import * as llm from './llm'
import * as plugins from './plugin-manager'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import path from 'path'
import chokidar, { FSWatcher } from 'chokidar'
import mammoth from 'mammoth'
import { rewriteLinks, countRefs } from './link-rewrite'
import { odtToHtml } from './odt'
import * as srs from './srs'

const fsp = fs.promises

let mainWindow: BrowserWindow
let vaultWatcher: FSWatcher | null = null

export type TreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  mtime?: number
  children?: TreeNode[]
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // In dev the renderer is served from http://localhost which blocks file://
      // iframes by default. Disable web security only in dev so PDF viewing works.
      webSecurity: !is.dev
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Open Vault…', accelerator: 'CmdOrCtrl+Shift+O', click: () => mainWindow.webContents.send('menu:open-vault') },
        { label: 'New Note',    accelerator: 'CmdOrCtrl+N',        click: () => mainWindow.webContents.send('menu:new-note') },
        { type: 'separator' },
        { label: 'Backup Vault…', accelerator: 'CmdOrCtrl+Shift+B', click: () => mainWindow.webContents.send('menu:backup') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: () => mainWindow.webContents.send('menu:toggle-sidebar') },
        { label: 'Search',         accelerator: 'CmdOrCtrl+Shift+F', click: () => mainWindow.webContents.send('menu:toggle-search') },
        { type: 'separator' },
        { role: 'toggleDevTools' }, { role: 'reload' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── App settings ───────────────────────────────────────────────────────────

function getAppSettingsPath(): string {
  return path.join(app.getPath('userData'), 'app-settings.json')
}
function readAppSettings(): Record<string, any> {
  try { return JSON.parse(fs.readFileSync(getAppSettingsPath(), 'utf-8')) } catch { return {} }
}
function writeAppSettings(data: Record<string, any>): void {
  try { fs.writeFileSync(getAppSettingsPath(), JSON.stringify(data, null, 2), 'utf-8') } catch {}
}

ipcMain.handle('app:get-last-vault', () => readAppSettings().lastVault ?? null)
ipcMain.handle('app:set-last-vault', (_, vaultPath: string) => {
  writeAppSettings({ ...readAppSettings(), lastVault: vaultPath })
})

// ── Vault index cache ──────────────────────────────────────────────────────
function vaultCacheKey(vaultPath: string): string {
  return Buffer.from(vaultPath).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function getIndexPath(vaultPath: string): string {
  const dir = path.join(app.getPath('userData'), 'indices')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${vaultCacheKey(vaultPath)}.json`)
}

// The index lives in memory here and is flushed to disk with a debounce, so
// per-note updates (auto-save) don't re-read/re-write the whole vault index.
type VaultIndex = { vaultPath: string; savedAt: number; entries: Record<string, { mtime: number; content: string }> }
const indexCache = new Map<string, VaultIndex>()
const indexFlushTimers = new Map<string, NodeJS.Timeout>()

async function getVaultIndex(vaultPath: string): Promise<VaultIndex | null> {
  const cached = indexCache.get(vaultPath)
  if (cached) return cached
  try {
    const idx = JSON.parse(await fsp.readFile(getIndexPath(vaultPath), 'utf-8')) as VaultIndex
    indexCache.set(vaultPath, idx)
    return idx
  } catch { return null }
}

function scheduleIndexFlush(vaultPath: string): void {
  const prev = indexFlushTimers.get(vaultPath)
  if (prev) clearTimeout(prev)
  indexFlushTimers.set(vaultPath, setTimeout(async () => {
    indexFlushTimers.delete(vaultPath)
    const idx = indexCache.get(vaultPath)
    if (!idx) return
    try { await fsp.writeFile(getIndexPath(vaultPath), JSON.stringify(idx), 'utf-8') } catch { /* cache only */ }
  }, 2000))
}

// Pending debounced writes must land before quit — synchronous on purpose
app.on('before-quit', () => {
  for (const [vp, timer] of indexFlushTimers) {
    clearTimeout(timer)
    const idx = indexCache.get(vp)
    if (!idx) continue
    try { fs.writeFileSync(getIndexPath(vp), JSON.stringify(idx), 'utf-8') } catch { /* cache only */ }
  }
  indexFlushTimers.clear()
})

ipcMain.handle('index:load', async (_, vaultPath: string) => getVaultIndex(vaultPath))

ipcMain.handle('index:save', async (_, vaultPath: string, data: object) => {
  try {
    indexCache.set(vaultPath, data as VaultIndex)
    await fsp.writeFile(getIndexPath(vaultPath), JSON.stringify(data), 'utf-8')
    return true
  } catch { return false }
})

ipcMain.handle('index:update-entry', async (_, vaultPath: string, filePath: string, content: string) => {
  const idx = await getVaultIndex(vaultPath)
  if (!idx) return false
  let mtime = Date.now()
  try { mtime = (await fsp.stat(filePath)).mtimeMs } catch { /* keep fallback */ }
  idx.entries[filePath] = { mtime, content }
  idx.savedAt = Date.now()
  scheduleIndexFlush(vaultPath)
  return true
})

// ── Vault ──────────────────────────────────────────────────────────────────

ipcMain.handle('vault:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Select your vault folder' })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

async function walkTree(dir: string): Promise<TreeNode[]> {
  let entries: fs.Dirent[]
  try { entries = await fsp.readdir(dir, { withFileTypes: true }) } catch { return [] }

  const nodes: TreeNode[] = []
  const dirs  = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  const BINARY_EXTS = ['.pdf', '.docx', '.epub', '.odt']
  const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.') &&
    (e.name.endsWith('.md') || BINARY_EXTS.some((x) => e.name.endsWith(x))))

  for (const d of dirs) {
    const fullPath = path.join(dir, d.name)
    nodes.push({ name: d.name, path: fullPath, type: 'directory', children: await walkTree(fullPath) })
  }
  for (const f of files) {
    const fullPath = path.join(dir, f.name)
    const mtime = (await fsp.stat(fullPath)).mtimeMs
    const isBinary = BINARY_EXTS.some((x) => f.name.endsWith(x))
    const name = isBinary ? f.name : f.name.replace(/\.md$/, '')
    nodes.push({ name, path: fullPath, type: 'file', mtime })
  }
  return nodes
}

ipcMain.handle('vault:list-tree', async (_, vaultPath: string) => walkTree(vaultPath))

ipcMain.handle('vault:list-files', async (_, vaultPath: string) => {
  const files: { name: string; path: string; relativePath: string }[] = []
  async function walk(dir: string) {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(fullPath)
      else if (entry.isFile() && entry.name.endsWith('.md'))
        files.push({ name: entry.name.replace(/\.md$/, ''), path: fullPath, relativePath: path.relative(vaultPath, fullPath) })
    }
  }
  await walk(vaultPath)
  return files
})

ipcMain.handle('vault:watch', async (_, vaultPath: string) => {
  if (vaultWatcher) { await vaultWatcher.close(); vaultWatcher = null }
  vaultWatcher = chokidar.watch(vaultPath, { ignored: /(^|[/\\])\./, persistent: true, ignoreInitial: true })
  vaultWatcher
    .on('add',      (p) => mainWindow.webContents.send('vault:file-added', p))
    .on('unlink',   (p) => mainWindow.webContents.send('vault:file-removed', p))
    .on('change',   (p) => mainWindow.webContents.send('vault:file-changed', p))
    .on('addDir',   (p) => mainWindow.webContents.send('vault:dir-added', p))
    .on('unlinkDir',(p) => mainWindow.webContents.send('vault:dir-removed', p))
  return true
})

ipcMain.handle('vault:backup', async (_, vaultPath: string) => {
  const dest = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Select backup destination folder' })
  if (dest.canceled || dest.filePaths.length === 0) return null
  const vaultName = path.basename(vaultPath)
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupDest = path.join(dest.filePaths[0], `${vaultName}-backup-${ts}`)
  await fsp.cp(vaultPath, backupDest, { recursive: true })
  return backupDest
})

// ── Files ──────────────────────────────────────────────────────────────────

ipcMain.handle('file:read', async (_, filePath: string) => fsp.readFile(filePath, 'utf-8'))

ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('file:create', async (_, vaultPath: string, noteName: string, folderPath?: string) => {
  const base = folderPath ?? vaultPath
  const filePath = path.join(base, `${noteName}.md`)
  if (fs.existsSync(filePath)) return { error: 'File already exists', path: filePath }
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, `# ${noteName}\n\n`, 'utf-8')
  return { path: filePath }
})

ipcMain.handle('file:delete',    async (_, filePath: string) => { await fsp.unlink(filePath); return true })

ipcMain.handle('file:rename', async (_, oldPath: string, newName: string) => {
  const dir = path.dirname(oldPath)
  const ext = path.extname(oldPath)
  const hasExt = path.extname(newName) !== ''
  const finalName = hasExt ? newName : `${newName}${ext}`
  const newPath = path.join(dir, finalName)
  await fsp.rename(oldPath, newPath)
  // Move the index entry along with the file so the cache does not keep a
  // ghost under the old path (link scans read from it)
  const idx = [...indexCache.values()].find((i) => i.entries[oldPath])
  if (idx) {
    idx.entries[newPath] = idx.entries[oldPath]
    delete idx.entries[oldPath]
    idx.savedAt = Date.now()
    scheduleIndexFlush(idx.vaultPath)
  }
  return newPath
})

// ── Link maintenance (rename keeps [[links]] alive) ────────────────────────

// Every markdown note of the vault as { path, content }, preferring the
// in-memory index so a rename does not re-read hundreds of files from disk.
async function readAllNotes(vaultPath: string): Promise<{ path: string; content: string }[]> {
  const idx = await getVaultIndex(vaultPath)
  const notes: { path: string; content: string }[] = []
  async function walk(dir: string) {
    let entries: fs.Dirent[]
    try { entries = await fsp.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { await walk(full); continue }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const cached = idx?.entries?.[full]
      let content = cached?.content
      if (content === undefined) {
        try { content = await fsp.readFile(full, 'utf-8') } catch { continue }
      } else {
        // Trust the cache only while the file has not changed underneath it
        try {
          const mtime = (await fsp.stat(full)).mtimeMs
          if (mtime !== cached?.mtime) content = await fsp.readFile(full, 'utf-8')
        } catch { /* keep the cached copy */ }
      }
      notes.push({ path: full, content })
    }
  }
  await walk(vaultPath)
  return notes
}

ipcMain.handle('link:find-refs', async (_, vaultPath: string, noteName: string) => {
  const notes = await readAllNotes(vaultPath)
  const paths: string[] = []
  let links = 0
  for (const note of notes) {
    const n = countRefs(note.content, noteName)
    if (n > 0) { paths.push(note.path); links += n }
  }
  return { files: paths.length, links, paths }
})

ipcMain.handle('link:update-refs', async (_, vaultPath: string, oldName: string, newName: string) => {
  const notes = await readAllNotes(vaultPath)
  const changed: string[] = []
  let links = 0
  const idx = await getVaultIndex(vaultPath)
  for (const note of notes) {
    const { content, count } = rewriteLinks(note.content, oldName, newName)
    if (count === 0) continue
    await fsp.writeFile(note.path, content, 'utf-8')
    changed.push(note.path)
    links += count
    if (idx) {
      let mtime = Date.now()
      try { mtime = (await fsp.stat(note.path)).mtimeMs } catch { /* keep fallback */ }
      idx.entries[note.path] = { mtime, content }
    }
  }
  if (idx && changed.length > 0) { idx.savedAt = Date.now(); scheduleIndexFlush(vaultPath) }
  return { files: changed.length, links, changed }
})

ipcMain.handle('file:duplicate', async (_, filePath: string) => {
  const dir  = path.dirname(filePath)
  const ext  = path.extname(filePath)
  const base = path.basename(filePath, ext)
  let dest = path.join(dir, `${base} copy${ext}`)
  let i = 2
  while (fs.existsSync(dest)) { dest = path.join(dir, `${base} copy ${i}${ext}`); i++ }
  await fsp.copyFile(filePath, dest)
  return { path: dest }
})

// ── Folders ────────────────────────────────────────────────────────────────

ipcMain.handle('folder:create', async (_, parentPath: string, folderName: string) => {
  const fullPath = path.join(parentPath, folderName)
  if (fs.existsSync(fullPath)) return { error: 'Folder already exists', path: fullPath }
  await fsp.mkdir(fullPath, { recursive: true })
  return { path: fullPath }
})

ipcMain.handle('folder:delete', async (_, folderPath: string) => {
  await fsp.rm(folderPath, { recursive: true, force: true }); return true
})

ipcMain.handle('folder:rename', async (_, oldPath: string, newName: string) => {
  const newPath = path.join(path.dirname(oldPath), newName)
  await fsp.rename(oldPath, newPath)
  return newPath
})

// ── Move ───────────────────────────────────────────────────────────────────

ipcMain.handle('item:move', async (_, sourcePath: string, targetDirPath: string) => {
  const name = path.basename(sourcePath)
  const dest = path.join(targetDirPath, name)
  if (fs.existsSync(dest)) return { error: 'An item with this name already exists in the destination' }
  try {
    await fsp.rename(sourcePath, dest)
    return { path: dest }
  } catch {
    // On Windows the vault watcher holds handles inside directories, making
    // rename fail with EPERM for non-empty folders; copy+delete is immune to
    // that (and to EXDEV cross-device moves).
    try {
      await fsp.cp(sourcePath, dest, { recursive: true })
      await fsp.rm(sourcePath, { recursive: true, force: true })
      return { path: dest }
    } catch (e) {
      return { error: String(e) }
    }
  }
})

// ── Images ─────────────────────────────────────────────────────────────────

ipcMain.handle('image:save', async (_, vaultPath: string, fileName: string, base64: string) => {
  const attachDir = path.join(vaultPath, '_attachments')
  await fsp.mkdir(attachDir, { recursive: true })
  const filePath = path.join(attachDir, fileName)
  await fsp.writeFile(filePath, Buffer.from(base64, 'base64'))
  return `_attachments/${fileName}`
})

// ── Export ─────────────────────────────────────────────────────────────────

ipcMain.handle('export:html', async (_, noteTitle: string, htmlContent: string) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${noteTitle}.html`,
    filters: [{ name: 'HTML', extensions: ['html'] }],
    title: 'Export as HTML'
  })
  if (result.canceled || !result.filePath) return null

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${noteTitle}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #1a1a2e; }
  h1,h2,h3,h4 { margin-top: 1.5em; margin-bottom: 0.5em; }
  code { background: #f0f0ee; padding: 2px 6px; border-radius: 3px; font-size: 0.88em; font-family: monospace; }
  pre { background: #f0f0ee; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #7c3aed; margin: 0; padding-left: 16px; color: #555; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td, th { border: 1px solid #d1d1c8; padding: 8px 12px; }
  th { background: #f0f0ee; font-weight: 600; }
  a { color: #6d28d9; }
  img { max-width: 100%; border-radius: 4px; }
  input[type=checkbox] { margin-right: 6px; }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`
  await fsp.writeFile(result.filePath, fullHtml, 'utf-8')
  return result.filePath
})

ipcMain.handle('export:pdf', async (_, noteTitle: string) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${noteTitle}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    title: 'Export as PDF'
  })
  if (result.canceled || !result.filePath) return null
  const pdfData = await mainWindow.webContents.printToPDF({ pageSize: 'A4', printBackground: false })
  await fsp.writeFile(result.filePath, pdfData)
  return result.filePath
})

// ── DOCX conversion (mammoth) ──────────────────────────────────────────────

ipcMain.handle('docx:to-html', async (_, filePath: string) => {
  try {
    const result = await mammoth.convertToHtml({ path: filePath })
    return { html: result.value, warnings: result.messages.map((m) => m.message) }
  } catch (e) {
    return { html: '', warnings: [], error: String(e) }
  }
})

ipcMain.handle('docx:to-markdown', async (_, filePath: string) => {
  try {
    // convertToMarkdown exists at runtime but is missing from mammoth's type defs
    const result = await (mammoth as any).convertToMarkdown({ path: filePath })
    return { markdown: result.value, warnings: result.messages.map((m) => m.message) }
  } catch (e) {
    return { markdown: '', warnings: [], error: String(e) }
  }
})

// ── Spaced repetition ──────────────────────────────────────────────────────

// Scheduling lives beside the vault, not inside the notes: it changes on every
// review and would dirty the diff of every note in a study session.
function srsPath(vaultPath: string): string {
  return path.join(vaultPath, '.openobsidian', 'srs.json')
}

const srsCache = new Map<string, srs.SrsFile>()

// Cards written before the tree stopped handing out absolute relativePaths
// carry an absolute `file`, and their ids were hashed from it. They cannot be
// matched to a note any more, so drop them: the next sync recreates them.
const ABSOLUTE_PATH_RE = /^([a-zA-Z]:[\\/]|[\\/])/

function dropAbsolutePathCards(file: srs.SrsFile): { file: srs.SrsFile; dropped: number } {
  const cards: typeof file.cards = {}
  let dropped = 0
  for (const [id, card] of Object.entries(file.cards)) {
    if (ABSOLUTE_PATH_RE.test(card.file)) { dropped++; continue }
    cards[id] = card
  }
  return { file: { version: 1, cards }, dropped }
}

async function readSrs(vaultPath: string): Promise<srs.SrsFile> {
  const cached = srsCache.get(vaultPath)
  if (cached) return cached
  let file: srs.SrsFile = { version: 1, cards: {} }
  try {
    const parsed = JSON.parse(await fsp.readFile(srsPath(vaultPath), 'utf-8'))
    if (parsed && typeof parsed === 'object' && parsed.cards) file = parsed as srs.SrsFile
  } catch { /* first run, or unreadable — start clean rather than crash */ }
  const migrated = dropAbsolutePathCards(file)
  srsCache.set(vaultPath, migrated.file)
  if (migrated.dropped > 0) await writeSrs(vaultPath, migrated.file)
  return migrated.file
}

async function writeSrs(vaultPath: string, file: srs.SrsFile): Promise<void> {
  srsCache.set(vaultPath, file)
  const target = srsPath(vaultPath)
  await fsp.mkdir(path.dirname(target), { recursive: true })
  // Write-then-rename: a crash mid-write must not truncate the schedule
  const tmp = `${target}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(file, null, 2), 'utf-8')
  await fsp.rename(tmp, target)
}

ipcMain.handle('srs:sync', async (_, vaultPath: string, file: string, found: { id: string; q: string }[]) => {
  const current = await readSrs(vaultPath)
  const { srs: next, added, removed } = srs.syncFile(current, file, found)
  if (added > 0 || removed > 0 || JSON.stringify(next) !== JSON.stringify(current)) {
    await writeSrs(vaultPath, next)
  }
  return { added, removed, stats: srs.stats(next) }
})

// Whole-vault sync: syncing only on save meant a card existed for the review
// panel only after you happened to edit its note
ipcMain.handle('srs:sync-all', async (_, vaultPath: string, notes: { file: string; cards: { id: string; q: string }[] }[]) => {
  let current = await readSrs(vaultPath)
  let added = 0
  let removed = 0
  for (const note of notes) {
    const r = srs.syncFile(current, note.file, note.cards)
    current = r.srs
    added += r.added
    removed += r.removed
  }
  await writeSrs(vaultPath, current)
  return { added, removed, stats: srs.stats(current) }
})

ipcMain.handle('srs:due', async (_, vaultPath: string, files?: string[]) => {
  const current = await readSrs(vaultPath)
  const due = srs.dueCards(current)
  // A deck is a file filter: the renderer knows which notes carry which tags
  return files ? due.filter((d) => files.includes(d.card.file)) : due
})

ipcMain.handle('srs:grade', async (_, vaultPath: string, id: string, g: srs.Grade) => {
  const current = await readSrs(vaultPath)
  const card = current.cards[id]
  if (!card) return { error: 'card not found' }
  const next = { version: 1 as const, cards: { ...current.cards, [id]: srs.grade(card, g) } }
  await writeSrs(vaultPath, next)
  return { card: next.cards[id], stats: srs.stats(next) }
})

ipcMain.handle('srs:suspend', async (_, vaultPath: string, id: string, suspended: boolean) => {
  const current = await readSrs(vaultPath)
  const card = current.cards[id]
  if (!card) return { error: 'card not found' }
  const next = { version: 1 as const, cards: { ...current.cards, [id]: { ...card, suspended } } }
  await writeSrs(vaultPath, next)
  return { stats: srs.stats(next) }
})

ipcMain.handle('srs:stats', async (_, vaultPath: string) => srs.stats(await readSrs(vaultPath)))

ipcMain.handle('srs:report', async (_, vaultPath: string) => srs.report(await readSrs(vaultPath)))

ipcMain.handle('srs:export-anki', async (_, cards: { q: string; a: string }[]) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'flashcards-anki.txt',
    filters: [{ name: 'Anki (tab-separated)', extensions: ['txt'] }],
    title: 'Export cards for Anki',
  })
  if (result.canceled || !result.filePath) return null
  await fsp.writeFile(result.filePath, srs.toAnkiText(cards), 'utf-8')
  return result.filePath
})

ipcMain.handle('srs:import-anki', async (_, vaultPath: string) => {
  const picked = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Anki export', extensions: ['txt', 'tsv', 'csv'] }],
    title: 'Import an Anki text export',
  })
  if (picked.canceled || picked.filePaths.length === 0) return null
  const raw = await fsp.readFile(picked.filePaths[0], 'utf-8')
  const cards = srs.fromAnkiText(raw)
  if (cards.length === 0) return { error: 'no cards found in that file' }

  const title = path.basename(picked.filePaths[0]).replace(/\.[^.]+$/, '')
  let target = path.join(vaultPath, `${title}.md`)
  let i = 2
  while (fs.existsSync(target)) { target = path.join(vaultPath, `${title} ${i}.md`); i++ }
  await fsp.writeFile(target, srs.ankiToMarkdown(path.basename(target, '.md'), cards), 'utf-8')
  return { path: target, count: cards.length }
})

// ── ODT conversion (adm-zip + content.xml) ─────────────────────────────────

ipcMain.handle('odt:to-html', async (_, filePath: string) => {
  try {
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(filePath)
    const content = zip.getEntry('content.xml')
    if (!content) return { html: '', warnings: [], error: 'content.xml not found in the .odt' }
    const styles = zip.getEntry('styles.xml')
    return {
      html: odtToHtml(
        zip.readAsText(content),
        styles ? zip.readAsText(styles) : '',
      ),
      warnings: [],
    }
  } catch (e) {
    return { html: '', warnings: [], error: String(e) }
  }
})

// ── Shell ──────────────────────────────────────────────────────────────────

ipcMain.handle('shell:show-item', async (_, itemPath: string) => {
  shell.showItemInFolder(itemPath)
})

ipcMain.handle('shell:open-path', async (_, itemPath: string) => {
  return await shell.openPath(itemPath) // '' = success, message = error
})

// ── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.openobsidian')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  buildMenu()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ── LLM ──────────────────────────────────────────────────────────────────────

ipcMain.handle('llm:status',       () => llm.getStatus())
ipcMain.handle('llm:get-settings', () => llm.getLlmSettings())
ipcMain.handle('llm:set-settings', (_, patch: Partial<llm.LlmSettings>) => llm.setLlmSettings(patch))

ipcMain.handle('llm:browse-gguf', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title:      'Select GGUF model file',
    filters:    [{ name: 'GGUF Models', extensions: ['gguf'] }],
    properties: ['openFile'],
  })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('llm:load', async (_, modelPath: string) => {
  await llm.loadModel(modelPath, (p) => mainWindow.webContents.send('llm:load-progress', p))
})

ipcMain.handle('llm:unload', async () => {
  await llm.unloadModel()
})

ipcMain.handle('llm:generate', async (_, messages: llm.ChatMessage[]) => {
  const settings     = llm.getLlmSettings()
  const onChunk      = (t: string) => mainWindow.webContents.send('llm:chunk', t)
  const sendDone     = () => mainWindow.webContents.send('llm:done')
  const sendError    = (e: string) => mainWindow.webContents.send('llm:error', e)

  try {
    if (settings.provider === 'local') {
      await llm.generateLocal(messages, settings.systemPrompt, onChunk)
    } else {
      await llm.generateRemote(messages, settings, onChunk)
    }
    sendDone()
  } catch (e: any) {
    if (e?.name === 'AbortError' || e?.message?.includes('AbortError')) sendDone()
    else sendError(String(e))
  }
})

ipcMain.handle('llm:cancel', () => llm.cancelGeneration())

ipcMain.handle('llm:transform', async (_, messages: llm.ChatMessage[]) => {
  return llm.generateTransform(messages)
})

// ── Plugins ──────────────────────────────────────────────────────────────────

ipcMain.handle('plugin:list',        ()                              => plugins.listPlugins())
ipcMain.handle('plugin:set-enabled', (_, id: string, value: boolean) => plugins.setPluginEnabled(id, value))
ipcMain.handle('plugin:exec',        (_, cmd: string, args: string[], cwd?: string, neutralLocale?: boolean) => plugins.execPlugin(cmd, args, cwd, neutralLocale))
ipcMain.handle('plugin:install-zip', ()                              => plugins.installFromZip())
ipcMain.handle('plugin:delete',      (_, id: string)                 => plugins.deletePlugin(id))
ipcMain.handle('plugin:open-dir',    ()                              => {
  const dir = plugins.openPluginsDir()
  shell.openPath(dir)
  return dir
})
