import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { useVaultStore, NoteFile, TreeNode, flattenTree } from './store/vaultStore'
import { useSettings } from './hooks/useSettings'
import FileTree from './components/Sidebar/FileTree'
import MarkdownEditor, { MarkdownEditorHandle, EditorStats } from './components/Editor/MarkdownEditor'
import MarkdownPreview from './components/Editor/MarkdownPreview'
import StatusBar from './components/Editor/StatusBar'
import BacklinksPanel from './components/Backlinks/BacklinksPanel'
import SearchPanel from './components/Search/SearchPanel'
import InsertMenu from './components/Insert/InsertMenu'
import SettingsModal from './components/Settings/SettingsModal'
import GraphView from './components/Graph/GraphView'
import HelpModal from './components/Help/HelpModal'
import TemplateModal from './components/Templates/TemplateModal'
import './styles/app.css'
import './components/Templates/TemplateModal.css'

type ViewMode = 'edit' | 'preview' | 'split'

const MIN_SIDEBAR = 40
const MAX_SIDEBAR = 520
const COLLAPSED_WIDTH = 44

export default function App() {
  const store = useVaultStore()
  const { settings, setSettings } = useSettings()

  // True when running on Android/iOS (Capacitor). Evaluated after mount so window.api is set.
  const isMobile = useMemo(() => typeof window.api?.listVaults === 'function', [])

  const [viewMode,         setViewMode]         = useState<ViewMode>(() => isMobile ? 'edit' : 'split')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => isMobile)
  const [vaultPickerOpen,  setVaultPickerOpen]  = useState(false)
  const [sidebarWidth,     setSidebarWidth]     = useState(settings.sidebarWidth)
  const [splitRatio,       setSplitRatio]       = useState(0.5)
  const [settingsOpen,     setSettingsOpen]     = useState(false)
  const [graphOpen,        setGraphOpen]        = useState(false)
  const [helpOpen,         setHelpOpen]         = useState(false)
  const [notification,     setNotification]     = useState<string | null>(null)
  const [lastVault,        setLastVault]        = useState<{ path: string; name: string } | null>(null)
  const [exportMenuOpen,   setExportMenuOpen]   = useState(false)
  const [editorStats,      setEditorStats]      = useState<EditorStats>({ words: 0, chars: 0, line: 1, col: 1 })
  const [templateFolder,   setTemplateFolder]   = useState<string | undefined>(undefined)
  const [templateOpen,     setTemplateOpen]     = useState(false)
  const [mobileFindOpen,   setMobileFindOpen]   = useState(false)
  const [mobileFindQuery,  setMobileFindQuery]  = useState('')

  const editorRef       = useRef<MarkdownEditorHandle>(null)
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentCacheRef = useRef<Record<string, string>>({})
  const isResizingSidebar = useRef(false)
  const isResizingSplit   = useRef(false)

  // ── Navigation history ────────────────────────────────────────────────────
  const navRef = useRef<{ history: NoteFile[]; index: number }>({ history: [], index: -1 })
  const [navCanBack,    setNavCanBack]    = useState(false)
  const [navCanForward, setNavCanForward] = useState(false)

  // Load last vault on startup
  useEffect(() => {
    window.api.getLastVault().then((vp) => {
      if (vp) setLastVault({ path: vp, name: vp.split(/[/\\]/).pop() ?? vp })
    })
  }, [])

  // ── Notification ──────────────────────────────────────────────────────────
  const notify = useCallback((msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }, [])

  // ── Sidebar resize ────────────────────────────────────────────────────────
  const onSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    if (sidebarCollapsed) return
    e.preventDefault()
    isResizingSidebar.current = true
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (ev: MouseEvent) => {
      if (!isResizingSidebar.current) return
      setSidebarWidth(Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, startW + ev.clientX - startX)))
    }
    const onUp = () => {
      isResizingSidebar.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setSettings({ sidebarWidth })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarCollapsed, sidebarWidth])

  // ── Split resize ──────────────────────────────────────────────────────────
  const onSplitResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingSplit.current = true
    const container = (e.currentTarget as HTMLElement).parentElement!
    const rect = container.getBoundingClientRect()
    const onMove = (ev: MouseEvent) => {
      if (!isResizingSplit.current) return
      setSplitRatio(Math.max(0.2, Math.min(0.8, (ev.clientX - rect.left) / rect.width)))
    }
    const onUp = () => {
      isResizingSplit.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // ── Vault open ────────────────────────────────────────────────────────────
  const openVaultPath = useCallback(async (vaultPath: string) => {
    navRef.current = { history: [], index: -1 }
    setNavCanBack(false); setNavCanForward(false)
    const tree = await window.api.listTree(vaultPath)
    store.setVault(vaultPath, tree)
    await window.api.watchVault(vaultPath)
    await window.api.setLastVault(vaultPath)
    setLastVault({ path: vaultPath, name: vaultPath.split(/[/\\]/).pop() ?? vaultPath })

    const files = flattenTree(tree)
    const mtimeMap = buildMtimeMap(tree)

    // Load cached index — only re-read files that changed since last save
    const cached = await window.api.loadIndex(vaultPath)
    const contents: Record<string, string> = {}
    const needsRead: NoteFile[] = []

    for (const file of files) {
      const entry = cached?.entries?.[file.path]
      const mtime = mtimeMap[file.path] ?? 0
      if (entry && mtime > 0 && entry.mtime === mtime) {
        contents[file.path] = entry.content   // cache hit
      } else {
        needsRead.push(file)                  // cache miss or new/changed file
      }
    }

    for (const file of needsRead) {
      try { contents[file.path] = await window.api.readFile(file.path) } catch {}
    }

    contentCacheRef.current = contents
    store.buildBacklinks(files, contents)

    // Persist updated index (fire-and-forget)
    const entries: Record<string, { mtime: number; content: string }> = {}
    for (const file of files) {
      entries[file.path] = { mtime: mtimeMap[file.path] ?? 0, content: contents[file.path] ?? '' }
    }
    window.api.saveIndex(vaultPath, { vaultPath, savedAt: Date.now(), entries })
  }, [])

  const handleOpenVault = useCallback(async () => {
    if (isMobile) {
      // On Android, openVault() returns null — show the in-app vault picker instead
      setVaultPickerOpen(true)
      return
    }
    const vaultPath = await window.api.openVault()
    if (!vaultPath) return
    await openVaultPath(vaultPath)
  }, [openVaultPath, isMobile])

  const handleReopenVault = useCallback(async () => {
    if (lastVault) await openVaultPath(lastVault.path)
  }, [lastVault, openVaultPath])

  const handleBackup = useCallback(async () => {
    if (!store.vaultPath) { notify('No vault open'); return }
    const dest = await window.api.backupVault(store.vaultPath)
    if (dest) notify(`Backup saved to: ${dest}`)
  }, [store.vaultPath])

  // ── File operations ───────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (file: NoteFile, fromNav = false) => {
    if (store.isDirty && store.activeFile) {
      await window.api.writeFile(store.activeFile.path, store.activeContent)
      store.setDirty(false)
    }
    store.setActiveFile(file)
    let content = contentCacheRef.current[file.path]
    if (content === undefined) { content = await window.api.readFile(file.path); contentCacheRef.current[file.path] = content }
    store.setActiveContent(content)
    store.setDirty(false)
    setMobileFindOpen(false); setMobileFindQuery(''); editorRef.current?.clearSearch()

    if (!fromNav) {
      const { history, index } = navRef.current
      const trimmed = history.slice(0, index + 1)
      navRef.current = { history: [...trimmed, file], index: trimmed.length }
      setNavCanBack(navRef.current.index > 0)
      setNavCanForward(false)
    }
  }, [])

  const handleNavBack = useCallback(async () => {
    const { history, index } = navRef.current
    if (index <= 0) return
    navRef.current = { history, index: index - 1 }
    setNavCanBack(index - 1 > 0)
    setNavCanForward(true)
    await handleFileSelect(history[index - 1], true)
  }, [handleFileSelect])

  const handleNavForward = useCallback(async () => {
    const { history, index } = navRef.current
    if (index >= history.length - 1) return
    navRef.current = { history, index: index + 1 }
    setNavCanBack(true)
    setNavCanForward(index + 1 < history.length - 1)
    await handleFileSelect(history[index + 1], true)
  }, [handleFileSelect])

  const handleFileSelectByName = useCallback(async (noteName: string) => {
    const file = store.files.find((f) => f.name.toLowerCase() === noteName.toLowerCase())
    if (file) await handleFileSelect(file)
  }, [store.files, handleFileSelect])

  const handleFileDeleted = useCallback((path: string) => {
    if (store.activeFile?.path === path) {
      store.setActiveFile(null)
      store.setActiveContent('')
    }
    const { history, index } = navRef.current
    const newHistory = history.filter((f) => f.path !== path)
    const newIndex = Math.min(index, newHistory.length - 1)
    navRef.current = { history: newHistory, index: newIndex }
    setNavCanBack(newIndex > 0)
    setNavCanForward(newIndex < newHistory.length - 1)
  }, [store.activeFile?.path])

  // ── New note (uses template modal) ────────────────────────────────────────
  const handleNewNote = useCallback(async (folderPath?: string) => {
    if (!store.vaultPath) { await handleOpenVault(); return }
    setTemplateFolder(folderPath)
    setTemplateOpen(true)
  }, [store.vaultPath, handleOpenVault])

  const handleTemplateConfirm = useCallback(async (name: string, content: string) => {
    setTemplateOpen(false)
    if (!store.vaultPath) return
    const result = await window.api.createFile(store.vaultPath, name, templateFolder)
    if (result.error) { alert(result.error); return }
    // Write template content
    if (result.path) await window.api.writeFile(result.path, content)
    const tree = await window.api.listTree(store.vaultPath)
    store.setTree(tree)
    const files = flattenTree(tree)
    const newFile = files.find((f) => f.path === result.path)
    if (newFile) {
      contentCacheRef.current[newFile.path] = content
      store.setActiveFile(newFile)
      store.setActiveContent(content)
      store.setDirty(false)
    }
  }, [store.vaultPath, templateFolder])

  const handleNewFolder = useCallback(async (parentPath?: string, name?: string) => {
    if (!store.vaultPath || !name?.trim()) return
    const result = await window.api.createFolder(parentPath ?? store.vaultPath, name.trim())
    if (result.error) { notify(result.error); return }
    const tree = await window.api.listTree(store.vaultPath)
    store.setTree(tree)
  }, [store.vaultPath, notify])

  const handleContentChange = useCallback((value: string) => {
    store.setActiveContent(value)
    if (store.activeFile) contentCacheRef.current[store.activeFile.path] = value
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (store.activeFile) {
        await window.api.writeFile(store.activeFile.path, value)
        store.setDirty(false)
        store.buildBacklinks(store.files, contentCacheRef.current)
        // Update index cache entry for the saved file
        if (store.vaultPath) {
          const cached = await window.api.loadIndex(store.vaultPath)
          if (cached) {
            const tree = await window.api.listTree(store.vaultPath)
            const mtimeMap = buildMtimeMap(tree)
            cached.entries[store.activeFile.path] = {
              mtime: mtimeMap[store.activeFile.path] ?? Date.now(),
              content: value
            }
            window.api.saveIndex(store.vaultPath, cached)
          }
        }
      }
    }, 800)
  }, [store.activeFile?.path, store.files])

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExportHTML = useCallback(async () => {
    if (!store.activeFile) return
    setExportMenuOpen(false)
    // Get rendered HTML from the preview pane (or convert inline)
    const { unified } = await import('unified')
    const { default: remarkParse } = await import('remark-parse')
    const { default: remarkGfm } = await import('remark-gfm')
    const { default: remarkHtml } = await import('remark-html')
    const result = await unified().use(remarkParse).use(remarkGfm).use(remarkHtml, { sanitize: false }).process(store.activeContent)
    const dest = await window.api.exportHtml(store.activeFile.name, String(result))
    if (dest) notify(`Exported to: ${dest.split(/[/\\]/).pop()}`)
  }, [store.activeFile, store.activeContent])

  const handleExportPDF = useCallback(async () => {
    if (!store.activeFile) return
    setExportMenuOpen(false)
    // Switch to preview mode for clean PDF
    setViewMode('preview')
    await new Promise((r) => setTimeout(r, 200))
    const dest = await window.api.exportPdf(store.activeFile.name)
    if (dest) notify(`PDF saved: ${dest.split(/[/\\]/).pop()}`)
  }, [store.activeFile])

  // ── Vault file watch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!store.vaultPath) return
    const vp = store.vaultPath
    const reload = async () => { const tree = await window.api.listTree(vp); store.setTree(tree) }
    const u1 = window.api.onFileAdded(reload)
    const u2 = window.api.onFileRemoved((p) => { store.removeFile(p); reload() })
    const u3 = window.api.onDirAdded(reload)
    const u4 = window.api.onDirRemoved(reload)
    const u5 = window.api.onFileChanged(async (p) => {
      if (store.activeFile?.path === p && !store.isDirty) {
        const content = await window.api.readFile(p)
        contentCacheRef.current[p] = content
        store.setActiveContent(content)
        store.setDirty(false)
      }
    })
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [store.vaultPath])

  // ── Menu events ───────────────────────────────────────────────────────────
  useEffect(() => {
    const u1 = window.api.onMenuOpenVault(handleOpenVault)
    const u2 = window.api.onMenuNewNote(() => handleNewNote())
    const u3 = window.api.onMenuToggleSearch(store.toggleSearch)
    const u4 = window.api.onMenuToggleSidebar(() => setSidebarCollapsed((c) => !c))
    const u5 = window.api.onMenuBackup(handleBackup)
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [handleOpenVault, handleNewNote, handleBackup])

  // ── Mouse back/forward buttons ────────────────────────────────────────────
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) { e.preventDefault(); handleNavBack() }
      if (e.button === 4) { e.preventDefault(); handleNavForward() }
    }
    window.addEventListener('mousedown', onMouse)
    return () => window.removeEventListener('mousedown', onMouse)
  }, [handleNavBack, handleNavForward])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.shiftKey && e.key === 'F') { e.preventDefault(); store.toggleSearch() }
      if (ctrl && e.key === 'n')   { e.preventDefault(); handleNewNote() }
      if (ctrl && e.key === '\\')  { e.preventDefault(); setSidebarCollapsed((c) => !c) }
      if (ctrl && e.shiftKey && e.key === 'B') { e.preventDefault(); handleBackup() }
      if (ctrl && e.key === ',')   { e.preventDefault(); setSettingsOpen(true) }
      if (ctrl && e.key === 'g')   { e.preventDefault(); setGraphOpen((o) => !o) }
      if (e.key === 'F1')          { e.preventDefault(); setHelpOpen((o) => !o) }
      // Zoom
      if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); setSettings({ fontSize: Math.min(settings.fontSize + 1, 26) }) }
      if (ctrl && e.key === '-')   { e.preventDefault(); setSettings({ fontSize: Math.max(settings.fontSize - 1, 10) }) }
      if (ctrl && e.key === '0')   { e.preventDefault(); setSettings({ fontSize: 14 }) }
      // Find
      if (ctrl && e.key === 'f')   { editorRef.current?.openFind() }
      // Navigation history
      if (e.altKey && !ctrl && e.key === 'ArrowLeft')  { e.preventDefault(); handleNavBack() }
      if (e.altKey && !ctrl && e.key === 'ArrowRight') { e.preventDefault(); handleNavForward() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleNewNote, handleBackup, settings.fontSize, handleNavBack, handleNavForward])

  const actualSidebarWidth = sidebarCollapsed ? COLLAPSED_WIDTH : sidebarWidth
  const noVault = !store.vaultPath

  return (
    <div className="app" onClick={() => setExportMenuOpen(false)}>
      {/* Sidebar */}
      <aside className="sidebar" style={{ width: actualSidebarWidth, minWidth: actualSidebarWidth }}>
        <FileTree
          collapsed={sidebarCollapsed}
          sort={settings.sidebarSort}
          onSortChange={(s) => setSettings({ sidebarSort: s })}
          onFileSelect={handleFileSelect}
          onNewNote={handleNewNote}
          onNewFolder={handleNewFolder}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onOpenVault={handleOpenVault}
          onNotify={notify}
          onFileDeleted={handleFileDeleted}
          onOpenSearch={store.toggleSearch}
        />
        {!sidebarCollapsed && <BacklinksPanel onFileSelect={handleFileSelectByName} />}
      </aside>

      {!sidebarCollapsed && <div className="resize-handle-sidebar" onMouseDown={onSidebarResizeStart} />}

      {/* Main */}
      <main className="main">
        {store.searchOpen ? (
          <SearchPanel onFileSelect={(file) => { store.setSearchOpen(false); handleFileSelect(file) }} onClose={() => store.setSearchOpen(false)} />
        ) : noVault ? (
          <WelcomeScreen onOpenVault={handleOpenVault} onHelp={() => setHelpOpen(true)} lastVault={lastVault} onReopenVault={handleReopenVault} />
        ) : !store.activeFile ? (
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {graphOpen
              ? <GraphView onNodeClick={(f) => { handleFileSelect(f); setGraphOpen(false) }} onClose={() => setGraphOpen(false)} />
              : <EmptyState onNewNote={() => handleNewNote()} onOpenGraph={() => setGraphOpen(true)} hasNotes={store.files.length > 0} />
            }
          </div>
        ) : (
          <div className="editor-area">
            <div className={`editor-toolbar${isMobile ? ' mobile' : ''}`}>
              <div className="toolbar-left">
                <button
                  className="toolbar-nav-btn"
                  onClick={handleNavBack}
                  disabled={!navCanBack}
                  title="Back (Alt+← or mouse button 4)"
                >‹</button>
                <button
                  className="toolbar-nav-btn"
                  onClick={handleNavForward}
                  disabled={!navCanForward}
                  title="Forward (Alt+→ or mouse button 5)"
                >›</button>
                <span className="note-title">
                  {store.activeFile.name}
                  {store.isDirty && <span className="dirty-dot" title="Unsaved changes" />}
                </span>
              </div>

              <div className="toolbar-centre">
                <InsertMenu onInsert={(text, offset) => editorRef.current?.insertText(text, offset)} files={store.files} />
                <div className="view-toggle">
                  {(['edit', 'split', 'preview'] as ViewMode[]).map((m) => (
                    <button key={m} className={viewMode === m ? 'active' : ''} onClick={() => setViewMode(m)}>
                      {m === 'edit' ? 'Edit' : m === 'split' ? 'Split' : 'Preview'}
                    </button>
                  ))}
                  <span className="view-toggle-sep" />
                  <button
                    className={`view-toggle-find${mobileFindOpen ? ' active' : ''}`}
                    onClick={() => {
                      if (isMobile) {
                        if (mobileFindOpen) {
                          setMobileFindOpen(false); setMobileFindQuery(''); editorRef.current?.clearSearch()
                        } else {
                          setMobileFindOpen(true)
                        }
                      } else {
                        editorRef.current?.openFind()
                      }
                    }}
                    title="Find in note (Ctrl+F)"
                  >
                    🔍
                  </button>
                </div>
              </div>

              <div className="toolbar-right">
                <div style={{ position: 'relative' }}>
                  <button
                    className="toolbar-icon-btn"
                    onClick={(e) => { e.stopPropagation(); setExportMenuOpen((o) => !o) }}
                    title="Export note"
                  >
                    ↓
                  </button>
                  {exportMenuOpen && (
                    <div className="export-dropdown" onClick={(e) => e.stopPropagation()}>
                      <button onClick={handleExportHTML}>Export as HTML</button>
                      <button onClick={handleExportPDF}>Export as PDF</button>
                    </div>
                  )}
                </div>
                {isMobile && <button className="toolbar-icon-btn" onClick={() => store.setSearchOpen(true)} title="Search all notes">⌕</button>}
                {!isMobile && <button className={`toolbar-icon-btn ${graphOpen ? 'active' : ''}`} onClick={() => setGraphOpen((o) => !o)} title="Graph view (Ctrl+G)">◎</button>}
                {!isMobile && <button className="toolbar-icon-btn" onClick={() => setHelpOpen(true)} title="Help (F1)">?</button>}
                <button className="toolbar-icon-btn" onClick={() => setSettingsOpen(true)} title="Settings (Ctrl+,)">⚙</button>
              </div>
            </div>

            {isMobile && mobileFindOpen && (
              <MobileFindBar
                query={mobileFindQuery}
                onChange={(q) => { setMobileFindQuery(q); editorRef.current?.applySearch(q) }}
                onNext={() => editorRef.current?.findNextMatch()}
                onPrev={() => editorRef.current?.findPrevMatch()}
                onClose={() => { setMobileFindOpen(false); setMobileFindQuery(''); editorRef.current?.clearSearch() }}
              />
            )}

            <div className="editor-content" style={{ position: 'relative' }}>
              {graphOpen && <GraphView onNodeClick={(file) => { handleFileSelect(file); setGraphOpen(false) }} onClose={() => setGraphOpen(false)} />}

              {(viewMode === 'edit' || viewMode === 'split') && (
                <div className="editor-pane" style={viewMode === 'split' ? { flex: splitRatio } : { flex: 1 }}>
                  <MarkdownEditor
                    ref={editorRef}
                    content={store.activeContent}
                    onChange={handleContentChange}
                    onWikiLinkClick={handleFileSelectByName}
                    vaultPath={store.vaultPath}
                    files={store.files}
                    theme={settings.theme}
                    onStatsChange={setEditorStats}
                  />
                </div>
              )}

              {viewMode === 'split' && <div className="resize-handle-split" onMouseDown={onSplitResizeStart} />}

              {(viewMode === 'preview' || viewMode === 'split') && (
                <div className="editor-pane" style={viewMode === 'split' ? { flex: 1 - splitRatio } : { flex: 1 }}>
                  <MarkdownPreview
                    content={store.activeContent}
                    onWikiLinkClick={handleFileSelectByName}
                    onChange={handleContentChange}
                    vaultPath={store.vaultPath}
                  />
                </div>
              )}
            </div>

            <StatusBar
              stats={editorStats}
              onOpenFind={() => editorRef.current?.openFind()}
            />
          </div>
        )}
      </main>

      {settingsOpen && <SettingsModal settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />}
      {helpOpen     && <HelpModal onClose={() => setHelpOpen(false)} />}
      {templateOpen && (
        <TemplateModal
          onConfirm={handleTemplateConfirm}
          onCancel={() => setTemplateOpen(false)}
          folderHint={templateFolder?.split(/[/\\]/).pop()}
        />
      )}
      {vaultPickerOpen && (
        <VaultPickerModal
          onSelect={async (vaultPath) => { setVaultPickerOpen(false); await openVaultPath(vaultPath) }}
          onCancel={() => setVaultPickerOpen(false)}
        />
      )}
      {notification && <div className="toast">{notification}</div>}
    </div>
  )
}

// ── Mobile in-note find bar ───────────────────────────────────────────────────
function MobileFindBar({ query, onChange, onNext, onPrev, onClose }: {
  query: string; onChange: (q: string) => void
  onNext: () => void; onPrev: () => void; onClose: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50) }, [])
  return (
    <div className="mobile-find-bar">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar na nota…"
        onKeyDown={(e) => { if (e.key === 'Enter') onNext(); if (e.key === 'Escape') onClose() }}
      />
      <button onClick={onPrev}  disabled={!query} className="mfb-btn">↑</button>
      <button onClick={onNext}  disabled={!query} className="mfb-btn">↓</button>
      <button onClick={onClose} className="mfb-btn mfb-close">✕</button>
    </div>
  )
}

// ── Android vault picker modal ────────────────────────────────────────────────
function VaultPickerModal({ onSelect, onCancel }: {
  onSelect: (vaultPath: string) => void
  onCancel: () => void
}) {
  const [vaults,    setVaults]    = React.useState<import('../../../types/shared').VaultInfo[]>([])
  const [newName,   setNewName]   = React.useState('')
  const [creating,  setCreating]  = React.useState(false)
  const [loading,   setLoading]   = React.useState(true)
  const [importing, setImporting] = React.useState(false)
  const [error,     setError]     = React.useState<string | null>(null)

  const reload = React.useCallback(() => {
    setLoading(true)
    window.api.listVaults?.().then((v) => { setVaults(v ?? []); setLoading(false) })
  }, [])

  React.useEffect(() => { reload() }, [reload])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setError(null)
    const result = await window.api.createVault?.(name)
    if (result) { onSelect(result) }
    else { setError('Could not create vault. Check storage permissions.') }
  }

  const handleImportExternal = async () => {
    if (!window.api.pickExternalVault) return
    setImporting(true); setError(null)
    try {
      const result = await window.api.pickExternalVault()
      if (result) { onSelect(result.path) } else { setImporting(false) }
    } catch (e: any) { setError(e?.message ?? 'Failed to import folder'); setImporting(false) }
  }

  const hasExternalPicker = !!window.api.pickExternalVault

  return (
    <div className="tpl-overlay" onClick={onCancel}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-header">
          <span className="tpl-title">Open Vault</span>
          <button className="tpl-close" onClick={onCancel}>✕</button>
        </div>
        <div style={{ padding: '14px 16px' }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
          ) : (
            <>
              {vaults.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, marginTop: 0 }}>Vaults</p>
                  {vaults.map((v) => (
                    <button
                      key={v.path} className="btn-secondary"
                      style={{ display: 'block', width: '100%', marginBottom: 6, textAlign: 'left' }}
                      onClick={() => onSelect(v.path)}
                    >
                      {v.type === 'external' ? '🔗' : '⬡'} {v.displayName}
                    </button>
                  ))}
                </div>
              )}
              {creating ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>New vault name (app storage)</p>
                  <input
                    autoFocus className="tpl-name-input" value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
                    placeholder="My Notes"
                  />
                  {error && <p style={{ color: 'var(--danger, #e53e3e)', fontSize: 12, margin: 0 }}>{error}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" onClick={handleCreate} disabled={!newName.trim()}>Create</button>
                    <button className="btn-secondary" onClick={() => { setCreating(false); setError(null) }}>Back</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn-primary" style={{ width: '100%' }} onClick={() => setCreating(true)}>+ New Vault</button>
                  {hasExternalPicker && (
                    <button className="btn-secondary" style={{ width: '100%' }} onClick={handleImportExternal} disabled={importing}>
                      {importing ? 'Opening…' : '📁 Import Synced Folder'}
                    </button>
                  )}
                  {error && <p style={{ color: 'var(--danger, #e53e3e)', fontSize: 12, margin: 0 }}>{error}</p>}
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                    "Import Synced Folder" lets you pick any folder synced by Syncthing, Google Drive, etc.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function WelcomeScreen({ onOpenVault, onHelp, lastVault, onReopenVault }: {
  onOpenVault: () => void; onHelp?: () => void
  lastVault: { path: string; name: string } | null; onReopenVault: () => void
}) {
  return (
    <div className="welcome-screen">
      <div className="welcome-logo">⬡</div>
      <h1>OpenObsidian</h1>
      <p>Open source markdown knowledge base</p>
      {lastVault && (
        <div className="welcome-last-vault">
          <button className="btn-primary" onClick={onReopenVault}>Open "{lastVault.name}"</button>
          <div className="welcome-last-vault-path">{lastVault.path}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: lastVault ? 4 : 8 }}>
        <button className="btn-secondary" onClick={onOpenVault}>{lastVault ? 'Open Other Vault…' : 'Open Vault Folder'}</button>
        {onHelp && <button className="btn-secondary" onClick={onHelp} title="F1">? Help</button>}
      </div>
      <p className="welcome-hint">Ctrl+Shift+O · Ctrl+N · Ctrl+Shift+F · Ctrl+G · F1</p>
    </div>
  )
}

function EmptyState({ onNewNote, onOpenGraph, hasNotes }: { onNewNote: () => void; onOpenGraph: () => void; hasNotes: boolean }) {
  return (
    <div className="empty-state">
      <p>Select a note or create a new one</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" onClick={onNewNote}>New Note (Ctrl+N)</button>
        {hasNotes && <button className="btn-secondary" onClick={onOpenGraph}>Graph View (Ctrl+G)</button>}
      </div>
    </div>
  )
}

function buildMtimeMap(nodes: TreeNode[]): Record<string, number> {
  const map: Record<string, number> = {}
  const walk = (ns: TreeNode[]) => {
    for (const n of ns) {
      if (n.type === 'file') map[n.path] = n.mtime ?? 0
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return map
}
