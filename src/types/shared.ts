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

export type VaultInfo = {
  path: string        // vault identifier: relative name (internal) or SAF URI (external)
  displayName: string // human-readable folder name
  type: 'internal' | 'external'
}

export interface AppAPI {
  // App settings
  getLastVault(): Promise<string | null>
  setLastVault(vaultPath: string): Promise<void>

  // Vault
  openVault(): Promise<string | null>
  listVaults?(): Promise<VaultInfo[]>
  createVault?(name: string): Promise<string | null>
  pickExternalVault?(): Promise<VaultInfo | null>   // SAF folder picker (Android)
  listTree(p: string): Promise<TreeNode[]>
  listFiles(p: string): Promise<FileInfo[]>
  watchVault(p: string): Promise<boolean>
  backupVault(p: string): Promise<string | null>

  // Files
  readFile(p: string): Promise<string>
  writeFile(p: string, c: string): Promise<boolean>
  createFile(vault: string, name: string, folder?: string): Promise<{ path?: string; error?: string }>
  deleteFile(p: string): Promise<boolean>
  renameFile(old: string, n: string): Promise<string>
  duplicateFile(p: string): Promise<{ path?: string; error?: string }>

  // Folders
  createFolder(parent: string, name: string): Promise<{ path?: string; error?: string }>
  deleteFolder(p: string): Promise<boolean>
  renameFolder(old: string, n: string): Promise<string>

  // Move
  moveItem(src: string, dest: string): Promise<{ path?: string; error?: string }>

  // Images
  saveImage(vault: string, name: string, b64: string): Promise<string>

  // Export
  exportHtml(title: string, html: string): Promise<string | null>
  exportPdf(title: string): Promise<string | null>

  // Vault index cache
  loadIndex(vaultPath: string): Promise<{ vaultPath: string; savedAt: number; entries: Record<string, { mtime: number; content: string }> } | null>
  saveIndex(vaultPath: string, data: object): Promise<boolean>

  // Shell
  showItemInFolder(p: string): Promise<void>

  // Menu events
  onMenuOpenVault(cb: () => void): () => void
  onMenuNewNote(cb: () => void): () => void
  onMenuToggleSearch(cb: () => void): () => void
  onMenuToggleSidebar(cb: () => void): () => void
  onMenuBackup(cb: () => void): () => void

  // Vault watch events
  onFileAdded(cb: (p: string) => void): () => void
  onFileRemoved(cb: (p: string) => void): () => void
  onFileChanged(cb: (p: string) => void): () => void
  onDirAdded(cb: (p: string) => void): () => void
  onDirRemoved(cb: (p: string) => void): () => void
}
