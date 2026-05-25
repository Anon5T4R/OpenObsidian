import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import path from 'path'
import chokidar, { FSWatcher } from 'chokidar'

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
      sandbox: false
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

// ── Vault ──────────────────────────────────────────────────────────────────

ipcMain.handle('vault:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Select your vault folder' })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

function walkTree(dir: string): TreeNode[] {
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }

  const nodes: TreeNode[] = []
  const dirs  = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.'))

  for (const d of dirs) {
    const fullPath = path.join(dir, d.name)
    nodes.push({ name: d.name, path: fullPath, type: 'directory', children: walkTree(fullPath) })
  }
  for (const f of files) {
    const fullPath = path.join(dir, f.name)
    const mtime = fs.statSync(fullPath).mtimeMs
    nodes.push({ name: f.name.replace(/\.md$/, ''), path: fullPath, type: 'file', mtime })
  }
  return nodes
}

ipcMain.handle('vault:list-tree', async (_, vaultPath: string) => walkTree(vaultPath))

ipcMain.handle('vault:list-files', async (_, vaultPath: string) => {
  const files: { name: string; path: string; relativePath: string }[] = []
  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      else if (entry.isFile() && entry.name.endsWith('.md'))
        files.push({ name: entry.name.replace(/\.md$/, ''), path: fullPath, relativePath: path.relative(vaultPath, fullPath) })
    }
  }
  walk(vaultPath)
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
  fs.cpSync(vaultPath, backupDest, { recursive: true })
  return backupDest
})

// ── Files ──────────────────────────────────────────────────────────────────

ipcMain.handle('file:read', async (_, filePath: string) => fs.readFileSync(filePath, 'utf-8'))

ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('file:create', async (_, vaultPath: string, noteName: string, folderPath?: string) => {
  const base = folderPath ?? vaultPath
  const filePath = path.join(base, `${noteName}.md`)
  if (fs.existsSync(filePath)) return { error: 'File already exists', path: filePath }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `# ${noteName}\n\n`, 'utf-8')
  return { path: filePath }
})

ipcMain.handle('file:delete',    async (_, filePath: string) => { fs.unlinkSync(filePath); return true })

ipcMain.handle('file:rename', async (_, oldPath: string, newName: string) => {
  const dir = path.dirname(oldPath)
  const newPath = path.join(dir, `${newName}.md`)
  fs.renameSync(oldPath, newPath)
  return newPath
})

ipcMain.handle('file:duplicate', async (_, filePath: string) => {
  const dir  = path.dirname(filePath)
  const ext  = path.extname(filePath)
  const base = path.basename(filePath, ext)
  let dest = path.join(dir, `${base} copy${ext}`)
  let i = 2
  while (fs.existsSync(dest)) { dest = path.join(dir, `${base} copy ${i}${ext}`); i++ }
  fs.copyFileSync(filePath, dest)
  return { path: dest }
})

// ── Folders ────────────────────────────────────────────────────────────────

ipcMain.handle('folder:create', async (_, parentPath: string, folderName: string) => {
  const fullPath = path.join(parentPath, folderName)
  if (fs.existsSync(fullPath)) return { error: 'Folder already exists', path: fullPath }
  fs.mkdirSync(fullPath, { recursive: true })
  return { path: fullPath }
})

ipcMain.handle('folder:delete', async (_, folderPath: string) => {
  fs.rmSync(folderPath, { recursive: true, force: true }); return true
})

ipcMain.handle('folder:rename', async (_, oldPath: string, newName: string) => {
  const newPath = path.join(path.dirname(oldPath), newName)
  fs.renameSync(oldPath, newPath)
  return newPath
})

// ── Move ───────────────────────────────────────────────────────────────────

ipcMain.handle('item:move', async (_, sourcePath: string, targetDirPath: string) => {
  const name = path.basename(sourcePath)
  const dest = path.join(targetDirPath, name)
  if (fs.existsSync(dest)) return { error: 'An item with this name already exists in the destination' }
  fs.renameSync(sourcePath, dest)
  return { path: dest }
})

// ── Images ─────────────────────────────────────────────────────────────────

ipcMain.handle('image:save', async (_, vaultPath: string, fileName: string, base64: string) => {
  const attachDir = path.join(vaultPath, '_attachments')
  fs.mkdirSync(attachDir, { recursive: true })
  const filePath = path.join(attachDir, fileName)
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
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
  fs.writeFileSync(result.filePath, fullHtml, 'utf-8')
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
  fs.writeFileSync(result.filePath, pdfData)
  return result.filePath
})

// ── Shell ──────────────────────────────────────────────────────────────────

ipcMain.handle('shell:show-item', async (_, itemPath: string) => {
  shell.showItemInFolder(itemPath)
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
