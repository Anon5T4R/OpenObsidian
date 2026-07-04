import { describe, it, expect } from 'vitest'
import { buildMtimeMap } from './mtimeMap'
import type { TreeNode } from '../store/vaultStore'

describe('buildMtimeMap', () => {
  it('maps file paths to mtimes recursively, defaulting missing mtime to 0', () => {
    const tree: TreeNode[] = [
      { name: 'a', path: '/v/a.md', type: 'file', mtime: 111 },
      {
        name: 'sub',
        path: '/v/sub',
        type: 'directory',
        children: [{ name: 'b', path: '/v/sub/b.md', type: 'file' }],
      },
    ]
    expect(buildMtimeMap(tree)).toEqual({ '/v/a.md': 111, '/v/sub/b.md': 0 })
  })
})
