import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import * as llm from './llm'
import * as plugins from './plugin-manager'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import path from 'path'
import chokidar, { FSWatcher } from 'chokidar'
import mammoth from 'mammoth'

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

ipcMain.handle('index:load', async (_, vaultPath: string) => {
  try {
    const file = getIndexPath(vaultPath)
    return JSON.parse(await fsp.readFile(file, 'utf-8'))
  } catch { return null }
})

ipcMain.handle('index:save', async (_, vaultPath: string, data: object) => {
  try {
    await fsp.writeFile(getIndexPath(vaultPath), JSON.stringify(data), 'utf-8')
    return true
  } catch { return false }
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
  const BINARY_EXTS = ['.pdf', '.docx', '.epub']
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
  return newPath
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
  } catch (e) {
    return { error: String(e) }
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
