import { create } from 'zustand'
import type { FileInfo, TreeNode } from '../../../preload/index'

export type NoteFile = FileInfo
export type { TreeNode }

interface VaultState {
  vaultPath: string | null
  tree: TreeNode[]
  files: NoteFile[]
  activeFile: NoteFile | null
  activeContent: string
  isDirty: boolean
  backlinks: Record<string, string[]>
  searchOpen: boolean

  setVault: (path: string, tree: TreeNode[]) => void
  setTree: (tree: TreeNode[]) => void
  setActiveFile: (file: NoteFile | null) => void
  setActiveContent: (content: string) => void
  setDirty: (dirty: boolean) => void
  buildBacklinks: (files: NoteFile[], contents: Record<string, string>) => void
  removeFile: (filePath: string) => void
  toggleSearch: () => void
  setSearchOpen: (open: boolean) => void
}

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

function extractLinks(content: string): string[] {
  const links: string[] = []
  let m: RegExpExecArray | null
  WIKILINK_RE.lastIndex = 0
  while ((m = WIKILINK_RE.exec(content)) !== null) links.push(m[1].split('|')[0].trim())
  return links
}

export function flattenTree(nodes: TreeNode[]): NoteFile[] {
  const files: NoteFile[] = []
  function walk(node: TreeNode, prefix: string) {
    if (node.type === 'file') {
      files.push({ name: node.name, path: node.path, relativePath: prefix ? `${prefix}/${node.name}.md` : `${node.name}.md` })
    } else if (node.children) {
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
  searchOpen: false,

  setVault: (path, tree) => set({ vaultPath: path, tree, files: flattenTree(tree) }),

  setTree: (tree) => set({ tree, files: flattenTree(tree) }),

  setActiveFile: (file) => set({ activeFile: file }),

  setActiveContent: (content) => set({ activeContent: content, isDirty: true }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  buildBacklinks: (files, contents) => {
    const backlinks: Record<string, string[]> = {}
    for (const file of files) {
      const content = contents[file.path] ?? ''
      for (const link of extractLinks(content)) {
        if (!backlinks[link]) backlinks[link] = []
        if (!backlinks[link].includes(file.name)) backlinks[link].push(file.name)
      }
    }
    set({ backlinks })
  },

  removeFile: (filePath) => {
    const { activeFile } = get()
    set({ activeFile: activeFile?.path === filePath ? null : activeFile })
  },

  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),

  setSearchOpen: (open) => set({ searchOpen: open })
}))
