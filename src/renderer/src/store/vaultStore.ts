import { create } from 'zustand'
import type { FileInfo, TreeNode } from '../../../preload/index'
import { parseFrontmatter, frontmatterTags, FrontmatterData } from '../utils/frontmatter'

export type NoteFile = FileInfo
export type { TreeNode }

// \p{L} with the u flag so accents and any alphabet count: a Brazilian user
// writes #pré-natal and #nutrição, which the old ASCII class truncated to #pr.
// The `/` enables nested tags (#sistema/cardio), as in Obsidian.
const TAG_RE    = /#([\p{L}\p{N}_/-]+)/gu
const LINK_RE   = /\[\[([^\]]+)\]\]/g
const PINNED_KEY = 'oo-pinned'

// Tags inside code blocks are examples, not metadata (this is also where
// mermaid's `#ff0000` colours live)
const MD_CODE_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g
const NUMERIC_RE = /^\d+$/
// A bare colour literal outside code: hex-only, right length, and has a digit —
// so real words like #cafe or #beefed are not thrown away with it
const HEX_COLOUR_RE = /^(?=.*\d)[0-9a-fA-F]{3}$|^(?=.*\d)[0-9a-fA-F]{6}$|^(?=.*\d)[0-9a-fA-F]{8}$/

interface VaultState {
  vaultPath: string | null
  tree: TreeNode[]
  files: NoteFile[]
  activeFile: NoteFile | null
  activeContent: string
  isDirty: boolean
  backlinks: Record<string, string[]>
  tags: Record<string, string[]>         // tag → [fileName, ...]
  frontmatter: Record<string, FrontmatterData>  // filePath → parsed YAML fields
  srsStats: { total: number; due: number; suspended: number; fresh: number } | null
  searchOpen: boolean
  pinnedPaths: string[]
  tagFilter: string | null

  setVault: (path: string, tree: TreeNode[]) => void
  setTree: (tree: TreeNode[]) => void
  setActiveFile: (file: NoteFile | null) => void
  setActiveContent: (content: string, dirty?: boolean) => void
  setDirty: (dirty: boolean) => void
  buildBacklinks: (files: NoteFile[], contents: Record<string, string>) => void
  removeFile: (filePath: string) => void
  toggleSearch: () => void
  setSearchOpen: (open: boolean) => void
  togglePin: (filePath: string) => void
  setTagFilter: (tag: string | null) => void
  setSrsStats: (stats: VaultState['srsStats']) => void
}

export function extractLinks(content: string): string[] {
  const links: string[] = []
  let m: RegExpExecArray | null
  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(content)) !== null) links.push(m[1].split('|')[0].trim())
  return links
}

export function extractTags(content: string): string[] {
  const result: string[] = []
  const chunks = content.split(MD_CODE_RE)
  for (let i = 0; i < chunks.length; i++) {
    if (i % 2 === 1) continue // inside code
    let m: RegExpExecArray | null
    TAG_RE.lastIndex = 0
    while ((m = TAG_RE.exec(chunks[i])) !== null) {
      // Trailing separators come from prose ("veja #cardio/"), not the tag
      const tag = m[1].replace(/[/-]+$/, '').toLowerCase()
      if (!tag || NUMERIC_RE.test(tag) || HEX_COLOUR_RE.test(tag)) continue
      result.push(tag)
    }
  }
  return [...new Set(result)]
}

/** `#sistema/cardio` also counts as `#sistema`, so a parent tag finds its children. */
export function expandTagHierarchy(tags: string[]): string[] {
  const all = new Set<string>()
  for (const tag of tags) {
    const parts = tag.split('/')
    for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join('/'))
  }
  return [...all]
}

function loadPinned(): string[] {
  try { return JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]') } catch { return [] }
}

function savePinned(paths: string[]): void {
  localStorage.setItem(PINNED_KEY, JSON.stringify(paths))
}

// Binary formats show up in the tree but are never notes: they carry no
// wikilinks, tags or backlinks
const BINARY_EXTS = ['.pdf', '.docx', '.epub', '.odt']
export const isBinaryPath = (p: string) => BINARY_EXTS.some((ext) => p.toLowerCase().endsWith(ext))

export function flattenTree(nodes: TreeNode[]): NoteFile[] {
  const files: NoteFile[] = []
  function walk(node: TreeNode, prefix: string) {
    if (node.type === 'file' && !isBinaryPath(node.path)) {
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
  frontmatter: {},
  srsStats: null,
  searchOpen: false,
  pinnedPaths: loadPinned(),
  tagFilter: null,

  setVault: (path, tree) => set({ vaultPath: path, tree, files: flattenTree(tree) }),

  setTree: (tree) => set((s) => {
    // Keep the old files reference when the list is unchanged — watcher events
    // (e.g. OneDrive sync noise) would otherwise cascade re-renders/graph rebuilds
    const files = flattenTree(tree)
    const same = files.length === s.files.length &&
      files.every((f, i) => f.path === s.files[i].path && f.name === s.files[i].name)
    return { tree, files: same ? s.files : files }
  }),

  setActiveFile: (file) => set({ activeFile: file }),

  setActiveContent: (content, dirty = false) => set({ activeContent: content, isDirty: dirty }),

  setDirty: (dirty) => set({ isDirty: dirty }),

  buildBacklinks: (files, contents) => {
    const backlinks: Record<string, string[]> = {}
    const tags: Record<string, string[]> = {}
    const frontmatter: Record<string, FrontmatterData> = {}

    for (const file of files) {
      const content = contents[file.path] ?? ''

      for (const link of extractLinks(content)) {
        if (!backlinks[link]) backlinks[link] = []
        if (!backlinks[link].includes(file.name)) backlinks[link].push(file.name)
      }

      // Frontmatter rides along with this pass — the content is already read
      const data = parseFrontmatter(content).data
      if (data) frontmatter[file.path] = data

      // Tags come from both `#inline` and the frontmatter `tags:` field
      for (const tag of expandTagHierarchy([...extractTags(content), ...frontmatterTags(data)])) {
        if (!tags[tag]) tags[tag] = []
        if (!tags[tag].includes(file.name)) tags[tag].push(file.name)
      }
    }
    // Skip the update when nothing changed — auto-save calls this on every
    // write, and a fresh object identity forces graph/backlink re-renders
    const prev = get()
    if (JSON.stringify(backlinks) === JSON.stringify(prev.backlinks) &&
        JSON.stringify(tags) === JSON.stringify(prev.tags) &&
        JSON.stringify(frontmatter) === JSON.stringify(prev.frontmatter)) return
    set({ backlinks, tags, frontmatter })
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

  setTagFilter: (tag) => set({ tagFilter: tag }),

  setSrsStats: (srsStats) => set({ srsStats })
}))
