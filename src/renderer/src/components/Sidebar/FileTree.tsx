import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useVaultStore, NoteFile, TreeNode } from '../../store/vaultStore'
import { SidebarSort } from '../../hooks/useSettings'
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
}

type CtxMenu = { x: number; y: number; node: TreeNode }

function useCtxMenu() {
  const [menu, setMenu] = useState<CtxMenu | null>(null)
  const open  = useCallback((e: React.MouseEvent, node: TreeNode) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, node }) }, [])
  const close = useCallback(() => setMenu(null), [])
  return { menu, open, close }
}

function sortNodes(nodes: TreeNode[], sort: SidebarSort): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1  // dirs first
    if (sort === 'name')       return a.name.localeCompare(b.name)
    if (sort === 'name-desc')  return b.name.localeCompare(a.name)
    if (sort === 'modified')   return (b.mtime ?? 0) - (a.mtime ?? 0)
    return 0
  })
}

interface TreeNodeRowProps {
  node: TreeNode
  depth: number
  activeFilePath: string | undefined
  collapsed: boolean
  searchQuery: string
  sort: SidebarSort
  pinnedPaths: string[]
  onFileSelect: (file: NoteFile) => void
  onNewNote: (folderPath?: string) => void
  onNewFolder: (parentPath?: string) => void
  openCtx: (e: React.MouseEvent, node: TreeNode) => void
  onDropOnDir: (src: string, dest: string) => void
}

function TreeNodeRow({
  node, depth, activeFilePath, collapsed, searchQuery, sort, pinnedPaths,
  onFileSelect, onNewNote, onNewFolder, openCtx, onDropOnDir
}: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const isPinned = pinnedPaths.includes(node.path)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
  }

  if (node.type === 'file') {
    if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) return null
    const isActive = activeFilePath === node.path
    const file: NoteFile = { name: node.name, path: node.path, relativePath: node.path }
    return (
      <div
        className={`tree-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: collapsed ? 0 : 10 + depth * 14 }}
        onClick={() => onFileSelect(file)}
        onContextMenu={(e) => openCtx(e, node)}
        title={collapsed ? node.name : undefined}
        draggable
        onDragStart={handleDragStart}
      >
        {collapsed ? <span className="tree-icon">📄</span> : (
          <>
            <span className="tree-icon">📄</span>
            <span className="tree-label">{node.name}</span>
            {isPinned && <span className="tree-pin-dot" title="Pinned">📌</span>}
          </>
        )}
      </div>
    )
  }

  // Directory
  if (searchQuery && !flatHasMatch(node, searchQuery)) return null

  const sorted = sortNodes(node.children ?? [], sort)

  return (
    <div className="tree-dir-group">
      <div
        className={`tree-item tree-dir ${dragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: collapsed ? 0 : 10 + depth * 14 }}
        onClick={() => setExpanded((e) => !e)}
        onContextMenu={(e) => openCtx(e, node)}
        title={collapsed ? node.name : undefined}
        draggable
        onDragStart={handleDragStart}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); const src = e.dataTransfer.getData('text/plain'); if (src && src !== node.path) onDropOnDir(src, node.path) }}
      >
        {collapsed ? <span className="tree-icon">📁</span> : (
          <>
            <span className="tree-chevron">{expanded ? '▾' : '▸'}</span>
            <span className="tree-icon">📁</span>
            <span className="tree-label">{node.name}</span>
          </>
        )}
      </div>
      {expanded && !collapsed && sorted.map((child) => (
        <TreeNodeRow
          key={child.path} node={child} depth={depth + 1}
          activeFilePath={activeFilePath} collapsed={collapsed}
          searchQuery={searchQuery} sort={sort} pinnedPaths={pinnedPaths}
          onFileSelect={onFileSelect} onNewNote={onNewNote} onNewFolder={onNewFolder}
          openCtx={openCtx} onDropOnDir={onDropOnDir}
        />
      ))}
    </div>
  )
}

function flatHasMatch(node: TreeNode, query: string): boolean {
  if (node.type === 'file') return node.name.toLowerCase().includes(query.toLowerCase())
  return node.children?.some((c) => flatHasMatch(c, query)) ?? false
}

export default function FileTree({
  collapsed, sort, onSortChange, onFileSelect, onNewNote, onNewFolder, onToggleCollapse, onOpenVault
}: FileTreeProps) {
  const store = useVaultStore()
  const { tree, activeFile, vaultPath, pinnedPaths, tags, tagFilter, setTagFilter } = store
  const [search, setSearch] = useState('')
  const [folderInput, setFolderInput] = useState<{ parentPath?: string } | null>(null)
  const [folderName, setFolderName] = useState('')
  const folderInputRef = useRef<HTMLInputElement>(null)
  const { menu, open: openCtx, close: closeCtx } = useCtxMenu()

  useEffect(() => {
    if (folderInput) {
      setFolderName('')
      setTimeout(() => folderInputRef.current?.focus(), 30)
    }
  }, [folderInput])

  const commitFolderCreate = useCallback(() => {
    const name = folderName.trim()
    if (name) onNewFolder(folderInput?.parentPath, name)
    setFolderInput(null)
  }, [folderName, folderInput, onNewFolder])

  const refreshTree = useCallback(async () => {
    if (!vaultPath) return
    const newTree = await window.api.listTree(vaultPath)
    useVaultStore.getState().setTree(newTree)
  }, [vaultPath])

  // Returns the parent directory of a path
  const parentDir = (p: string) => p.replace(/\\/g, '/').split('/').slice(0, -1).join('/')

  const handleDropOnDir = useCallback(async (src: string, dest: string) => {
    // Don't move if already inside that directory
    if (parentDir(src) === dest.replace(/\\/g, '/')) return
    const result = await window.api.moveItem(src, dest)
    if (result.error) return   // silently ignore (e.g. same name already exists)
    await refreshTree()
  }, [refreshTree])

  const handleDropOnRoot = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    if (!vaultPath) return
    const src = e.dataTransfer.getData('text/plain')
    if (!src) return
    // Don't move if already at vault root
    if (parentDir(src) === vaultPath.replace(/\\/g, '/')) return
    await handleDropOnDir(src, vaultPath)
  }, [vaultPath, handleDropOnDir])

  const handleDelete = async () => {
    if (!menu) return
    if (menu.node.type === 'file') {
      if (!window.confirm(`Delete note "${menu.node.name}"?`)) return
      await window.api.deleteFile(menu.node.path)
    } else {
      if (!window.confirm(`Delete folder "${menu.node.name}" and all its contents?`)) return
      await window.api.deleteFolder(menu.node.path)
    }
    await refreshTree(); closeCtx()
  }

  const handleRename = async () => {
    if (!menu) return
    const newName = window.prompt('Rename to:', menu.node.name)
    if (!newName || newName === menu.node.name) { closeCtx(); return }
    menu.node.type === 'file'
      ? await window.api.renameFile(menu.node.path, newName)
      : await window.api.renameFolder(menu.node.path, newName)
    await refreshTree(); closeCtx()
  }

  const handleDuplicate = async () => {
    if (!menu || menu.node.type !== 'file') return
    const result = await window.api.duplicateFile(menu.node.path)
    if (result.error) { alert(result.error); return }
    await refreshTree(); closeCtx()
  }

  const handlePin = () => {
    if (!menu) return
    useVaultStore.getState().togglePin(menu.node.path)
    closeCtx()
  }

  const sortedTree = useMemo(() => sortNodes(tree, sort), [tree, sort])

  // Pinned notes shown at top (files only, in original order)
  const pinnedFiles = useMemo(() => {
    const all = store.files
    return pinnedPaths
      .map((p) => all.find((f) => f.path === p))
      .filter((f): f is NoteFile => !!f)
  }, [pinnedPaths, store.files])

  const tagList = useMemo(() => Object.keys(tags).sort(), [tags])

  const vaultName = vaultPath?.split(/[/\\]/).pop() ?? 'No vault'

  return (
    <div className={`file-tree ${collapsed ? 'collapsed' : ''}`} onClick={closeCtx}>
      <div className="file-tree-header">
        {!collapsed && (
          <button className="vault-name-btn" onClick={vaultPath ? undefined : onOpenVault} title={vaultPath ?? 'Click to open vault'}>
            {vaultName}
          </button>
        )}
        <div className="file-tree-actions">
          {!collapsed && vaultPath && (
            <>
              <button className="btn-icon" onClick={() => onNewNote()} title="New Note (Ctrl+N)">+</button>
              <button className="btn-icon" onClick={() => setFolderInput({})} title="New Folder">📁</button>
              <select
                className="sort-select"
                value={sort}
                onChange={(e) => onSortChange(e.target.value as SidebarSort)}
                title="Sort order"
              >
                <option value="name">A→Z</option>
                <option value="name-desc">Z→A</option>
                <option value="modified">Recent</option>
              </select>
            </>
          )}
          <button className="btn-icon collapse-btn" onClick={onToggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar (Ctrl+\\)'}>
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="file-tree-search">
          <input placeholder="Filter notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {!collapsed && folderInput !== null && (
        <div className="folder-create-input">
          <span className="tree-icon">📁</span>
          <input
            ref={folderInputRef}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitFolderCreate()
              if (e.key === 'Escape') setFolderInput(null)
            }}
            onBlur={commitFolderCreate}
            placeholder="Folder name…"
          />
        </div>
      )}

      {/* Pinned section */}
      {!collapsed && pinnedFiles.length > 0 && (
        <div className="pinned-section">
          <div className="pinned-label">📌 Pinned</div>
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

      {/* Tags filter */}
      {!collapsed && tagList.length > 0 && (
        <div className="tag-strip">
          {tagFilter && (
            <button className="tag-chip tag-chip-clear" onClick={() => setTagFilter(null)} title="Clear filter">✕</button>
          )}
          {tagList.map((tag) => (
            <button
              key={tag}
              className={`tag-chip ${tagFilter === tag ? 'active' : ''}`}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              title={`${tags[tag].length} note${tags[tag].length !== 1 ? 's' : ''}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div
        className="file-tree-list"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={handleDropOnRoot}
      >
        {!vaultPath ? (
          !collapsed && <div className="file-tree-empty"><button className="open-vault-btn" onClick={onOpenVault}>Open Vault…</button></div>
        ) : sortedTree.length === 0 ? (
          !collapsed && <div className="file-tree-empty">No notes yet</div>
        ) : (
          sortedTree
            .filter((node) => {
              if (!tagFilter) return true
              const matchedNames = tags[tagFilter] ?? []
              return flatHasMatch(node, '') || matchedNames.some((name) =>
                node.type === 'file' ? node.name === name : flatHasMatchByName(node, matchedNames)
              )
            })
            .map((node) => (
              <TreeNodeRow
                key={node.path} node={node} depth={0}
                activeFilePath={activeFile?.path} collapsed={collapsed}
                searchQuery={search} sort={sort} pinnedPaths={pinnedPaths}
                onFileSelect={onFileSelect} onNewNote={onNewNote} onNewFolder={onNewFolder}
                openCtx={openCtx} onDropOnDir={handleDropOnDir}
              />
            ))
        )}
      </div>

      {menu && (
        <div className="context-menu" style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
          {menu.node.type === 'directory' && (
            <>
              <button onClick={() => { onNewNote(menu.node.path); closeCtx() }}>📄 New Note Here</button>
              <button onClick={() => { setFolderInput({ parentPath: menu.node.path }); closeCtx() }}>📁 New Folder Here</button>
              <hr />
            </>
          )}
          <button onClick={handleRename}>✏️ Rename</button>
          {menu.node.type === 'file' && (
            <>
              <button onClick={handleDuplicate}>📋 Duplicate</button>
              <button onClick={handlePin}>
                {pinnedPaths.includes(menu.node.path) ? '📌 Unpin' : '📌 Pin to top'}
              </button>
            </>
          )}
          <hr />
          <button onClick={() => { navigator.clipboard.writeText(menu.node.path); closeCtx() }}>📎 Copy Path</button>
          <button onClick={() => { window.api.showItemInFolder(menu.node.path); closeCtx() }}>📂 Show in File Manager</button>
          <hr />
          <button onClick={handleDelete} className="danger">🗑 Delete</button>
        </div>
      )}
    </div>
  )
}

function flatHasMatchByName(node: TreeNode, names: string[]): boolean {
  if (node.type === 'file') return names.includes(node.name)
  return node.children?.some((c) => flatHasMatchByName(c, names)) ?? false
}
