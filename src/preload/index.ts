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

// ── Spaced repetition ─────────────────────────────────────────────────────
export type SrsGrade = 'again' | 'hard' | 'good' | 'easy'

export interface SrsCard {
  file: string
  q: string
  ease: number
  interval: number
  reps: number
  due: string
  lapses: number
  suspended?: boolean
}

export interface SrsStats {
  total: number
  due: number
  suspended: number
  fresh: number
}

export interface SrsReport extends SrsStats {
  learned: number
  retention: number
  averageEase: number
  forecast: { date: string; count: number }[]
  topFiles: { file: string; count: number }[]
}

export type LlmProvider = 'local' | 'anthropic' | 'openai' | 'openai-compatible' | 'gemini'

export interface LlmSettings {
  provider:     LlmProvider
  modelPath:    string
  systemPrompt: string
  apiKey:       string
  baseUrl:      string
  modelName:    string
}

export interface ChatMessage {
  role:    'user' | 'assistant' | 'system'
  content: string
}

export interface PluginInfo {
  id:           string
  name:         string
  version:      string
  icon?:        string
  panel?:       string
  author?:      string
  description?: string
  dir:          string
  panelPath:    string | null
  enabled:      boolean
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

  // Links (rename keeps [[links]] alive)
  findLinkRefs: (vault: string, noteName: string): Promise<{ files: number; links: number; paths: string[] }> =>
    ipcRenderer.invoke('link:find-refs', vault, noteName),
  updateLinkRefs: (vault: string, oldName: string, newName: string): Promise<{ files: number; links: number; changed: string[] }> =>
    ipcRenderer.invoke('link:update-refs', vault, oldName, newName),

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
  updateIndexEntry: (vaultPath: string, filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('index:update-entry', vaultPath, filePath, content),

  // DOCX conversion
  docxToHtml:     (p: string): Promise<{ html: string; warnings: string[]; error?: string }> => ipcRenderer.invoke('docx:to-html', p),
  docxToMarkdown: (p: string): Promise<{ markdown: string; warnings: string[]; error?: string }> => ipcRenderer.invoke('docx:to-markdown', p),

  // ODT conversion
  odtToHtml:      (p: string): Promise<{ html: string; warnings: string[]; error?: string }> => ipcRenderer.invoke('odt:to-html', p),

  // Spaced repetition
  srsSync:   (vault: string, file: string, found: { id: string; q: string }[]): Promise<{ added: number; removed: number; stats: SrsStats }> =>
    ipcRenderer.invoke('srs:sync', vault, file, found),
  srsSyncAll: (vault: string, notes: { file: string; cards: { id: string; q: string }[] }[]): Promise<{ added: number; removed: number; stats: SrsStats }> =>
    ipcRenderer.invoke('srs:sync-all', vault, notes),
  srsDue:    (vault: string, files?: string[], aheadDays?: number): Promise<{ id: string; card: SrsCard }[]> =>
    ipcRenderer.invoke('srs:due', vault, files, aheadDays),
  srsById:   (vault: string, ids: string[]): Promise<{ id: string; card: SrsCard }[]> =>
    ipcRenderer.invoke('srs:by-id', vault, ids),
  srsGrade:  (vault: string, id: string, grade: SrsGrade): Promise<{ card?: SrsCard; stats?: SrsStats; error?: string }> =>
    ipcRenderer.invoke('srs:grade', vault, id, grade),
  srsSuspend:(vault: string, id: string, suspended: boolean): Promise<{ stats?: SrsStats; error?: string }> =>
    ipcRenderer.invoke('srs:suspend', vault, id, suspended),
  srsStats:  (vault: string): Promise<SrsStats> => ipcRenderer.invoke('srs:stats', vault),
  srsReport: (vault: string): Promise<SrsReport> => ipcRenderer.invoke('srs:report', vault),
  srsExportAnki: (cards: { q: string; a: string }[]): Promise<string | null> =>
    ipcRenderer.invoke('srs:export-anki', cards),
  srsImportAnki: (vault: string): Promise<{ path?: string; count?: number; notes?: number; withMedia?: number; error?: string } | null> =>
    ipcRenderer.invoke('srs:import-anki', vault),

  // Shell
  showItemInFolder: (p: string): Promise<void>     => ipcRenderer.invoke('shell:show-item', p),
  openInApp:        (p: string): Promise<string>   => ipcRenderer.invoke('shell:open-path', p),

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
  onDirRemoved:  (cb: (p: string) => void) => { const h = (_: Electron.IpcRendererEvent, p: string) => cb(p); ipcRenderer.on('vault:dir-removed', h);   return () => ipcRenderer.removeListener('vault:dir-removed', h) },

  // LLM
  llmStatus:      (): Promise<{ status: string; modelPath: string | null }> => ipcRenderer.invoke('llm:status'),
  llmGetSettings: (): Promise<LlmSettings>                                  => ipcRenderer.invoke('llm:get-settings'),
  llmSetSettings: (patch: Partial<LlmSettings>): Promise<LlmSettings>      => ipcRenderer.invoke('llm:set-settings', patch),
  llmBrowseGguf:  (): Promise<string | null>                                => ipcRenderer.invoke('llm:browse-gguf'),
  llmLoad:        (modelPath: string): Promise<void>                        => ipcRenderer.invoke('llm:load', modelPath),
  llmUnload:      (): Promise<void>                                          => ipcRenderer.invoke('llm:unload'),
  llmGenerate:    (messages: ChatMessage[]): Promise<void>                  => ipcRenderer.invoke('llm:generate', messages),
  llmCancel:      (): Promise<void>                                          => ipcRenderer.invoke('llm:cancel'),
  llmTransform:   (messages: ChatMessage[]): Promise<string>                => ipcRenderer.invoke('llm:transform', messages),

  onLlmLoadProgress: (cb: (p: number) => void)   => { const h = (_: Electron.IpcRendererEvent, p: number) => cb(p);   ipcRenderer.on('llm:load-progress', h); return () => ipcRenderer.removeListener('llm:load-progress', h) },
  onLlmChunk:        (cb: (t: string) => void)   => { const h = (_: Electron.IpcRendererEvent, t: string) => cb(t);   ipcRenderer.on('llm:chunk', h);          return () => ipcRenderer.removeListener('llm:chunk', h) },
  onLlmDone:         (cb: () => void)            => { const h = () => cb();                                            ipcRenderer.on('llm:done', h);           return () => ipcRenderer.removeListener('llm:done', h) },
  onLlmError:        (cb: (m: string) => void)   => { const h = (_: Electron.IpcRendererEvent, m: string) => cb(m);   ipcRenderer.on('llm:error', h);          return () => ipcRenderer.removeListener('llm:error', h) },

  // Plugins
  pluginList:       (): Promise<PluginInfo[]>                              => ipcRenderer.invoke('plugin:list'),
  pluginSetEnabled: (id: string, value: boolean): Promise<void>           => ipcRenderer.invoke('plugin:set-enabled', id, value),
  pluginExec:       (cmd: string, args: string[], cwd?: string, neutralLocale?: boolean): Promise<{ stdout: string; stderr: string; code: number }> =>
    ipcRenderer.invoke('plugin:exec', cmd, args, cwd, neutralLocale),
  pluginInstallZip: (): Promise<{ id: string; name: string } | { error: string }> => ipcRenderer.invoke('plugin:install-zip'),
  pluginDelete:     (id: string): Promise<void>                           => ipcRenderer.invoke('plugin:delete', id),
  pluginOpenDir:    (): Promise<string>                                    => ipcRenderer.invoke('plugin:open-dir'),
}

contextBridge.exposeInMainWorld('api', api)
export type ElectronAPI = typeof api
