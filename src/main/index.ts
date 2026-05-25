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
        {
          label: 'Open Vault…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => mainWindow.webContents.send('menu:open-vault')
        },
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu:new-note')
        },
        { type: 'separator' },
        {
          label: 'Backup Vault…',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => mainWindow.webContents.send('menu:backup')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+\\',
          click: () => mainWindow.webContents.send('menu:toggle-sidebar')
        },
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => mainWindow.webContents.send('menu:toggle-search')
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'reload' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── Vault ──────────────────────────────────────────────────────────────────

ipcMain.handle('vault:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select your vault folder'
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

function walkTree(dir: string): TreeNode[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const nodes: TreeNode[] = []
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.'))
  for (const d of dirs) {
    const fullPath = path.join(dir, d.name)
    nodes.push({ name: d.name, path: fullPath, type: 'directory', children: walkTree(fullPath) })
  }
  for (const f of files) {
    nodes.push({ name: f.name.replace(/\.md$/, ''), path: path.join(dir, f.name), type: 'file' })
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
    .on('add', (p) => mainWindow.webContents.send('vault:file-added', p))
    .on('unlink', (p) => mainWindow.webContents.send('vault:file-removed', p))
    .on('change', (p) => mainWindow.webContents.send('vault:file-changed', p))
    .on('addDir', (p) => mainWindow.webContents.send('vault:dir-added', p))
    .on('unlinkDir', (p) => mainWindow.webContents.send('vault:dir-removed', p))
  return true
})

ipcMain.handle('vault:backup', async (_, vaultPath: string) => {
  const dest = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select backup destination folder'
  })
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

ipcMain.handle('file:delete', async (_, filePath: string) => {
  fs.unlinkSync(filePath)
  return true
})

ipcMain.handle('file:rename', async (_, oldPath: string, newName: string) => {
  const dir = path.dirname(oldPath)
  const newPath = path.join(dir, `${newName}.md`)
  fs.renameSync(oldPath, newPath)
  return newPath
})

// ── Folders ────────────────────────────────────────────────────────────────

ipcMain.handle('folder:create', async (_, parentPath: string, folderName: string) => {
  const fullPath = path.join(parentPath, folderName)
  if (fs.existsSync(fullPath)) return { error: 'Folder already exists', path: fullPath }
  fs.mkdirSync(fullPath, { recursive: true })
  return { path: fullPath }
})

ipcMain.handle('folder:delete', async (_, folderPath: string) => {
  fs.rmSync(folderPath, { recursive: true, force: true })
  return true
})

ipcMain.handle('folder:rename', async (_, oldPath: string, newName: string) => {
  const newPath = path.join(path.dirname(oldPath), newName)
  fs.renameSync(oldPath, newPath)
  return newPath
})

// ── Images ─────────────────────────────────────────────────────────────────

ipcMain.handle('image:save', async (_, vaultPath: string, fileName: string, base64: string) => {
  const attachDir = path.join(vaultPath, '_attachments')
  fs.mkdirSync(attachDir, { recursive: true })
  const filePath = path.join(attachDir, fileName)
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return `_attachments/${fileName}`
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
