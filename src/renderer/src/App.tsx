import React, { useEffect, useCallback, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { ChevronLeft, ChevronRight, Search, List, Download, MessageCircle } from 'lucide-react'
import { useVaultStore, NoteFile, isBinaryPath } from './store/vaultStore'
import { useSettings, SidebarSort } from './hooks/useSettings'
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
import HelpModal from './components/Help/HelpModal'
import TemplateModal from './components/Templates/TemplateModal'
import PdfViewer from './components/Pdf/PdfViewer'
import DocxViewer from './components/Docx/DocxViewer'
import TocPanel from './components/Toc/TocPanel'
import PreviewFind from './components/Find/PreviewFind'
import VaultDiagnosticsPanel from './components/Diagnostics/VaultDiagnosticsPanel'
import ReviewPanel, { ReviewDeck } from './components/Review/ReviewPanel'
import ReviewStatsPanel from './components/Review/ReviewStatsPanel'
import AnkiImportModal from './components/Review/AnkiImportModal'
import CalendarPopover from './components/Calendar/CalendarPopover'
import { buildAiPrompt, PromptKind } from './utils/aiPrompts'
import { parseQueryBlock, runQuery, isEmptySpec, QueryNote } from './utils/noteQuery'
import { buildMtimeMap } from './utils/mtimeMap'
import ChatPanel from './components/Chat/ChatPanel'
import PluginPanel from './components/Plugins/PluginPanel'
import { ToolbarRight } from './components/Toolbar/EditorToolbar'
import CommandPalette, { Command } from './components/CommandPalette/CommandPalette'
import type { PluginInfo, AnkiPreview } from '../../preload/index'
import { parseWikiTarget, resolveNote, noteExists, buildAliasIndex, listAliases } from './utils/linkResolver'
import { slugify } from './components/Editor/markdownTransforms'
import './styles/app.css'

// Split out of the main bundle: d3 and epub.js are only needed once you open
// the graph or an .epub, which most sessions never do
const GraphView  = lazy(() => import('./components/Graph/GraphView'))
const EpubViewer = lazy(() => import('./components/Epub/EpubViewer'))

type ViewMode = 'edit' | 'preview' | 'split'

const MIN_SIDEBAR = 40
const MAX_SIDEBAR = 520
const COLLAPSED_WIDTH = 44

const isDocumentFile = isBinaryPath

// Finds the heading of a [[Nota#Seção]] anchor. Falls back to matching the
// heading text, since addHeadingIds suffixes ids when a note repeats a heading.
function findHeading(preview: Element, id: string, text: string): HTMLElement | null {
  const byId = preview.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null
  if (byId) return byId
  const wanted = text.trim().toLowerCase()
  const headings = Array.from(preview.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
  return headings.find((h) => (h.textContent ?? '').trim().toLowerCase() === wanted) ?? null
}

/**
 * Scrolls the preview to a heading.
 * The preview renders in passes (useDeferredValue) and each pass replaces the
 * whole innerHTML — scrolling on the first sighting would be undone moments
 * later. So keep re-asserting the position until it holds still.
 */
function scrollToHeadingId(id: string, text: string, timeoutMs = 2000, settleMs = 400): void {
  const started = performance.now()
  let settledSince = 0
  let cancelled = false
  // Never fight the user for the scrollbar
  const cancel = () => { cancelled = true; detach() }
  const detach = () => {
    window.removeEventListener('wheel', cancel)
    window.removeEventListener('keydown', cancel)
    window.removeEventListener('mousedown', cancel)
  }
  window.addEventListener('wheel', cancel, { passive: true })
  window.addEventListener('keydown', cancel)
  window.addEventListener('mousedown', cancel)

  const tick = () => {
    if (cancelled) return
    const preview = document.querySelector('.markdown-preview')
    const target = preview ? findHeading(preview, id, text) : null
    const now = performance.now()

    if (target && preview) {
      const delta = target.getBoundingClientRect().top - preview.getBoundingClientRect().top
      if (Math.abs(delta) > 2) {
        preview.scrollTop += delta
        settledSince = 0
      } else if (settledSince === 0) {
        settledSince = now
      } else if (now - settledSince >= settleMs) {
        detach()
        return // held its position through the remaining render passes
      }
    }
    if (now - started < timeoutMs) requestAnimationFrame(tick)
    else detach()
  }
  requestAnimationFrame(tick)
}

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
  const [previewFindOpen,  setPreviewFindOpen]  = useState(false)
  const [previewFindToken, setPreviewFindToken] = useState(0)
  const [brokenOpen,       setBrokenOpen]       = useState(false)
  const [reviewDeck,       setReviewDeck]       = useState<ReviewDeck | null>(null)
  const [statsOpen,        setStatsOpen]        = useState(false)
  const [calendarOpen,     setCalendarOpen]     = useState(false)
  const [reviewMenuOpen,   setReviewMenuOpen]   = useState(false)
  const [ankiPreview,      setAnkiPreview]      = useState<AnkiPreview | null>(null)
  const [chatOpen,         setChatOpen]         = useState(false)
  const [chatTrigger,      setChatTrigger]      = useState<string | undefined>(undefined)
  const [plugins,          setPlugins]          = useState<PluginInfo[]>([])
  const [activePluginId,   setActivePluginId]   = useState<string | null>(null)
  const [paletteOpen,      setPaletteOpen]      = useState(false)

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

  const clearChatTrigger = useCallback(() => setChatTrigger(undefined), [])

  const refreshPlugins = useCallback(() => {
    window.api.pluginList().then(setPlugins)
  }, [])

  useEffect(() => { refreshPlugins() }, [refreshPlugins])

  // ── Reset nav on vault switch ─────────────────────────────────────────────
  const resetNav = useCallback(() => {
    navRef.current = { history: [], index: -1 }
    setNavCanBack(false)
    setNavCanForward(false)
  }, [])

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const { contentCacheRef, handleContentChange } = useAutoSave()

  const { handleOpenVault, handleReopenVault, handleBackup, lastVault } =
    useVaultOps(contentCacheRef, notify, resetNav)

  // ── Core file select (central hub — defined here so all hooks can receive it) ──
  const handleFileSelect = useCallback(async (file: NoteFile, fromNav = false) => {
    setGraphOpen(false) // opening a file always leaves graph view
    // Read live state (not the render-time snapshot) so the dirty-flush actually fires
    const s = useVaultStore.getState()
    if (s.isDirty && s.activeFile && !isDocumentFile(s.activeFile.path)) {
      await window.api.writeFile(s.activeFile.path, s.activeContent)
    }
    s.setActiveFile(file)
    if (!isDocumentFile(file.path)) {
      let content = contentCacheRef.current[file.path]
      if (content === undefined) {
        content = await window.api.readFile(file.path)
        contentCacheRef.current[file.path] = content
      }
      s.setActiveContent(content)
    } else {
      s.setActiveContent('')
    }
    if (!fromNav) {
      const { history, index } = navRef.current
      const trimmed = history.slice(0, index + 1)
      navRef.current = { history: [...trimmed, file], index: trimmed.length }
      setNavCanBack(navRef.current.index > 0)
      setNavCanForward(false)
    }
  }, [contentCacheRef])

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

  // Aliases from the frontmatter, so [[IAM]] opens the note that declares it
  const aliasIndex = useMemo(() => buildAliasIndex(store.frontmatter), [store.frontmatter])

  // Same data shaped for the [[ autocomplete
  const aliasOptions = useMemo(
    () => listAliases(store.frontmatter, store.files),
    [store.frontmatter, store.files],
  )

  // Receives the raw wikilink target: `Nota`, `Nota#Seção`, `Pasta/Nota`, `#Seção`
  const handleFileSelectByName = useCallback(async (rawTarget: string) => {
    const { target, hash } = parseWikiTarget(rawTarget)
    const fromPath = useVaultStore.getState().activeFile?.path
    if (target) {
      const file = resolveNote(store.files, target, fromPath, aliasIndex)
      if (!file) return // dead link — the preview already renders it as such
      if (file.path !== fromPath) await handleFileSelect(file)
    }
    // `#^bloco` has no counterpart in the render yet — opening the note is all we can do
    if (hash && !hash.startsWith('^')) scrollToHeadingId(slugify(hash), hash)
  }, [store.files, handleFileSelect, aliasIndex])

  const linkExists = useCallback(
    (target: string) => noteExists(store.files, target, store.activeFile?.path, aliasIndex),
    [store.files, store.activeFile?.path, aliasIndex],
  )

  // Everything a ```query block needs, derived from indexes that already exist
  const queryNotes = useMemo<QueryNote[]>(() => {
    const byName = new Map<string, string[]>()
    for (const [tag, names] of Object.entries(store.tags)) {
      for (const name of names) {
        const key = name.toLowerCase()
        const list = byName.get(key)
        if (list) list.push(tag)
        else byName.set(key, [tag])
      }
    }
    // mtime lives on the tree, not on NoteFile — without it `sort: modificado`
    // silently did nothing, which is worse than refusing the sort
    const mtimes = buildMtimeMap(store.tree)
    return store.files.map((file) => ({
      file,
      tags: byName.get(file.name.toLowerCase()) ?? [],
      frontmatter: store.frontmatter[file.path] ?? null,
      mtime: mtimes[file.path],
    }))
  }, [store.files, store.tree, store.tags, store.frontmatter])

  const runNoteQuery = useCallback((source: string) => {
    const spec = parseQueryBlock(source)
    // An empty spec would list the whole vault, which is never the intent
    if (isEmptySpec(spec)) return { names: [], unknown: spec.unknown }
    return { names: runQuery(queryNotes, spec).map((n) => n.file.name), unknown: spec.unknown }
  }, [queryNotes])

  // The content cache already holds every note of the vault (filled on open),
  // so an embed resolves synchronously — no IPC round-trip while rendering
  const resolveEmbed = useCallback((target: string): string | null => {
    const file = resolveNote(store.files, target, store.activeFile?.path, aliasIndex)
    if (!file) return null
    return contentCacheRef.current[file.path] ?? null
  }, [store.files, store.activeFile?.path, aliasIndex, contentCacheRef])

  // A rename (and the link rewrite that follows) changed files on disk behind
  // the content cache — refresh the touched entries and rebuild the indexes
  const handleFilesRewritten = useCallback(async (
    changedPaths: string[], oldPath: string, newPath: string,
  ) => {
    const cache = contentCacheRef.current
    if (oldPath !== newPath && cache[oldPath] !== undefined) {
      cache[newPath] = cache[oldPath]
      delete cache[oldPath]
    }
    for (const p of changedPaths) {
      try { cache[p] = await window.api.readFile(p) } catch { delete cache[p] }
    }
    const s = useVaultStore.getState()
    if (s.activeFile?.path === oldPath) {
      const renamed = s.files.find((f) => f.path === newPath)
      if (renamed) s.setActiveFile(renamed)
      s.setActiveContent(cache[newPath] ?? s.activeContent)
    }
    s.buildBacklinks(s.files, cache)
  }, [contentCacheRef])

  // Read through getState instead of closing over `store`: this is handed to
  // the memoized FileTree, and a new identity on every store change would make
  // the whole tree re-render for nothing
  const handleFileDeleted = useCallback((path: string) => {
    const s = useVaultStore.getState()
    if (s.activeFile?.path === path) {
      s.setActiveFile(null)
      s.setActiveContent('')
    }
    const { history, index } = navRef.current
    const newHistory = history.filter((f) => f.path !== path)
    const newIndex = Math.min(index, newHistory.length - 1)
    navRef.current = { history: newHistory, index: newIndex }
    setNavCanBack(newIndex > 0)
    setNavCanForward(newIndex < newHistory.length - 1)
  }, [])

  // ── Feature hooks ─────────────────────────────────────────────────────────
  const { handleOpenCompanionNote, handleConvertToMd, handleOpenInApp, isConverting } =
    useDocOps(contentCacheRef, handleFileSelect, notify)

  const { handleDailyNote, handleDailyNoteFor, handleNewNote, handleTemplateConfirm, handleNewFolder, templateOpen, templateFolder, setTemplateOpen } =
    useFileOps(contentCacheRef, handleFileSelect, handleOpenVault, notify)

  const { handleExportHTML, handleExportPDF, exportMenuOpen, setExportMenuOpen } =
    useExport(notify, setViewMode)

  // ── AI editor actions ─────────────────────────────────────────────────────
  const handleAiExplain = useCallback((text: string) => {
    setChatTrigger(`Explain this:\n\n${text}`)
    setChatOpen(true)
  }, [])

  const handleAiNeedModel = useCallback(() => {
    setChatOpen(true)
    notify(t('aiNeedModel'))
  }, [notify, t])

  // ── Plugin actions ────────────────────────────────────────────────────────
  const handlePluginToggle = useCallback(async (id: string, enabled: boolean) => {
    await window.api.pluginSetEnabled(id, enabled)
    refreshPlugins()
    if (!enabled && activePluginId === id) setActivePluginId(null)
  }, [activePluginId, refreshPlugins])

  const handlePluginInstallZip = useCallback(async () => {
    const r = await window.api.pluginInstallZip()
    if ('error' in r && r.error !== 'cancelled') { notify(r.error); return }
    if ('name' in r) { refreshPlugins(); notify(t('toastPluginInstalled', { name: r.name })) }
  }, [refreshPlugins, notify, t])

  const handlePluginOpenDir = useCallback(() => { window.api.pluginOpenDir() }, [])

  const handlePluginDelete = useCallback(async (id: string) => {
    await window.api.pluginDelete(id)
    if (activePluginId === id) setActivePluginId(null)
    refreshPlugins()
  }, [activePluginId, refreshPlugins])

  const handlePluginPanelToggle = useCallback((id: string) => {
    setActivePluginId((prev) => prev === id ? null : id)
  }, [])

  // ── TOC scroll ────────────────────────────────────────────────────────────
  const handleTocJump = useCallback((id: string) => {
    scrollToHeadingId(id, '')
  }, [])

  // Spaced-repetition by hand: jump somewhere you were not looking for
  const handleRandomNote = useCallback(() => {
    const pool = store.files.filter((f) => f.path !== store.activeFile?.path)
    if (pool.length === 0) return
    handleFileSelect(pool[Math.floor(Math.random() * pool.length)])
  }, [store.files, store.activeFile?.path, handleFileSelect])

  // Hands the user a prompt for whatever AI chat they already use — nothing
  // is sent anywhere from here
  const copyAiPrompt = useCallback(async (kind: PromptKind) => {
    const s = useVaultStore.getState()
    if (!s.activeFile || isDocumentFile(s.activeFile.path)) { notify(t('toastNoVault')); return }
    const prompt = buildAiPrompt(kind, s.activeContent, settings.locale)
    await navigator.clipboard.writeText(prompt)
    notify(t('toastPromptCopied'))
  }, [notify, t, settings.locale])

  // Importing had to be found inside the statistics panel, which nobody would
  // guess; it belongs in the flashcards menu with everything else
  const pickAnki = useCallback(async () => {
    const r = await window.api.srsAnkiPick()
    if (!r) return
    if ('error' in r) { notify(r.error); return }
    setAnkiPreview(r)
  }, [notify])

  const writeAnki = useCallback(async (deckName: string) => {
    const preview = ankiPreview
    setAnkiPreview(null)
    if (!preview || !store.vaultPath) return
    const r = await window.api.srsAnkiWrite(store.vaultPath, preview.source, deckName)
    if (r.error) { notify(r.error); return }
    notify(
      r.mediaCopied
        ? t('reviewImportedMedia', { count: r.count ?? 0, notes: r.notes ?? 1, media: r.mediaCopied })
        : t('reviewImported', { count: r.count ?? 0, notes: r.notes ?? 1 }),
    )
  }, [ankiPreview, store.vaultPath, notify, t])

  // One entry point for everything flashcard-related, instead of the review
  // panel being the only door and the statistics hiding in the palette
  const reviewMenu = (
    <div className="toolbar-menu" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => { setReviewMenuOpen(false); setReviewDeck({ kind: 'all' }) }}>
        <span className="toolbar-menu-icon">🃏</span>{t('cmdReview')}
        {(store.srsStats?.due ?? 0) > 0 && (
          <span className="toolbar-menu-count">{store.srsStats?.due}</span>
        )}
      </button>
      <button
        onClick={() => {
          const active = useVaultStore.getState().activeFile
          setReviewMenuOpen(false)
          if (active) setReviewDeck({ kind: 'note', path: active.relativePath })
        }}
        disabled={!store.activeFile}
      >
        <span className="toolbar-menu-icon">📄</span>{t('cmdReviewNote')}
      </button>
      <hr />
      <button onClick={() => { setReviewMenuOpen(false); setStatsOpen(true) }}>
        <span className="toolbar-menu-icon">📊</span>{t('cmdReviewStats')}
      </button>
      <button onClick={() => { setReviewMenuOpen(false); copyAiPrompt('flashcards') }}>
        <span className="toolbar-menu-icon">🤖</span>{t('cmdAiFlashcards')}
      </button>
      <hr />
      <button onClick={() => { setReviewMenuOpen(false); pickAnki() }}>
        <span className="toolbar-menu-icon">⬆</span>{t('reviewImportAnki')}
      </button>
    </div>
  )

  const calendarPopover = (
    <CalendarPopover
      onPickDate={(iso) => { setCalendarOpen(false); handleDailyNoteFor(iso) }}
      onClose={() => setCalendarOpen(false)}
    />
  )

  // Reading view has no CodeMirror, so it gets its own find bar
  const handleOpenFind = useCallback(() => {
    if (viewMode !== 'preview') { editorRef.current?.openFind(); return }
    setPreviewFindOpen(true)
    // Pressing Ctrl+F again re-focuses the bar instead of doing nothing
    setPreviewFindToken((n) => n + 1)
  }, [viewMode])

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
  }, [sidebarCollapsed, sidebarWidth, setSettings])

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
    // Coalesce bursts of watcher events (e.g. copying a folder of N files) into a single re-scan
    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    const reload = () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(async () => {
        const tree = await window.api.listTree(vp)
        useVaultStore.getState().setTree(tree)
      }, 150)
    }
    // A note changed outside the app (another editor, a sync client, a plugin)
    // must not leave a stale copy behind: search, backlinks and tags all read
    // from this cache
    let staleTimer: ReturnType<typeof setTimeout> | null = null
    const stale = new Set<string>()
    const refreshStale = () => {
      if (staleTimer) clearTimeout(staleTimer)
      staleTimer = setTimeout(async () => {
        const paths = [...stale]
        stale.clear()
        for (const p of paths) {
          // A read that fails keeps the text we already had. Dropping it would
          // remove the note from backlinks, tags and search with no sign that
          // anything happened — and on a synced folder a read failing once is
          // normal. Stale text is visibly wrong; a missing note is invisible.
          try { contentCacheRef.current[p] = await window.api.readFile(p) } catch { /* keep the old text */ }
        }
        const s = useVaultStore.getState()
        s.buildBacklinks(s.files, contentCacheRef.current)
      }, 400)
    }

    const u1 = window.api.onFileAdded((p) => {
      reload()
      if (!isDocumentFile(p)) { stale.add(p); refreshStale() }
    })
    const u2 = window.api.onFileRemoved((p) => {
      useVaultStore.getState().removeFile(p)
      delete contentCacheRef.current[p]
      reload()
    })
    const u3 = window.api.onDirAdded(reload)
    const u4 = window.api.onDirRemoved(reload)

    const u5 = window.api.onFileChanged(async (p) => {
      if (isDocumentFile(p)) return
      const s = useVaultStore.getState()
      if (s.activeFile?.path === p) {
        // The open note wins: never clobber what the user is typing
        if (s.isDirty) return
        const content = await window.api.readFile(p)
        contentCacheRef.current[p] = content
        s.setActiveContent(content)
        return
      }
      // Re-read in a batch, without dropping the entry first: between the drop
      // and the read the note existed for nothing that reads this cache
      stale.add(p)
      refreshStale()
    })
    return () => {
      u1(); u2(); u3(); u4(); u5()
      if (reloadTimer) clearTimeout(reloadTimer)
      if (staleTimer) clearTimeout(staleTimer)
    }
  }, [store.vaultPath, contentCacheRef])

  // Card counter needs a value before the first save of the session
  useEffect(() => {
    if (!store.vaultPath) return
    window.api.srsStats(store.vaultPath)
      .then(useVaultStore.getState().setSrsStats)
      .catch(() => { /* no schedule yet */ })
  }, [store.vaultPath])

  // ── Native menu events ────────────────────────────────────────────────────
  useEffect(() => {
    const u1 = window.api.onMenuOpenVault(handleOpenVault)
    const u2 = window.api.onMenuNewNote(() => handleNewNote())
    const u3 = window.api.onMenuToggleSearch(store.toggleSearch)
    const u4 = window.api.onMenuToggleSidebar(() => setSidebarCollapsed((c) => !c))
    const u5 = window.api.onMenuBackup(handleBackup)
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [handleOpenVault, handleNewNote, handleBackup, store.toggleSearch])

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
      if (ctrl && e.shiftKey && e.key === 'F') { e.preventDefault(); useVaultStore.getState().toggleSearch() }
      if (ctrl && e.key === 'n')               { e.preventDefault(); handleNewNote() }
      if (ctrl && e.key === '\\')              { e.preventDefault(); setSidebarCollapsed((c) => !c) }
      if (ctrl && e.shiftKey && e.key === 'B') { e.preventDefault(); handleBackup() }
      if (ctrl && e.key === ',')               { e.preventDefault(); setSettingsOpen(true) }
      if (ctrl && e.key === 'g')               { e.preventDefault(); setGraphOpen((o) => !o) }
      if (ctrl && e.key === 'p')               { e.preventDefault(); setPaletteOpen((o) => !o) }
      if (e.key === 'F1')                      { e.preventDefault(); setHelpOpen((o) => !o) }
      if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); setSettings({ fontSize: Math.min(settings.fontSize + 1, 26) }) }
      if (ctrl && e.key === '-')               { e.preventDefault(); setSettings({ fontSize: Math.max(settings.fontSize - 1, 10) }) }
      if (ctrl && e.key === '0')               { e.preventDefault(); setSettings({ fontSize: 14 }) }
      if (ctrl && e.key === 'f')               { e.preventDefault(); handleOpenFind() }
      if (e.altKey && !ctrl && e.key === 'ArrowLeft')  { e.preventDefault(); handleNavBack() }
      if (e.altKey && !ctrl && e.key === 'ArrowRight') { e.preventDefault(); handleNavForward() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // handleOpenFind must be here: it closes over viewMode, and a stale
    // listener would keep routing Ctrl+F to an editor the reading view has no
  }, [handleNewNote, handleBackup, settings.fontSize, handleNavBack, handleNavForward, handleOpenFind,
      setSettings])

  // ── Command palette commands ──────────────────────────────────────────────
  const paletteCommands: Command[] = useMemo(() => [
    { id: 'new-note', icon: '📝', label: t('cmdNewNote'),       run: () => handleNewNote() },
    { id: 'daily',    icon: '📅', label: t('cmdDailyNote'),     run: handleDailyNote },
    { id: 'search',   icon: '🔍', label: t('cmdSearch'),        run: () => useVaultStore.getState().setSearchOpen(true) },
    { id: 'graph',    icon: '◎',  label: t('cmdGraph'),         run: () => setGraphOpen((o) => !o) },
    { id: 'diag',     icon: '🩺', label: t('cmdDiagnostics'),   run: () => { useVaultStore.getState().setSearchOpen(false); setBrokenOpen(true) } },
    { id: 'random',   icon: '🎲', label: t('cmdRandomNote'),    run: handleRandomNote },
    { id: 'review',   icon: '🃏', label: t('cmdReview'),        run: () => { useVaultStore.getState().setSearchOpen(false); setReviewDeck({ kind: 'all' }) } },
    { id: 'reviewN',  icon: '🃏', label: t('cmdReviewNote'),    run: () => {
      const active = useVaultStore.getState().activeFile
      if (active) { useVaultStore.getState().setSearchOpen(false); setReviewDeck({ kind: 'note', path: active.relativePath }) }
    } },
    { id: 'reviewS',  icon: '📊', label: t('cmdReviewStats'),   run: () => { useVaultStore.getState().setSearchOpen(false); setStatsOpen(true) } },
    { id: 'aiCards',  icon: '🤖', label: t('cmdAiFlashcards'),  run: () => copyAiPrompt('flashcards') },
    { id: 'aiSum',    icon: '🤖', label: t('cmdAiSummary'),     run: () => copyAiPrompt('summary') },
    { id: 'aiTpl',    icon: '🤖', label: t('cmdAiTemplate'),    run: () => copyAiPrompt('template') },
    { id: 'settings', icon: '⚙',  label: t('cmdSettings'),      run: () => setSettingsOpen(true) },
    { id: 'backup',   icon: '💾', label: t('cmdBackup'),        run: handleBackup },
    { id: 'help',     icon: '?',  label: t('cmdHelp'),          run: () => setHelpOpen(true) },
    { id: 'sidebar',  icon: '▤',  label: t('cmdToggleSidebar'), run: () => setSidebarCollapsed((c) => !c) },
    // handleRandomNote closes over the file list — a stale one would keep
    // drawing from the vault as it was when the palette first rendered
  ], [t, handleNewNote, handleDailyNote, handleBackup, handleRandomNote, copyAiPrompt])

  // ── Stable callbacks for memoized children (FileTree, BacklinksPanel, GraphView) ──
  const handleSortChange      = useCallback((s: SidebarSort) => setSettings({ sidebarSort: s }), [setSettings])
  const handleToggleCollapse  = useCallback(() => setSidebarCollapsed((c) => !c), [])
  const handleGraphNodeClick  = useCallback((f: NoteFile) => handleFileSelect(f), [handleFileSelect])
  const handleGraphClose      = useCallback(() => setGraphOpen(false), [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const actualSidebarWidth = sidebarCollapsed ? COLLAPSED_WIDTH : sidebarWidth
  const noVault = !store.vaultPath
  const isPdf   = store.activeFile?.path.endsWith('.pdf')  ?? false
  const isDocx  = store.activeFile?.path.endsWith('.docx') ?? false
  const isEpub  = store.activeFile?.path.endsWith('.epub') ?? false
  const isOdt   = store.activeFile?.path.endsWith('.odt')  ?? false
  const isDoc   = isPdf || isDocx || isEpub || isOdt

  return (
    <div className="app" onClick={() => { setExportMenuOpen(false); setReviewMenuOpen(false) }}>
      {/* Sidebar */}
      <aside className="sidebar" style={{ width: actualSidebarWidth, minWidth: actualSidebarWidth }}>
        <FileTree
          collapsed={sidebarCollapsed}
          sort={settings.sidebarSort}
          onSortChange={handleSortChange}
          onFileSelect={handleFileSelect}
          onNewNote={handleNewNote}
          onNewFolder={handleNewFolder}
          onToggleCollapse={handleToggleCollapse}
          onOpenVault={handleOpenVault}
          onNotify={notify}
          onFileDeleted={handleFileDeleted}
          onFilesRewritten={handleFilesRewritten}
        />
        {!sidebarCollapsed && <BacklinksPanel onFileSelect={handleFileSelectByName} />}
      </aside>

      {!sidebarCollapsed && <div className="resize-handle-sidebar" onMouseDown={onSidebarResizeStart} />}

      {/* Main */}
      <main className="main">
        {statsOpen ? (
          <ReviewStatsPanel onClose={() => setStatsOpen(false)} />
        ) : reviewDeck ? (
          <ReviewPanel
            deck={reviewDeck}
            onFileSelect={(file) => { setReviewDeck(null); handleFileSelect(file) }}
            onClose={() => setReviewDeck(null)}
          />
        ) : brokenOpen ? (
          <VaultDiagnosticsPanel
            onFileSelect={(file) => { setBrokenOpen(false); handleFileSelect(file) }}
            onClose={() => setBrokenOpen(false)}
          />
        ) : store.searchOpen ? (
          <SearchPanel
            onFileSelect={(file) => { useVaultStore.getState().setSearchOpen(false); handleFileSelect(file) }}
            onClose={() => useVaultStore.getState().setSearchOpen(false)}
            contentsRef={contentCacheRef}
          />
        ) : noVault ? (
          <WelcomeScreen onOpenVault={handleOpenVault} onHelp={() => setHelpOpen(true)} lastVault={lastVault} onReopenVault={handleReopenVault} />
        ) : !store.activeFile ? (
          <div className="no-note-body">
            <div className="editor-toolbar">
              <div className="toolbar-left" />
              <ToolbarRight
                onDailyNote={() => setCalendarOpen((o) => !o)}
                calendarOpen={calendarOpen}
                calendar={calendarPopover}
                onReview={() => setReviewMenuOpen((o) => !o)}
                reviewOpen={reviewMenuOpen}
                reviewMenu={reviewMenu}
                cardsDue={store.srsStats?.due ?? 0}
                graphOpen={graphOpen}
                onToggleGraph={() => setGraphOpen((o) => !o)}
                plugins={plugins}
                activePluginId={activePluginId}
                onPluginPanelToggle={handlePluginPanelToggle}
                onHelp={() => setHelpOpen(true)}
                onSettings={() => setSettingsOpen(true)}
              />
            </div>
            {graphOpen
              ? <Suspense fallback={null}><GraphView onNodeClick={handleGraphNodeClick} onClose={handleGraphClose} /></Suspense>
              : <EmptyState onNewNote={() => handleNewNote()} onOpenGraph={() => setGraphOpen(true)} hasNotes={store.files.length > 0} />
            }
          </div>
        ) : (
          <div className="editor-area">
            <div className="editor-toolbar">
              <div className="toolbar-left">
                <button className="toolbar-nav-btn" onClick={handleNavBack} disabled={!navCanBack} title={t('ttBack')} aria-label={t('ttBack')}><ChevronLeft size={18} /></button>
                <button className="toolbar-nav-btn" onClick={handleNavForward} disabled={!navCanForward} title={t('ttForward')} aria-label={t('ttForward')}><ChevronRight size={18} /></button>
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
                    <button className="view-toggle-find" onClick={handleOpenFind} title={t('ttFind')} aria-label={t('ttFind')}><Search size={15} /></button>
                  </div>
                </div>
              )}

              <ToolbarRight
                onDailyNote={() => setCalendarOpen((o) => !o)}
                calendarOpen={calendarOpen}
                calendar={calendarPopover}
                onReview={() => setReviewMenuOpen((o) => !o)}
                reviewOpen={reviewMenuOpen}
                reviewMenu={reviewMenu}
                cardsDue={store.srsStats?.due ?? 0}
                graphOpen={graphOpen}
                onToggleGraph={() => setGraphOpen((o) => !o)}
                plugins={plugins}
                activePluginId={activePluginId}
                onPluginPanelToggle={handlePluginPanelToggle}
                onHelp={() => setHelpOpen(true)}
                onSettings={() => setSettingsOpen(true)}
              >
                {!isDoc && (
                  <button className={`toolbar-icon-btn ${tocOpen ? 'active' : ''}`} onClick={() => setTocOpen((o) => !o)} title={t('ttToc')} aria-label={t('ttToc')}><List size={17} /></button>
                )}
                {!isDoc && (
                  <div className="toolbar-export-wrap">
                    <button className="toolbar-icon-btn" onClick={(e) => { e.stopPropagation(); setExportMenuOpen((o) => !o) }} title={t('ttExport')} aria-label={t('ttExport')}><Download size={17} /></button>
                    {exportMenuOpen && (
                      <div className="toolbar-menu" onClick={(e) => e.stopPropagation()}>
                        <button onClick={handleExportHTML}>
                          <span className="toolbar-menu-icon">🌐</span>{t('exportHtml')}
                        </button>
                        <button onClick={handleExportPDF}>
                          <span className="toolbar-menu-icon">📄</span>{t('exportPdf')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </ToolbarRight>
            </div>

            <div className="editor-content">
              {graphOpen && (
                <Suspense fallback={null}>
                  <GraphView onNodeClick={handleGraphNodeClick} onClose={handleGraphClose} />
                </Suspense>
              )}

              {isPdf ? (
                <PdfViewer filePath={store.activeFile.path} onOpenNotes={handleOpenCompanionNote} />
              ) : isDocx ? (
                <DocxViewer
                  filePath={store.activeFile.path}
                  onOpenInApp={handleOpenInApp}
                  onConvertToMd={handleConvertToMd}
                  isConverting={isConverting}
                />
              ) : isOdt ? (
                <DocxViewer
                  filePath={store.activeFile.path}
                  format="odt"
                  onOpenInApp={handleOpenInApp}
                  onConvertToMd={handleConvertToMd}
                  isConverting={isConverting}
                />
              ) : isEpub ? (
                <Suspense fallback={null}>
                  <EpubViewer filePath={store.activeFile.path} onOpenNotes={handleOpenCompanionNote} />
                </Suspense>
              ) : (
                <>
                  <div className="editor-split-row">
                    {(viewMode === 'edit' || viewMode === 'split') && (
                      <div className="editor-pane" style={viewMode === 'split' ? { flex: splitRatio } : { flex: 1 }}>
                        <MarkdownEditor
                          ref={editorRef}
                          content={store.activeContent}
                          onChange={handleContentChange}
                          onWikiLinkClick={handleFileSelectByName}
                          vaultPath={store.vaultPath}
                          files={store.files}
                          aliases={aliasOptions}
                          theme={settings.theme}
                          onStatsChange={setEditorStats}
                          onAiExplain={handleAiExplain}
                          onAiNeedModel={handleAiNeedModel}
                        />
                      </div>
                    )}

                    {viewMode === 'split' && <div className="resize-handle-split" onMouseDown={onSplitResizeStart} />}

                    {(viewMode === 'preview' || viewMode === 'split') && (
                      <div className="editor-pane" style={viewMode === 'split' ? { flex: 1 - splitRatio } : { flex: 1 }}>
                        {previewFindOpen && (
                          <PreviewFind
                            content={store.activeContent}
                            focusToken={previewFindToken}
                            onClose={() => setPreviewFindOpen(false)}
                          />
                        )}
                        <MarkdownPreview
                          content={store.activeContent}
                          onWikiLinkClick={handleFileSelectByName}
                          onChange={handleContentChange}
                          vaultPath={store.vaultPath}
                          linkExists={linkExists}
                          resolveEmbed={resolveEmbed}
                          onTagClick={(tag) => store.setTagFilter(tag)}
                          runNoteQuery={runNoteQuery}
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

            <StatusBar
              stats={editorStats}
              onOpenFind={handleOpenFind}
              cardsDue={store.srsStats?.due ?? 0}
              onReview={() => setReviewDeck({ kind: 'all' })}
            />
          </div>
        )}
      </main>

      {settingsOpen  && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          plugins={plugins}
          onPluginToggle={handlePluginToggle}
          onPluginInstallZip={handlePluginInstallZip}
          onPluginOpenDir={handlePluginOpenDir}
          onPluginDelete={handlePluginDelete}
        />
      )}
      {helpOpen      && <HelpModal onClose={() => setHelpOpen(false)} />}
      {ankiPreview   && (
        <AnkiImportModal
          preview={ankiPreview}
          onConfirm={writeAnki}
          onCancel={() => setAnkiPreview(null)}
        />
      )}
      {templateOpen  && (
        <TemplateModal
          onConfirm={handleTemplateConfirm}
          onCancel={() => setTemplateOpen(false)}
          folderHint={templateFolder?.split(/[/\\]/).pop()}
        />
      )}
      {chatOpen && (
        <ChatPanel
          onClose={() => setChatOpen(false)}
          activeContent={store.activeFile && !isDoc ? store.activeContent : undefined}
          noteTitle={store.activeFile?.name}
          vaultFileNames={store.files.map((f) => f.name)}
          onInsertAtCursor={(text) => editorRef.current?.insertText(text)}
          triggerMessage={chatTrigger}
          onTriggerConsumed={clearChatTrigger}
        />
      )}
      {activePluginId && (() => {
        const activePlugin = plugins.find((p) => p.id === activePluginId)
        return activePlugin ? (
          <PluginPanel
            plugin={activePlugin}
            vaultPath={store.vaultPath}
            theme={settings.theme}
            onClose={() => setActivePluginId(null)}
            onNotify={notify}
          />
        ) : null
      })()}
      {paletteOpen && !noVault && (
        <CommandPalette
          files={store.files}
          commands={paletteCommands}
          onFileSelect={(file) => handleFileSelect(file)}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {notification && <div className="toast">{notification}</div>}

      {!noVault && !chatOpen && (
        <button className="chat-fab" onClick={() => setChatOpen(true)} title={t('ttChat')} aria-label={t('ttChat')}><MessageCircle size={18} /></button>
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
      <div className="btn-row" style={{ marginTop: lastVault ? 4 : 8 }}>
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
      <div className="btn-row">
        <button className="btn-primary" onClick={onNewNote}>{t('newNote')}</button>
        {hasNotes && <button className="btn-secondary" onClick={onOpenGraph}>{t('graphView')}</button>}
      </div>
    </div>
  )
}
