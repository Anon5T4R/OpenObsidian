import React, { useEffect, useCallback, useRef, useState } from 'react'
import { useVaultStore, NoteFile, TreeNode } from './store/vaultStore'
import { useSettings } from './hooks/useSettings'
import { useAutoSave } from './hooks/useAutoSave'
import { useVaultOps } from './hooks/useVaultOps'
import { useDocOps } from './hooks/useDocOps'
import { useFileOps } from './hooks/useFileOps'
import { useExport } from './hooks/useExport'
import { useT } from './i18n'
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
import PdfViewer from './components/Pdf/PdfViewer'
import DocxViewer from './components/Docx/DocxViewer'
import TocPanel from './components/Toc/TocPanel'
import ChatPanel from './components/Chat/ChatPanel'
import './styles/app.css'

type ViewMode = 'edit' | 'preview' | 'split'

const MIN_SIDEBAR = 40
const MAX_SIDEBAR = 520
const COLLAPSED_WIDTH = 44

const isDocumentFile = (p: string) => p.endsWith('.pdf') || p.endsWith('.docx')

export default function App() {
  const store = useVaultStore()
  const { settings, setSettings } = useSettings()
  const t = useT()

  // ── UI state ───────────────────────────────────────────────────────────────
  const [viewMode,         setViewMode]         = useState<ViewMode>('split')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth,     setSidebarWidth]     = useState(settings.sidebarWidth)
  const [splitRatio,       setSplitRatio]       = useState(0.5)
  const [settingsOpen,     setSettingsOpen]     = useState(false)
  const [graphOpen,        setGraphOpen]        = useState(false)
  const [helpOpen,         setHelpOpen]         = useState(false)
  const [notification,     setNotification]     = useState<string | null>(null)
  const [editorStats,      setEditorStats]      = useState<EditorStats>({ words: 0, chars: 0, line: 1, col: 1 })
  const [tocOpen,          setTocOpen]          = useState(false)
  const [chatOpen,         setChatOpen]         = useState(false)

  const editorRef         = useRef<MarkdownEditorHandle>(null)
  const isResizingSidebar = useRef(false)
  const isResizingSplit   = useRef(false)

  // ── Navigation history (stays here — tightly coupled to handleFileSelect) ──
  const navRef = useRef<{ history: NoteFile[]; index: number }>({ history: [], index: -1 })
  const [navCanBack,    setNavCanBack]    = useState(false)
  const [navCanForward, setNavCanForward] = useState(false)

  // ── Notification ──────────────────────────────────────────────────────────
  const notify = useCallback((msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }, [])

  // ── Reset nav on vault switch ─────────────────────────────────────────────
  const resetNav = useCallback(() => {
    navRef.current = { history: [], index: -1 }
    setNavCanBack(false)
    setNavCanForward(false)
  }, [])

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const { contentCacheRef, handleContentChange } = useAutoSave()

  const { openVaultPath, handleOpenVault, handleReopenVault, handleBackup, lastVault } =
    useVaultOps(contentCacheRef, notify, resetNav)

  // ── Core file select (central hub — defined here so all hooks can receive it) ──
  const handleFileSelect = useCallback(async (file: NoteFile, fromNav = false) => {
    if (store.isDirty && store.activeFile && !isDocumentFile(store.activeFile.path)) {
      await window.api.writeFile(store.activeFile.path, store.activeContent)
      store.setDirty(false)
    }
    store.setActiveFile(file)
    if (!isDocumentFile(file.path)) {
      let content = contentCacheRef.current[file.path]
      if (content === undefined) {
        content = await window.api.readFile(file.path)
        contentCacheRef.current[file.path] = content
      }
      store.setActiveContent(content)
    } else {
      store.setActiveContent('')
    }
    store.setDirty(false)
    if (!fromNav) {
      const { history, index } = navRef.current
      const trimmed = history.slice(0, index + 1)
      navRef.current = { history: [...trimmed, file], index: trimmed.length }
      setNavCanBack(navRef.current.index > 0)
      setNavCanForward(false)
    }
  }, [])

  // ── Nav back / forward ────────────────────────────────────────────────────
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

  // ── Feature hooks ─────────────────────────────────────────────────────────
  const { handleOpenCompanionNote, handleConvertToMd, handleOpenInApp, isConverting } =
    useDocOps(contentCacheRef, handleFileSelect, notify)

  const { handleDailyNote, handleNewNote, handleTemplateConfirm, handleNewFolder, templateOpen, templateFolder, setTemplateOpen } =
    useFileOps(contentCacheRef, handleFileSelect, handleOpenVault, notify)

  const { handleExportHTML, handleExportPDF, exportMenuOpen, setExportMenuOpen } =
    useExport(notify, setViewMode)

  // ── TOC scroll ────────────────────────────────────────────────────────────
  const handleTocJump = useCallback((id: string) => {
    const preview = document.querySelector('.markdown-preview')
    if (!preview) return
    const target = preview.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  // ── Vault file watcher ────────────────────────────────────────────────────
  useEffect(() => {
    if (!store.vaultPath) return
    const vp = store.vaultPath
    const reload = async () => { const tree = await window.api.listTree(vp); store.setTree(tree) }
    const u1 = window.api.onFileAdded(reload)
    const u2 = window.api.onFileRemoved((p) => { store.removeFile(p); reload() })
    const u3 = window.api.onDirAdded(reload)
    const u4 = window.api.onDirRemoved(reload)
    const u5 = window.api.onFileChanged(async (p) => {
      if (store.activeFile?.path === p && !store.isDirty && !isDocumentFile(p)) {
        const content = await window.api.readFile(p)
        contentCacheRef.current[p] = content
        store.setActiveContent(content)
        store.setDirty(false)
      }
    })
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [store.vaultPath])

  // ── Native menu events ────────────────────────────────────────────────────
  useEffect(() => {
    const u1 = window.api.onMenuOpenVault(handleOpenVault)
    const u2 = window.api.onMenuNewNote(() => handleNewNote())
    const u3 = window.api.onMenuToggleSearch(store.toggleSearch)
    const u4 = window.api.onMenuToggleSidebar(() => setSidebarCollapsed((c) => !c))
    const u5 = window.api.onMenuBackup(handleBackup)
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [handleOpenVault, handleNewNote, handleBackup])

  // ── Mouse back / forward buttons ──────────────────────────────────────────
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
      if (ctrl && e.key === 'n')               { e.preventDefault(); handleNewNote() }
      if (ctrl && e.key === '\\')              { e.preventDefault(); setSidebarCollapsed((c) => !c) }
      if (ctrl && e.shiftKey && e.key === 'B') { e.preventDefault(); handleBackup() }
      if (ctrl && e.key === ',')               { e.preventDefault(); setSettingsOpen(true) }
      if (ctrl && e.key === 'g')               { e.preventDefault(); setGraphOpen((o) => !o) }
      if (e.key === 'F1')                      { e.preventDefault(); setHelpOpen((o) => !o) }
      if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); setSettings({ fontSize: Math.min(settings.fontSize + 1, 26) }) }
      if (ctrl && e.key === '-')               { e.preventDefault(); setSettings({ fontSize: Math.max(settings.fontSize - 1, 10) }) }
      if (ctrl && e.key === '0')               { e.preventDefault(); setSettings({ fontSize: 14 }) }
      if (ctrl && e.key === 'f')               { editorRef.current?.openFind() }
      if (e.altKey && !ctrl && e.key === 'ArrowLeft')  { e.preventDefault(); handleNavBack() }
      if (e.altKey && !ctrl && e.key === 'ArrowRight') { e.preventDefault(); handleNavForward() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleNewNote, handleBackup, settings.fontSize, handleNavBack, handleNavForward])

  // ── Derived ───────────────────────────────────────────────────────────────
  const actualSidebarWidth = sidebarCollapsed ? COLLAPSED_WIDTH : sidebarWidth
  const noVault = !store.vaultPath
  const isPdf   = store.activeFile?.path.endsWith('.pdf')  ?? false
  const isDocx  = store.activeFile?.path.endsWith('.docx') ?? false
  const isDoc   = isPdf || isDocx

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
            <div className="editor-toolbar">
              <div className="toolbar-left">
                <button className="toolbar-nav-btn" onClick={handleNavBack} disabled={!navCanBack} title={t('ttBack')}>‹</button>
                <button className="toolbar-nav-btn" onClick={handleNavForward} disabled={!navCanForward} title={t('ttForward')}>›</button>
                <span className="note-title">
                  {store.activeFile.name}
                  {store.isDirty && <span className="dirty-dot" title={t('ttUnsaved')} />}
                </span>
              </div>

              {!isDoc && (
                <div className="toolbar-centre">
                  <InsertMenu onInsert={(text, offset) => editorRef.current?.insertText(text, offset)} files={store.files} />
                  <div className="view-toggle">
                    {(['edit', 'split', 'preview'] as ViewMode[]).map((m) => (
                      <button key={m} className={viewMode === m ? 'active' : ''} onClick={() => setViewMode(m)}>
                        {m === 'edit' ? t('viewEdit') : m === 'split' ? t('viewSplit') : t('viewPreview')}
                      </button>
                    ))}
                    <span className="view-toggle-sep" />
                    <button className="view-toggle-find" onClick={() => editorRef.current?.openFind()} title={t('ttFind')}>🔍</button>
                  </div>
                </div>
              )}

              <div className="toolbar-right">
                <button className="toolbar-icon-btn" onClick={handleDailyNote} title={t('ttDailyNote')}>📅</button>
                {!isDoc && (
                  <button className={`toolbar-icon-btn ${tocOpen ? 'active' : ''}`} onClick={() => setTocOpen((o) => !o)} title={t('ttToc')}>≡</button>
                )}
                {!isDoc && (
                  <div style={{ position: 'relative' }}>
                    <button className="toolbar-icon-btn" onClick={(e) => { e.stopPropagation(); setExportMenuOpen((o) => !o) }} title={t('ttExport')}>↓</button>
                    {exportMenuOpen && (
                      <div className="export-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button onClick={handleExportHTML}>{t('exportHtml')}</button>
                        <button onClick={handleExportPDF}>{t('exportPdf')}</button>
                      </div>
                    )}
                  </div>
                )}
                <button className={`toolbar-icon-btn ${graphOpen ? 'active' : ''}`} onClick={() => setGraphOpen((o) => !o)} title={t('ttGraph')}>◎</button>
                <button className="toolbar-icon-btn" onClick={() => setHelpOpen(true)} title={t('ttHelp')}>?</button>
                <button className="toolbar-icon-btn" onClick={() => setSettingsOpen(true)} title={t('ttSettings')}>⚙</button>
              </div>
            </div>

            <div className="editor-content" style={{ position: 'relative' }}>
              {graphOpen && <GraphView onNodeClick={(file) => { handleFileSelect(file); setGraphOpen(false) }} onClose={() => setGraphOpen(false)} />}

              {isPdf ? (
                <PdfViewer filePath={store.activeFile.path} onOpenNotes={handleOpenCompanionNote} />
              ) : isDocx ? (
                <DocxViewer
                  filePath={store.activeFile.path}
                  onOpenInApp={handleOpenInApp}
                  onConvertToMd={handleConvertToMd}
                  isConverting={isConverting}
                />
              ) : (
                <>
                  <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
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

                  {tocOpen && (
                    <TocPanel content={store.activeContent} onJump={handleTocJump} onClose={() => setTocOpen(false)} />
                  )}
                </>
              )}
            </div>

            <StatusBar stats={editorStats} onOpenFind={() => editorRef.current?.openFind()} />
          </div>
        )}
      </main>

      {settingsOpen  && <SettingsModal settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />}
      {helpOpen      && <HelpModal onClose={() => setHelpOpen(false)} />}
      {templateOpen  && (
        <TemplateModal
          onConfirm={handleTemplateConfirm}
          onCancel={() => setTemplateOpen(false)}
          folderHint={templateFolder?.split(/[/\\]/).pop()}
        />
      )}
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
      {notification && <div className="toast">{notification}</div>}

      {!noVault && !chatOpen && (
        <button className="chat-fab" onClick={() => setChatOpen(true)} title={t('ttChat')}>💬</button>
      )}
    </div>
  )
}

function WelcomeScreen({ onOpenVault, onHelp, lastVault, onReopenVault }: {
  onOpenVault: () => void; onHelp?: () => void
  lastVault: { path: string; name: string } | null; onReopenVault: () => void
}) {
  const t = useT()
  return (
    <div className="welcome-screen">
      <div className="welcome-logo">⬡</div>
      <h1>OpenObsidian</h1>
      <p>{t('welcomeTagline')}</p>
      {lastVault && (
        <div className="welcome-last-vault">
          <button className="btn-primary" onClick={onReopenVault}>{t('reopenVault', { name: lastVault.name })}</button>
          <div className="welcome-last-vault-path">{lastVault.path}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: lastVault ? 4 : 8 }}>
        <button className="btn-secondary" onClick={onOpenVault}>{lastVault ? t('openOtherVault') : t('openVault')}</button>
        {onHelp && <button className="btn-secondary" onClick={onHelp} title="F1">{t('help')}</button>}
      </div>
      <p className="welcome-hint">{t('welcomeHint')}</p>
    </div>
  )
}

function EmptyState({ onNewNote, onOpenGraph, hasNotes }: { onNewNote: () => void; onOpenGraph: () => void; hasNotes: boolean }) {
  const t = useT()
  return (
    <div className="empty-state">
      <p>{t('emptyState')}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-primary" onClick={onNewNote}>{t('newNote')}</button>
        {hasNotes && <button className="btn-secondary" onClick={onOpenGraph}>{t('graphView')}</button>}
      </div>
    </div>
  )
}
