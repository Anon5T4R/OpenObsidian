import { describe, it, expect } from 'vitest'
import { sortNodes } from './treeSort'
import type { TreeNode } from '../../store/vaultStore'

// A single level with two folders and two loose files, deliberately shuffled.
const level: TreeNode[] = [
  { name: 'Projects', path: '/v/Projects', type: 'directory', children: [] },
  { name: 'banana', path: '/v/banana.md', type: 'file', mtime: 100 },
  { name: 'Archive', path: '/v/Archive', type: 'directory', children: [] },
  { name: 'apple', path: '/v/apple.md', type: 'file', mtime: 300 },
]

const names = (nodes: TreeNode[]) => nodes.map((n) => n.name)

describe('sortNodes — files before folders', () => {
  it('puts loose files at the top and folders at the bottom (A→Z)', () => {
    // Files sorted A→Z first, then folders sorted A→Z.
    expect(names(sortNodes(level, 'name'))).toEqual(['apple', 'banana', 'Archive', 'Projects'])
  })

  it('keeps files-first when sorting Z→A within each group', () => {
    expect(names(sortNodes(level, 'name-desc'))).toEqual(['banana', 'apple', 'Projects', 'Archive'])
  })

  it('keeps files-first when sorting by most-recently modified', () => {
    // apple (300) before banana (100); folders (no mtime) stay grouped at the bottom.
    expect(names(sortNodes(level, 'modified'))).toEqual(['apple', 'banana', 'Projects', 'Archive'])
  })

  it('does not mutate the input array', () => {
    const before = names(level)
    sortNodes(level, 'name')
    expect(names(level)).toEqual(before)
  })
})
