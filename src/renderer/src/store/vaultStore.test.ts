import { describe, it, expect } from 'vitest'
import { flattenTree, extractLinks, extractTags, expandTagHierarchy, type TreeNode } from './vaultStore'

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

  it('keeps accented tags whole', () => {
    expect(extractTags('#pré-natal e #nutrição')).toEqual(['pré-natal', 'nutrição'])
  })

  it('keeps nested tags whole', () => {
    expect(extractTags('#sistema/cardio')).toEqual(['sistema/cardio'])
  })

  it('ignores tags inside a fenced code block', () => {
    expect(extractTags('```mermaid\nstyle A fill:#ff0000\n```\n#real')).toEqual(['real'])
  })

  it('ignores tags inside inline code', () => {
    expect(extractTags('use `#exemplo` aqui')).toEqual([])
  })

  it('ignores a bare hex colour', () => {
    expect(extractTags('cor #3b82f6 e #ff0000')).toEqual([])
  })

  it('keeps a word that happens to be hex-like but has no digit', () => {
    expect(extractTags('#cafe #beefed')).toEqual(['cafe', 'beefed'])
  })

  it('ignores a purely numeric tag', () => {
    expect(extractTags('#2025 e #ano2025')).toEqual(['ano2025'])
  })

  it('drops a trailing separator left by prose', () => {
    expect(extractTags('veja #cardio/ e #uti-')).toEqual(['cardio', 'uti'])
  })
})

describe('expandTagHierarchy', () => {
  it('adds every parent of a nested tag', () => {
    expect(expandTagHierarchy(['sistema/cardio/isquemia']))
      .toEqual(['sistema', 'sistema/cardio', 'sistema/cardio/isquemia'])
  })

  it('leaves a flat tag alone and does not duplicate', () => {
    expect(expandTagHierarchy(['uti', 'uti'])).toEqual(['uti'])
  })
})
