import { contextBridge, ipcRenderer } from 'electron'

export type FileInfo = {
  name: string
  path: string
  relativePath: string
}

export type TreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

const api = {
  // App settings
  getLastVault: (): Promise<string | null> => ipcRenderer.invoke('app:get-last-vault'),
  setLastVault: (vaultPath: string): Promise<void> => ipcRenderer.invoke('app:set-last-vault', vaultPath),

  // Vault
  openVault: (): Promise<string | null> => ipcRenderer.invoke('vault:open'),
  listTree: (vaultPath: string): Promise<TreeNode[]> => ipcRenderer.invoke('vault:list-tree', vaultPath),
  listFiles: (vaultPath: string): Promise<FileInfo[]> => ipcRenderer.invoke('vault:list-files', vaultPath),
  watchVault: (vaultPath: string): Promise<boolean> => ipcRenderer.invoke('vault:watch', vaultPath),
  backupVault: (vaultPath: string): Promise<string | null> => ipcRenderer.invoke('vault:backup', vaultPath),

  // Files
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string): Promise<boolean> => ipcRenderer.invoke('file:write', filePath, content),
  createFile: (vaultPath: string, noteName: string, folderPath?: string): Promise<{ path?: string; error?: string }> =>
    ipcRenderer.invoke('file:create', vaultPath, noteName, folderPath),
  deleteFile: (filePath: string): Promise<boolean> => ipcRenderer.invoke('file:delete', filePath),
  renameFile: (oldPath: string, newName: string): Promise<string> => ipcRenderer.invoke('file:rename', oldPath, newName),
  duplicateFile: (filePath: string): Promise<{ path?: string; error?: string }> =>
    ipcRenderer.invoke('file:duplicate', filePath),

  // Folders
  createFolder: (parentPath: string, folderName: string): Promise<{ path?: string; error?: string }> =>
    ipcRenderer.invoke('folder:create', parentPath, folderName),
  deleteFolder: (folderPath: string): Promise<boolean> => ipcRenderer.invoke('folder:delete', folderPath),
  renameFolder: (oldPath: string, newName: string): Promise<string> => ipcRenderer.invoke('folder:rename', oldPath, newName),

  // Move (file or folder to new parent)
  moveItem: (sourcePath: string, targetDirPath: string): Promise<{ path?: string; error?: string }> =>
    ipcRenderer.invoke('item:move', sourcePath, targetDirPath),

  // Images
  saveImage: (vaultPath: string, fileName: string, base64: string): Promise<string> =>
    ipcRenderer.invoke('image:save', vaultPath, fileName, base64),

  // Shell
  showItemInFolder: (itemPath: string): Promise<void> => ipcRenderer.invoke('shell:show-item', itemPath),

  // Menu events
  onMenuOpenVault: (cb: () => void) => { ipcRenderer.on('menu:open-vault', cb); return () => ipcRenderer.removeListener('menu:open-vault', cb) },
  onMenuNewNote: (cb: () => void) => { ipcRenderer.on('menu:new-note', cb); return () => ipcRenderer.removeListener('menu:new-note', cb) },
  onMenuToggleSearch: (cb: () => void) => { ipcRenderer.on('menu:toggle-search', cb); return () => ipcRenderer.removeListener('menu:toggle-search', cb) },
  onMenuToggleSidebar: (cb: () => void) => { ipcRenderer.on('menu:toggle-sidebar', cb); return () => ipcRenderer.removeListener('menu:toggle-sidebar', cb) },
  onMenuBackup: (cb: () => void) => { ipcRenderer.on('menu:backup', cb); return () => ipcRenderer.removeListener('menu:backup', cb) },

  // Vault watch events
  onFileAdded: (cb: (path: string) => void) => {
    const h = (_: Electron.IpcRendererEvent, p: string) => cb(p)
    ipcRenderer.on('vault:file-added', h); return () => ipcRenderer.removeListener('vault:file-added', h)
  },
  onFileRemoved: (cb: (path: string) => void) => {
    const h = (_: Electron.IpcRendererEvent, p: string) => cb(p)
    ipcRenderer.on('vault:file-removed', h); return () => ipcRenderer.removeListener('vault:file-removed', h)
  },
  onFileChanged: (cb: (path: string) => void) => {
    const h = (_: Electron.IpcRendererEvent, p: string) => cb(p)
    ipcRenderer.on('vault:file-changed', h); return () => ipcRenderer.removeListener('vault:file-changed', h)
  },
  onDirAdded: (cb: (path: string) => void) => {
    const h = (_: Electron.IpcRendererEvent, p: string) => cb(p)
    ipcRenderer.on('vault:dir-added', h); return () => ipcRenderer.removeListener('vault:dir-added', h)
  },
  onDirRemoved: (cb: (path: string) => void) => {
    const h = (_: Electron.IpcRendererEvent, p: string) => cb(p)
    ipcRenderer.on('vault:dir-removed', h); return () => ipcRenderer.removeListener('vault:dir-removed', h)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
