import { create } from 'zustand'
import type { FileInfo, TreeNode } from '../../../types/shared'

export type NoteFile = FileInfo
export type { TreeNode }

const TAG_RE    = /#([a-zA-Z0-9_-]+)/g
const LINK_RE   = /\[\[([^\]]+)\]\]/g
const PINNED_KEY = 'oo-pinned'

interface VaultState {
  vaultPath: string | null
  tree: TreeNode[]
  files: NoteFile[]
  activeFile: NoteFile | null
  activeContent: string
  isDirty: boolean
  backlinks: Record<string, string[]>
  tags: Record<string, string[]>         // tag → [fileName, ...]
  searchOpen: boolean
  pinnedPaths: string[]
  tagFilter: string | null

  setVault: (path: string, tree: TreeNode[]) => void
  setTree: (tree: TreeNode[]) => void
  setActiveFile: (file: NoteFile | null) => void
  setActiveContent: (content: string) => void
  setDirty: (dirty: boolean) => void
  buildBacklinks: (files: NoteFile[], contents: Record<string, string>) => void
  removeFile: (filePath: string) => void
  toggleSearch: () => void
  setSearchOpen: (open: boolean) => void
  togglePin: (filePath: string) => void
  setTagFilter: (tag: string | null) => void
}

function extractLinks(content: string): string[] {
  const links: string[] = []
  let m: RegExpExecArray | null
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(content)) !== null) links.push(m[1].split('|')[0].trim())
  return links
}

function extractTags(content: string): string[] {
  const result: string[] = []
  let m: RegExpExecArray | null
  TAG_RE.lastIndex = 0
  while ((m = TAG_RE.exec(content)) !== null) result.push(m[1].toLowerCase())
  return [...new Set(result)]
}

function loadPinned(): string[] {
  try { return JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]') } catch { return [] }
}

function savePinned(paths: string[]): void {
  localStorage.setItem(PINNED_KEY, JSON.stringify(paths))
}

export function flattenTree(nodes: TreeNode[]): NoteFile[] {
  const files: NoteFile[] = []
  function walk(node: TreeNode, prefix: string) {
    if (node.type === 'file' && !node.path.endsWith('.pdf') && !node.path.endsWith('.docx')) {
      files.push({ name: node.name, path: node.path, relativePath: prefix ? `${prefix}/${node.name}.md` : `${node.name}.md` })
    } else if (node.type === 'directory' && node.children) {
      const p = prefix ? `${prefix}/${node.name}` : node.name
      for (const child of node.children) walk(child, p)
    }
  }
  for (const n of nodes) walk(n, '')
  return files
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaultPath: null,
  tree: [],
  files: [],
  activeFile: null,
  activeContent: '',
  isDirty: false,
  backlinks: {},
  tags: {},
  searchOpen: false,
  pinnedPaths: loadPinned(),
  tagFilter: null,

  setVault: (path, tree) => set({ vaultPath: path, tree, files: flattenTree(tree) }),

  setTree: (tree) => set({ tree, files: flattenTree(tree) }),

  setActiveFile: (file) => set({ activeFile: file }),

  setActiveContent: (content) => set({ activeContent: content, isDirty: true }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  buildBacklinks: (files, contents) => {
    const backlinks: Record<string, string[]> = {}
    const tags: Record<string, string[]> = {}

    for (const file of files) {
      const content = contents[file.path] ?? ''

      for (const link of extractLinks(content)) {
        if (!backlinks[link]) backlinks[link] = []
        if (!backlinks[link].includes(file.name)) backlinks[link].push(file.name)
      }

      for (const tag of extractTags(content)) {
        if (!tags[tag]) tags[tag] = []
        if (!tags[tag].includes(file.name)) tags[tag].push(file.name)
      }
    }
    set({ backlinks, tags })
  },

  removeFile: (filePath) => {
    const { activeFile } = get()
    set({ activeFile: activeFile?.path === filePath ? null : activeFile })
  },

  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
  setSearchOpen: (open) => set({ searchOpen: open }),

  togglePin: (filePath) => {
    const { pinnedPaths } = get()
    const next = pinnedPaths.includes(filePath)
      ? pinnedPaths.filter((p) => p !== filePath)
      : [...pinnedPaths, filePath]
    savePinned(next)
    set({ pinnedPaths: next })
  },

  setTagFilter: (tag) => set({ tagFilter: tag })
}))
