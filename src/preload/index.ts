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
  mtime?: number
  children?: TreeNode[]
}

const api = {
  // App settings
  getLastVault:  (): Promise<string | null> => ipcRenderer.invoke('app:get-last-vault'),
  setLastVault:  (vaultPath: string): Promise<void> => ipcRenderer.invoke('app:set-last-vault', vaultPath),

  // Vault
  openVault:   (): Promise<string | null>    => ipcRenderer.invoke('vault:open'),
  listTree:    (p: string): Promise<TreeNode[]> => ipcRenderer.invoke('vault:list-tree', p),
  listFiles:   (p: string): Promise<FileInfo[]> => ipcRenderer.invoke('vault:list-files', p),
  watchVault:  (p: string): Promise<boolean>    => ipcRenderer.invoke('vault:watch', p),
  backupVault: (p: string): Promise<string | null> => ipcRenderer.invoke('vault:backup', p),

  // Files
  readFile:     (p: string): Promise<string>            => ipcRenderer.invoke('file:read', p),
  writeFile:    (p: string, c: string): Promise<boolean> => ipcRenderer.invoke('file:write', p, c),
  createFile:   (vault: string, name: string, folder?: string): Promise<{ path?: string; error?: string }> =>
    ipcRenderer.invoke('file:create', vault, name, folder),
  deleteFile:    (p: string): Promise<boolean>           => ipcRenderer.invoke('file:delete', p),
  renameFile:    (old: string, n: string): Promise<string> => ipcRenderer.invoke('file:rename', old, n),
  duplicateFile: (p: string): Promise<{ path?: string; error?: string }> => ipcRenderer.invoke('file:duplicate', p),

  // Folders
  createFolder: (parent: string, name: string): Promise<{ path?: string; error?: string }> =>
    ipcRenderer.invoke('folder:create', parent, name),
  deleteFolder: (p: string): Promise<boolean>           => ipcRenderer.invoke('folder:delete', p),
  renameFolder: (old: string, n: string): Promise<string> => ipcRenderer.invoke('folder:rename', old, n),

  // Move
  moveItem: (src: string, dest: string): Promise<{ path?: string; error?: string }> =>
    ipcRenderer.invoke('item:move', src, dest),

  // Images
  saveImage: (vault: string, name: string, b64: string): Promise<string> =>
    ipcRenderer.invoke('image:save', vault, name, b64),

  // Export
  exportHtml: (title: string, html: string): Promise<string | null> =>
    ipcRenderer.invoke('export:html', title, html),
  exportPdf: (title: string): Promise<string | null> =>
    ipcRenderer.invoke('export:pdf', title),

  // Vault index cache
  loadIndex: (vaultPath: string): Promise<{ vaultPath: string; savedAt: number; entries: Record<string, { mtime: number; content: string }> } | null> =>
    ipcRenderer.invoke('index:load', vaultPath),
  saveIndex: (vaultPath: string, data: object): Promise<boolean> =>
    ipcRenderer.invoke('index:save', vaultPath, data),

  // Shell
  showItemInFolder: (p: string): Promise<void> => ipcRenderer.invoke('shell:show-item', p),

  // Menu events
  onMenuOpenVault:    (cb: () => void) => { ipcRenderer.on('menu:open-vault', cb);    return () => ipcRenderer.removeListener('menu:open-vault', cb) },
  onMenuNewNote:      (cb: () => void) => { ipcRenderer.on('menu:new-note', cb);      return () => ipcRenderer.removeListener('menu:new-note', cb) },
  onMenuToggleSearch: (cb: () => void) => { ipcRenderer.on('menu:toggle-search', cb); return () => ipcRenderer.removeListener('menu:toggle-search', cb) },
  onMenuToggleSidebar:(cb: () => void) => { ipcRenderer.on('menu:toggle-sidebar', cb);return () => ipcRenderer.removeListener('menu:toggle-sidebar', cb) },
  onMenuBackup:       (cb: () => void) => { ipcRenderer.on('menu:backup', cb);        return () => ipcRenderer.removeListener('menu:backup', cb) },

  // Vault watch events
  onFileAdded:   (cb: (p: string) => void) => { const h = (_: Electron.IpcRendererEvent, p: string) => cb(p); ipcRenderer.on('vault:file-added', h);    return () => ipcRenderer.removeListener('vault:file-added', h) },
  onFileRemoved: (cb: (p: string) => void) => { const h = (_: Electron.IpcRendererEvent, p: string) => cb(p); ipcRenderer.on('vault:file-removed', h);  return () => ipcRenderer.removeListener('vault:file-removed', h) },
  onFileChanged: (cb: (p: string) => void) => { const h = (_: Electron.IpcRendererEvent, p: string) => cb(p); ipcRenderer.on('vault:file-changed', h);  return () => ipcRenderer.removeListener('vault:file-changed', h) },
  onDirAdded:    (cb: (p: string) => void) => { const h = (_: Electron.IpcRendererEvent, p: string) => cb(p); ipcRenderer.on('vault:dir-added', h);     return () => ipcRenderer.removeListener('vault:dir-added', h) },
  onDirRemoved:  (cb: (p: string) => void) => { const h = (_: Electron.IpcRendererEvent, p: string) => cb(p); ipcRenderer.on('vault:dir-removed', h);   return () => ipcRenderer.removeListener('vault:dir-removed', h) }
}

contextBridge.exposeInMainWorld('api', api)
export type ElectronAPI = typeof api
