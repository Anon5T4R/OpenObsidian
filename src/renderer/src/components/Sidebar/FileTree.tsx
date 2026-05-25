import React, { useState, useCallback } from 'react'
import { useVaultStore, NoteFile, TreeNode } from '../../store/vaultStore'
import './FileTree.css'

interface FileTreeProps {
  collapsed: boolean
  onFileSelect: (file: NoteFile) => void
  onNewNote: (folderPath?: string) => void
  onNewFolder: (parentPath?: string) => void
  onToggleCollapse: () => void
  onOpenVault: () => void
}

type CtxMenu = { x: number; y: number; node: TreeNode }

function useCtxMenu() {
  const [menu, setMenu] = useState<CtxMenu | null>(null)
  const open = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, node })
  }, [])
  const close = useCallback(() => setMenu(null), [])
  return { menu, open, close }
}

interface TreeNodeRowProps {
  node: TreeNode
  depth: number
  activeFilePath: string | undefined
  collapsed: boolean
  searchQuery: string
  onFileSelect: (file: NoteFile) => void
  onNewNote: (folderPath?: string) => void
  onNewFolder: (parentPath?: string) => void
  openCtx: (e: React.MouseEvent, node: TreeNode) => void
}

function TreeNodeRow({
  node, depth, activeFilePath, collapsed, searchQuery,
  onFileSelect, onNewNote, onNewFolder, openCtx
}: TreeNodeRowProps) {
  const [expanded, setExpanded] = useState(true)

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
      >
        {collapsed ? (
          <span className="tree-icon">📄</span>
        ) : (
          <>
            <span className="tree-icon">📄</span>
            <span className="tree-label">{node.name}</span>
          </>
        )}
      </div>
    )
  }

  // Directory
  if (searchQuery) {
    const hasMatch = flatHasMatch(node, searchQuery)
    if (!hasMatch) return null
  }

  return (
    <div className="tree-dir-group">
      <div
        className="tree-item tree-dir"
        style={{ paddingLeft: collapsed ? 0 : 10 + depth * 14 }}
        onClick={() => setExpanded((e) => !e)}
        onContextMenu={(e) => openCtx(e, node)}
        title={collapsed ? node.name : undefined}
      >
        {collapsed ? (
          <span className="tree-icon">📁</span>
        ) : (
          <>
            <span className="tree-chevron">{expanded ? '▾' : '▸'}</span>
            <span className="tree-icon">📁</span>
            <span className="tree-label">{node.name}</span>
          </>
        )}
      </div>

      {expanded && !collapsed && node.children?.map((child) => (
        <TreeNodeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          activeFilePath={activeFilePath}
          collapsed={collapsed}
          searchQuery={searchQuery}
          onFileSelect={onFileSelect}
          onNewNote={onNewNote}
          onNewFolder={onNewFolder}
          openCtx={openCtx}
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
  collapsed, onFileSelect, onNewNote, onNewFolder, onToggleCollapse, onOpenVault
}: FileTreeProps) {
  const { tree, activeFile, vaultPath } = useVaultStore()
  const [search, setSearch] = useState('')
  const { menu, open: openCtx, close: closeCtx } = useCtxMenu()

  const handleDelete = async () => {
    if (!menu) return
    if (menu.node.type === 'file') {
      if (!window.confirm(`Delete note "${menu.node.name}"?`)) return
      await window.api.deleteFile(menu.node.path)
    } else {
      if (!window.confirm(`Delete folder "${menu.node.name}" and all its contents?`)) return
      await window.api.deleteFolder(menu.node.path)
    }
    const newTree = await window.api.listTree(vaultPath!)
    useVaultStore.getState().setTree(newTree)
    closeCtx()
  }

  const handleRename = async () => {
    if (!menu) return
    const newName = window.prompt('Rename to:', menu.node.name)
    if (!newName || newName === menu.node.name) { closeCtx(); return }
    if (menu.node.type === 'file') {
      await window.api.renameFile(menu.node.path, newName)
    } else {
      await window.api.renameFolder(menu.node.path, newName)
    }
    const newTree = await window.api.listTree(vaultPath!)
    useVaultStore.getState().setTree(newTree)
    closeCtx()
  }

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
              <button className="btn-icon" onClick={() => onNewFolder()} title="New Folder">📁</button>
            </>
          )}
          <button className="btn-icon collapse-btn" onClick={onToggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar (Ctrl+\\)'}>
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="file-tree-search">
          <input
            placeholder="Filter notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="file-tree-list">
        {!vaultPath ? (
          !collapsed && (
            <div className="file-tree-empty">
              <button className="open-vault-btn" onClick={onOpenVault}>Open Vault…</button>
            </div>
          )
        ) : tree.length === 0 ? (
          !collapsed && <div className="file-tree-empty">No notes yet</div>
        ) : (
          tree.map((node) => (
            <TreeNodeRow
              key={node.path}
              node={node}
              depth={0}
              activeFilePath={activeFile?.path}
              collapsed={collapsed}
              searchQuery={search}
              onFileSelect={onFileSelect}
              onNewNote={onNewNote}
              onNewFolder={onNewFolder}
              openCtx={openCtx}
            />
          ))
        )}
      </div>

      {menu && (
        <div
          className="context-menu"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.node.type === 'directory' && (
            <>
              <button onClick={() => { onNewNote(menu.node.path); closeCtx() }}>New Note Here</button>
              <button onClick={() => { onNewFolder(menu.node.path); closeCtx() }}>New Folder Here</button>
              <hr />
            </>
          )}
          <button onClick={handleRename}>Rename</button>
          <button onClick={handleDelete} className="danger">
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
