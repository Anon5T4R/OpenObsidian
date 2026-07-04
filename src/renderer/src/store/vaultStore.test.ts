import { describe, it, expect } from 'vitest'
import { flattenTree, extractLinks, extractTags, type TreeNode } from './vaultStore'

describe('flattenTree', () => {
  const tree: TreeNode[] = [
    { name: 'root', path: '/v/root.md', type: 'file' },
    {
      name: 'folder',
      path: '/v/folder',
      type: 'directory',
      children: [
        { name: 'nested', path: '/v/folder/nested.md', type: 'file' },
        { name: 'doc.pdf', path: '/v/folder/doc.pdf', type: 'file' },
        { name: 'book.epub', path: '/v/folder/book.epub', type: 'file' },
        { name: 'report.docx', path: '/v/folder/report.docx', type: 'file' },
      ],
    },
  ]

  it('includes only markdown files, excluding pdf/docx/epub', () => {
    const files = flattenTree(tree)
    expect(files.map((f) => f.path)).toEqual(['/v/root.md', '/v/folder/nested.md'])
  })

  it('builds a relativePath from the folder prefix', () => {
    const nested = flattenTree(tree).find((f) => f.name === 'nested')
    expect(nested?.relativePath).toBe('folder/nested.md')
  })
})

describe('extractLinks', () => {
  it('extracts wikilink targets and strips aliases', () => {
    expect(extractLinks('see [[Alpha]] and [[Beta|B]]')).toEqual(['Alpha', 'Beta'])
  })
})

describe('extractTags', () => {
  it('extracts unique lowercased tags', () => {
    expect(extractTags('#Work some #work and #Idea')).toEqual(['work', 'idea'])
  })
})
