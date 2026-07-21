import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react'
import { useVaultStore, NoteFile, TreeNode } from '../../store/vaultStore'
import { SidebarSort } from '../../hooks/useSettings'
import { sortNodes } from './treeSort'
import { matchesSidebarFilter } from './sidebarFilter'
import { frontmatterAliases } from '../../utils/frontmatter'
import { useT } from '../../i18n'
import './FileTree.css'

interface FileTreeProps {
  collapsed: boolean
  sort: SidebarSort
  onSortChange: (s: SidebarSort) => void
  onFileSelect: (file: NoteFile) => void
  onNewNote: (folderPath?: string) => void
  onNewFolder: (parentPath?: string, name?: string) => void
  onToggleCollapse: () => void
  onOpenVault: () => void
  onNotify: (msg: string) => void
  onFileDeleted: (path: string) => void
  onFilesRewritten: (changedPaths: string[], oldPath: string, newPath: string) => void
}

const TAGS_COLLAPSED_KEY = 'oo-tags-collapsed'

type CtxMenu = { x: number; y: number; node: TreeNode }

function useCtxMenu() {
  const [menu, setMenu] = useState<CtxMenu | null>(null)
  const [pos,  setPos]  = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const open = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault(); e.stopPropagation()
    setPos(null)
    setMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  const close = useCallback(() => setMenu(null), [])

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return
    const { height, width } = menuRef.current.getBoundingClientRect()
    setPos({
      top:  menu.y + height > window.innerHeight ? Math.max(0, menu.y - height) : menu.y,
      left: menu.x + width  > window.innerWidth  ? Math.max(0, menu.x - width)  : menu.x,
    })
  }, [menu])

  return { menu, open, close, menuRef, pos }
}

interface TreeNodeRowProps {
  node: TreeNode
  depth: number
  activeFilePath: string | undefined
  collapsed: boolean
  matchFile: ((node: TreeNode) => boolean) | null
  sort: SidebarSort
  pinnedPaths: string[]
  renamingPath: string | null
  renameValue: string
  onFileSelect: (file: NoteFile) => void
  onNewNote: (folderPath?: string) => void
  onNewFolder: (parentPath?: string) => void
  openCtx: (e: React.MouseEvent, node: TreeNode) => void
  onDropOnDir: (src: string, dest: string) => void
  onRenameChange: (v: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
}

function TreeNodeRow({
  node, depth, activeFilePath, collapsed, matchFile, sort, pinnedPaths,
  renamingPath, renameValue,
  onFileSelect, onNewNote, onNewFolder, openCtx, onDropOnDir,
  onRenameChange, onRenameCommit, onRenameCancel
}: TreeNodeRowProps) {
  const t = useT()
  const [expanded, setExpanded] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const isPinned = pinnedPaths.includes(node.path)
  const isRenaming = renamingPath === node.path
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      }, 30)
    }
  }, [isRenaming])

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
  }

  const renameInput = (
    <input
      ref={renameInputRef}
      className="tree-rename-input"
      value={renameValue}
      onChange={(e) => onRenameChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter')  { e.stopPropagation(); onRenameCommit() }
        if (e.key === 'Escape') { e.stopPropagation(); onRenameCancel() }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )

  if (node.type === 'file') {
    if (matchFile && !matchFile(node)) return null
    const isActive = activeFilePath === node.path
    // Fallback only: binaries are not in store.files. For notes we must use the
    // indexed entry, whose relativePath is a real relative path — building one
    // here with node.path put an absolute path in that field and broke every
    // feature keyed by relativePath (flashcards, decks).
    const file: NoteFile = { name: node.name, path: node.path, relativePath: node.path }
    const selectFile = () => {
      const known = useVaultStore.getState().files.find((f) => f.path === node.path)
      onFileSelect(known ?? file)
    }
    const fileIcon = node.path.endsWith('.pdf') ? '📕'
      : node.path.endsWith('.docx') ? '📝'
      : node.path.endsWith('.epub') ? '📗' : '📄'
    return (
      <div
        className={`tree-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: collapsed ? 0 : 10 + depth * 14 }}
        onClick={() => !isRenaming && selectFile()}
        onContextMenu={(e) => openCtx(e, node)}
        title={collapsed ? node.name : undefined}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
      >
        {collapsed ? <span className="tree-icon">{fileIcon}</span> : (
          <>
            <span className="tree-icon">{fileIcon}</span>
            {isRenaming ? renameInput : <span className="tree-label">{node.name}</span>}
            {!isRenaming && isPinned && <span className="tree-pin-dot" title={t('ttPinned')}>📌</span>}
          </>
        )}
      </div>
    )
  }

  // Directory
  if (matchFile && !flatHasMatch(node, matchFile)) return null
  const sorted = sortNodes(node.children ?? [], sort)

  return (
    <div
      className="tree-dir-group"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); const src = e.dataTransfer.getData('text/plain'); if (src && src !== node.path && !node.path.startsWith(src + '\\') && !node.path.startsWith(src + '/')) onDropOnDir(src, node.path) }}
    >
      <div
        className={`tree-item tree-dir ${dragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: collapsed ? 0 : 10 + depth * 14 }}
        onClick={() => !isRenaming && setExpanded((e) => !e)}
        onContextMenu={(e) => openCtx(e, node)}
        title={collapsed ? node.name : undefined}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
      >
        {collapsed ? <span className="tree-icon">📁</span> : (
          <>
            <span className="tree-chevron">{expanded ? '▾' : '▸'}</span>
            <span className="tree-icon">📁</span>
            {isRenaming ? renameInput : <span className="tree-label">{node.name}</span>}
          </>
        )}
      </div>
      {expanded && !collapsed && sorted.map((child) => (
        <TreeNodeRow
          key={child.path} node={child} depth={depth + 1}
          activeFilePath={activeFilePath} collapsed={collapsed}
          matchFile={matchFile} sort={sort} pinnedPaths={pinnedPaths}
          renamingPath={renamingPath} renameValue={renameValue}
          onFileSelect={onFileSelect} onNewNote={onNewNote} onNewFolder={onNewFolder}
          openCtx={openCtx} onDropOnDir={onDropOnDir}
          onRenameChange={onRenameChange} onRenameCommit={onRenameCommit} onRenameCancel={onRenameCancel}
        />
      ))}
    </div>
  )
}

// A folder stays visible while any note under it still matches
function flatHasMatch(node: TreeNode, matchFile: (n: TreeNode) => boolean): boolean {
  if (node.type === 'file') return matchFile(node)
  return node.children?.some((c) => flatHasMatch(c, matchFile)) ?? false
}

// Memo + narrow selectors: the tree must not re-render on every editor
// keystroke (activeContent changes), only when tree/selection state changes
function FileTree({
  collapsed, sort, onSortChange, onFileSelect, onNewNote, onNewFolder,
  onToggleCollapse, onOpenVault, onNotify, onFileDeleted, onFilesRewritten
}: FileTreeProps) {
  const tree        = useVaultStore((s) => s.tree)
  const files       = useVaultStore((s) => s.files)
  const activeFile  = useVaultStore((s) => s.activeFile)
  const vaultPath   = useVaultStore((s) => s.vaultPath)
  const pinnedPaths = useVaultStore((s) => s.pinnedPaths)
  const tags        = useVaultStore((s) => s.tags)
  const tagFilter   = useVaultStore((s) => s.tagFilter)
  const frontmatter = useVaultStore((s) => s.frontmatter)
  const t = useT()
  const [search, setSearch] = useState('')
  // A vault with 40 tags turns the strip into a wall; folding it is remembered
  const [tagsCollapsed, setTagsCollapsed] = useState(
    () => localStorage.getItem(TAGS_COLLAPSED_KEY) === '1',
  )

  const toggleTags = useCallback(() => {
    setTagsCollapsed((c) => {
      localStorage.setItem(TAGS_COLLAPSED_KEY, c ? '0' : '1')
      return !c
    })
  }, [])

  // ── Filter (name, tags and aliases) ────────────────────────────────────────
  // The tag index is keyed by tag → note names; invert it once per change
  const tagsByNote = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const [tag, names] of Object.entries(tags)) {
      for (const name of names) {
        const key = name.toLowerCase()
        const list = map.get(key)
        if (list) list.push(tag)
        else map.set(key, [tag])
      }
    }
    return map
  }, [tags])

  const aliasesByPath = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const [path, data] of Object.entries(frontmatter)) {
      const aliases = frontmatterAliases(data)
      if (aliases.length) map.set(path, aliases)
    }
    return map
  }, [frontmatter])

  // Most-used tags first: in a big vault the alphabetical tail is noise
  const sortedTags = useMemo(
    () => Object.entries(tags)
      .map(([tag, names]) => [tag, names.length] as [string, number])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [tags],
  )

  // One predicate for both the text box and the tag chip, applied at every
  // depth — the chip used to filter only top-level nodes
  const matchFile = useMemo(() => {
    const query = search.trim()
    if (!query && !tagFilter) return null
    const chipNames = tagFilter
      ? new Set((tags[tagFilter] ?? []).map((n) => n.toLowerCase()))
      : null
    return (node: TreeNode) => {
      if (chipNames && !chipNames.has(node.name.toLowerCase())) return false
      if (!query) return true
      return matchesSidebarFilter({
        name: node.name,
        tags: tagsByNote.get(node.name.toLowerCase()) ?? [],
        aliases: aliasesByPath.get(node.path) ?? [],
      }, query)
    }
  }, [search, tagFilter, tags, tagsByNote, aliasesByPath])

  // ── Folder creation input ──────────────────────────────────────────────────
  const [folderInput, setFolderInput] = useState<{ parentPath?: string } | null>(null)
  const [folderName, setFolderName]   = useState('')
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (folderInput) { setFolderName(''); setTimeout(() => folderInputRef.current?.focus(), 30) }
  }, [folderInput])

  const commitFolderCreate = useCallback(() => {
    const name = folderName.trim()
    if (name) onNewFolder(folderInput?.parentPath, name)
    setFolderInput(null)
  }, [folderName, folderInput, onNewFolder])

  // ── Inline rename ──────────────────────────────────────────────────────────
  type RenamingState = { path: string; type: 'file' | 'directory'; originalName: string; newName: string }
  const [renaming, setRenaming] = useState<RenamingState | null>(null)
  // Pending "this note is linked from N notes — update them?" confirmation
  type LinkConfirm = { path: string; oldName: string; newName: string; files: number; links: number }
  const [linkConfirm, setLinkConfirm] = useState<LinkConfirm | null>(null)

  // ── Inline delete confirmation ────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<TreeNode | null>(null)

  // ── Context menu ───────────────────────────────────────────────────────────
  const { menu, open: openCtx, close: closeCtx, menuRef, pos } = useCtxMenu()

  // ── Tree refresh ───────────────────────────────────────────────────────────
  const refreshTree = useCallback(async () => {
    if (!vaultPath) return
    const newTree = await window.api.listTree(vaultPath)
    useVaultStore.getState().setTree(newTree)
  }, [vaultPath])

  // Renames the file and, when asked, rewrites every [[link]] that pointed to it
  const applyRename = useCallback(async (
    oldPath: string, oldName: string, newName: string, updateLinks: boolean,
  ) => {
    const newPath = await window.api.renameFile(oldPath, newName)
    let changed: string[] = []
    if (updateLinks && vaultPath) {
      const r = await window.api.updateLinkRefs(vaultPath, oldName, newName)
      changed = r.changed
      if (r.links > 0) onNotify(t('toastLinksUpdated', { links: r.links, files: r.files }))
    }
    await refreshTree()
    onFilesRewritten(changed, oldPath, newPath)
  }, [vaultPath, refreshTree, onNotify, onFilesRewritten, t])

  const commitRename = useCallback(async () => {
    if (!renaming) return
    const name = renaming.newName.trim()
    setRenaming(null)
    if (!name || name === renaming.originalName) return

    if (renaming.type === 'directory') {
      await window.api.renameFolder(renaming.path, name)
      await refreshTree()
      return
    }
    // Only markdown notes are wikilink targets — binaries rename straight away
    if (!renaming.path.endsWith('.md') || !vaultPath) {
      await applyRename(renaming.path, renaming.originalName, name, false)
      return
    }
    const refs = await window.api.findLinkRefs(vaultPath, renaming.originalName)
    if (refs.links === 0) {
      await applyRename(renaming.path, renaming.originalName, name, false)
      return
    }
    // Links would break silently — ask before touching other notes
    setLinkConfirm({
      path: renaming.path, oldName: renaming.originalName, newName: name,
      files: refs.files, links: refs.links,
    })
  }, [renaming, vaultPath, refreshTree, applyRename])

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const parentDir = (p: string) => p.replace(/\\/g, '/').split('/').slice(0, -1).join('/')

  const handleDropOnDir = useCallback(async (src: string, dest: string) => {
    if (parentDir(src) === dest.replace(/\\/g, '/')) return
    const result = await window.api.moveItem(src, dest)
    if (result.error) { onNotify(result.error); return }
    await refreshTree()
  }, [refreshTree, onNotify])

  const handleDropOnRoot = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    if (!vaultPath) return
    const src = e.dataTransfer.getData('text/plain')
    if (!src) return
    if (parentDir(src) === vaultPath.replace(/\\/g, '/')) return
    await handleDropOnDir(src, vaultPath)
  }, [vaultPath, handleDropOnDir])

  // ── Delete confirmation (inline — avoids window.confirm focus issues) ────
  const handleDeleteConfirm = useCallback(async () => {
    const node = confirmDelete
    if (!node) return
    setConfirmDelete(null)
    if (node.type === 'file') await window.api.deleteFile(node.path)
    else await window.api.deleteFolder(node.path)
    onFileDeleted(node.path)
    await refreshTree()
    closeCtx()
  }, [confirmDelete, onFileDeleted, refreshTree, closeCtx])

  // ── Context menu actions ───────────────────────────────────────────────────
  const handleRenameStart = () => {
    if (!menu) return
    setRenaming({ path: menu.node.path, type: menu.node.type, originalName: menu.node.name, newName: menu.node.name })
    closeCtx()
  }

  const handleDelete = () => {
    if (!menu) return
    setConfirmDelete(menu.node) // show inline confirm — never uses window.confirm
  }

  const handleDuplicate = async () => {
    if (!menu || menu.node.type !== 'file') return
    const result = await window.api.duplicateFile(menu.node.path)
    if (result.error) { onNotify(result.error); closeCtx(); return }
    await refreshTree(); closeCtx()
  }

  const handlePin = () => {
    if (!menu) return
    useVaultStore.getState().togglePin(menu.node.path)
    closeCtx()
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const sortedTree  = useMemo(() => sortNodes(tree, sort), [tree, sort])
  const pinnedFiles = useMemo(() => {
    return pinnedPaths.map((p) => files.find((f) => f.path === p)).filter((f): f is NoteFile => !!f)
  }, [pinnedPaths, files])
  const vaultName = vaultPath?.split(/[/\\]/).pop() ?? t('noVaultName')

  const closeAll = useCallback(() => {
    closeCtx()
    setFolderInput(null)
    if (renaming) setRenaming(null)
    setConfirmDelete(null)
  }, [closeCtx, renaming])

  return (
    <div className={`file-tree ${collapsed ? 'collapsed' : ''}`} onClick={closeAll}>

      {/* Backdrop to close context menu / folder input when clicking outside sidebar */}
      {(menu || folderInput !== null) && (
        <div
          className="sidebar-backdrop"
          onMouseDown={(e) => { e.preventDefault(); closeAll() }}
        />
      )}

      <div className="file-tree-header">
        {!collapsed && (
          <button className="vault-name-btn" onClick={vaultPath ? undefined : onOpenVault} title={vaultPath ?? t('clickToOpenVault')}>
            {vaultName}
          </button>
        )}
        <div className="file-tree-actions">
          {!collapsed && vaultPath && (
            <>
              <button className="btn-icon" onClick={() => onNewNote()} title={t('newNoteBtn')}>+</button>
              <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setFolderInput({}) }} title={t('newFolderBtn')}>📁</button>
              <button className="btn-icon" onClick={() => useVaultStore.getState().toggleSearch()} title={t('searchNotesBtn')}>🔍</button>
              <select
                className="sort-select"
                value={sort}
                onChange={(e) => onSortChange(e.target.value as SidebarSort)}
                title={t('ttSortOrder')}
              >
                <option value="name">{t('sortAZ')}</option>
                <option value="name-desc">{t('sortZA')}</option>
                <option value="modified">{t('sortRecent')}</option>
              </select>
            </>
          )}
          <button className="btn-icon collapse-btn" onClick={onToggleCollapse} title={collapsed ? t('expandSidebar') : t('collapseSidebar')}>
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="file-tree-search">
          <input placeholder={t('filterNotes')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {!collapsed && folderInput !== null && (
        <div className="folder-create-input" onClick={(e) => e.stopPropagation()}>
          <span className="tree-icon">📁</span>
          <input
            ref={folderInputRef}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  { e.stopPropagation(); commitFolderCreate() }
              if (e.key === 'Escape') { e.stopPropagation(); setFolderInput(null) }
            }}
            placeholder={t('folderNamePlaceholder')}
          />
        </div>
      )}

      {/* Tag chips — the only place the tag index is visible */}
      {!collapsed && sortedTags.length > 0 && (
        <>
        <button className="tag-strip-head" onClick={toggleTags} title={t('tagsToggle')}>
          <span className={`tag-strip-chevron ${tagsCollapsed ? 'closed' : ''}`}>▾</span>
          {t('tagsHeader')}
          <span className="tag-strip-count">{sortedTags.length}</span>
          {tagFilter && <span className="tag-strip-active">#{tagFilter}</span>}
        </button>
        {!tagsCollapsed && (
        <div className="tag-strip">
          {tagFilter && (
            <button
              className="tag-chip tag-chip-clear"
              onClick={() => useVaultStore.getState().setTagFilter(null)}
              title={t('tagClear')}
            >✕</button>
          )}
          {sortedTags.map(([tag, count]) => (
            <button
              key={tag}
              className={`tag-chip ${tagFilter === tag ? 'active' : ''}`}
              onClick={() => useVaultStore.getState().setTagFilter(tagFilter === tag ? null : tag)}
              title={t('tagChipTip', { count })}
            >#{tag}</button>
          ))}
        </div>
        )}
        </>
      )}

      {/* Rename → update links confirmation (inline; window.confirm steals focus) */}
      {!collapsed && linkConfirm && (
        <div className="link-confirm" onClick={(e) => e.stopPropagation()}>
          <div className="link-confirm-title">{t('renameLinksTitle')}</div>
          <div className="link-confirm-msg">
            {t('renameLinksMsg', { links: linkConfirm.links, files: linkConfirm.files, old: linkConfirm.oldName })}
          </div>
          <div className="link-confirm-btns">
            <button
              className="primary"
              onClick={async () => {
                const c = linkConfirm
                setLinkConfirm(null)
                await applyRename(c.path, c.oldName, c.newName, true)
              }}
            >{t('renameLinksUpdate')}</button>
            <button
              onClick={async () => {
                const c = linkConfirm
                setLinkConfirm(null)
                await applyRename(c.path, c.oldName, c.newName, false)
              }}
            >{t('renameLinksSkip')}</button>
            <button onClick={() => setLinkConfirm(null)}>{t('ctxCancelBtn')}</button>
          </div>
        </div>
      )}

      {/* Pinned section */}
      {!collapsed && pinnedFiles.length > 0 && (
        <div className="pinned-section">
          <div className="pinned-label">{t('pinned')}</div>
          {pinnedFiles.map((f) => (
            <div
              key={f.path}
              className={`tree-item ${activeFile?.path === f.path ? 'active' : ''}`}
              style={{ paddingLeft: 10 }}
              onClick={() => onFileSelect(f)}
            >
              <span className="tree-icon">📄</span>
              <span className="tree-label">{f.name}</span>
            </div>
          ))}
        </div>
      )}



      <div
        className="file-tree-list"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={handleDropOnRoot}
      >
        {!vaultPath ? (
          !collapsed && <div className="file-tree-empty"><button className="open-vault-btn" onClick={onOpenVault}>{t('openVaultBtn')}</button></div>
        ) : sortedTree.length === 0 ? (
          !collapsed && <div className="file-tree-empty">{t('noNotes')}</div>
        ) : (
          sortedTree
            .map((node) => (
              <TreeNodeRow
                key={node.path} node={node} depth={0}
                activeFilePath={activeFile?.path} collapsed={collapsed}
                matchFile={matchFile} sort={sort} pinnedPaths={pinnedPaths}
                renamingPath={renaming?.path ?? null} renameValue={renaming?.newName ?? ''}
                onFileSelect={onFileSelect} onNewNote={onNewNote} onNewFolder={onNewFolder}
                openCtx={openCtx} onDropOnDir={handleDropOnDir}
                onRenameChange={(v) => setRenaming((r) => r ? { ...r, newName: v } : r)}
                onRenameCommit={commitRename}
                onRenameCancel={() => setRenaming(null)}
              />
            ))
        )}
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{
            top:        pos?.top  ?? menu.y,
            left:       pos?.left ?? menu.x,
            visibility: pos ? 'visible' : 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.node.type === 'directory' && (
            <>
              <button onClick={() => { onNewNote(menu.node.path); closeCtx() }}>{t('ctxNewNote')}</button>
              <button onClick={() => { setFolderInput({ parentPath: menu.node.path }); closeCtx() }}>{t('ctxNewFolder')}</button>
              <hr />
            </>
          )}
          <button onClick={handleRenameStart}>{t('ctxRename')}</button>
          {menu.node.type === 'file' && (
            <>
              <button onClick={handleDuplicate}>{t('ctxDuplicate')}</button>
              <button onClick={handlePin}>
                {pinnedPaths.includes(menu.node.path) ? t('ctxUnpin') : t('ctxPin')}
              </button>
            </>
          )}
          <hr />
          <button onClick={() => { navigator.clipboard.writeText(menu.node.path); closeCtx() }}>{t('ctxCopyPath')}</button>
          <button onClick={() => { window.api.showItemInFolder(menu.node.path); closeCtx() }}>{t('ctxShowInFiles')}</button>
          <hr />
          {confirmDelete?.path === menu.node.path ? (
            <div className="ctx-confirm">
              <div className="ctx-confirm-msg">{t('ctxDeleteConfirm', { name: menu.node.name })}</div>
              <div className="ctx-confirm-btns">
                <button onClick={handleDeleteConfirm} className="danger">{t('ctxDeleteBtn')}</button>
                <button onClick={() => setConfirmDelete(null)}>{t('ctxCancelBtn')}</button>
              </div>
            </div>
          ) : (
            <button onClick={handleDelete} className="danger">{t('ctxDelete')}</button>
          )}
        </div>
      )}
    </div>
  )
}

export default React.memo(FileTree)
