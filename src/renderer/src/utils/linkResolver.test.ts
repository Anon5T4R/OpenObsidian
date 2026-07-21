import { describe, it, expect } from 'vitest'
import {
  parseWikiTarget, resolveNote, noteExists, findUnresolvedLinks,
  buildAliasIndex, findNameCollisions, findOrphanNotes,
} from './linkResolver'
import type { NoteFile } from '../store/vaultStore'

const f = (relativePath: string): NoteFile => ({
  name: (relativePath.split('/').pop() ?? '').replace(/\.md$/, ''),
  path: `C:/vault/${relativePath}`,
  relativePath,
})

const files = [
  f('Sepse.md'),
  f('Patologias/Cirrose Hepática.md'),
  f('Clínica Médica/Cirrose Hepática.md'),
  f('Clínica Médica/Notas/Anemia.md'),
]

describe('parseWikiTarget', () => {
  it('returns the target when there is no anchor', () => {
    expect(parseWikiTarget('Sepse')).toEqual({ target: 'Sepse', hash: null })
  })

  it('splits a section anchor', () => {
    expect(parseWikiTarget('Sepse#Conduta')).toEqual({ target: 'Sepse', hash: 'Conduta' })
  })

  it('splits a block anchor', () => {
    expect(parseWikiTarget('Sepse#^abc123')).toEqual({ target: 'Sepse', hash: '^abc123' })
  })

  it('keeps the folder in the target', () => {
    expect(parseWikiTarget('Pasta/Sepse#Sec')).toEqual({ target: 'Pasta/Sepse', hash: 'Sec' })
  })

  it('handles an anchor into the current note', () => {
    expect(parseWikiTarget('#Sec')).toEqual({ target: '', hash: 'Sec' })
  })
})

describe('resolveNote', () => {
  it('resolves by name, case-insensitively', () => {
    expect(resolveNote(files, 'sepse')?.relativePath).toBe('Sepse.md')
  })

  it('resolves by folder path', () => {
    expect(resolveNote(files, 'Patologias/Cirrose Hepática')?.relativePath)
      .toBe('Patologias/Cirrose Hepática.md')
  })

  it('accepts a .md suffix in the target', () => {
    expect(resolveNote(files, 'Sepse.md')?.relativePath).toBe('Sepse.md')
  })

  it('returns null for an unknown note', () => {
    expect(resolveNote(files, 'Não Existe')).toBeNull()
  })

  it('prefers the closest note when the name is duplicated', () => {
    const from = 'C:/vault/Clínica Médica/Notas/Anemia.md'
    expect(resolveNote(files, 'Cirrose Hepática', from)?.relativePath)
      .toBe('Clínica Médica/Cirrose Hepática.md')
  })

  it('falls back to the first match without a source note', () => {
    expect(resolveNote(files, 'Cirrose Hepática')?.relativePath)
      .toBe('Patologias/Cirrose Hepática.md')
  })
})

describe('findUnresolvedLinks', () => {
  it('lists only the targets with no note behind them', () => {
    const broken = findUnresolvedLinks({ 'Sepse': ['A'], 'Fantasma': ['A', 'B'] }, files)
    expect(broken.map((b) => b.target)).toEqual(['Fantasma'])
  })

  it('carries the notes that link to it, sorted', () => {
    const [first] = findUnresolvedLinks({ 'Fantasma': ['Zeta', 'Alfa'] }, files)
    expect(first.sources).toEqual(['Alfa', 'Zeta'])
  })

  it('resolves the anchor away before deciding', () => {
    expect(findUnresolvedLinks({ 'Sepse#Conduta': ['A'] }, files)).toEqual([])
  })

  it('ignores an anchor into the note itself', () => {
    expect(findUnresolvedLinks({ '#Conduta': ['A'] }, files)).toEqual([])
  })

  it('understands a folder path', () => {
    expect(findUnresolvedLinks({ 'Patologias/Cirrose Hepática': ['A'] }, files)).toEqual([])
  })

  it('puts the most-linked broken target first', () => {
    const broken = findUnresolvedLinks({ 'Um': ['A'], 'Dois': ['A', 'B'] }, files)
    expect(broken.map((b) => b.target)).toEqual(['Dois', 'Um'])
  })
})

describe('buildAliasIndex + resolveNote', () => {
  const frontmatter = {
    'C:/vault/Sepse.md': { aliases: ['Choque Séptico', 'Sepsis'] },
    'C:/vault/Patologias/Cirrose Hepática.md': { alias: 'Cirrose' },
  }
  const aliases = buildAliasIndex(frontmatter)

  it('resolves a note by its alias', () => {
    expect(resolveNote(files, 'Choque Séptico', undefined, aliases)?.name).toBe('Sepse')
  })

  it('accepts the singular alias key', () => {
    expect(resolveNote(files, 'Cirrose', undefined, aliases)?.relativePath)
      .toBe('Patologias/Cirrose Hepática.md')
  })

  it('ignores case', () => {
    expect(resolveNote(files, 'sepsis', undefined, aliases)?.name).toBe('Sepse')
  })

  it('a real file name wins over an alias', () => {
    const withClash = buildAliasIndex({ 'C:/vault/Sepse.md': { aliases: ['Anemia'] } })
    expect(resolveNote(files, 'Anemia', undefined, withClash)?.name).toBe('Anemia')
  })

  it('still returns null for an unknown target', () => {
    expect(resolveNote(files, 'Fantasma', undefined, aliases)).toBeNull()
  })

  it('noteExists accepts an alias', () => {
    expect(noteExists(files, 'Sepsis', undefined, aliases)).toBe(true)
  })
})

describe('findNameCollisions', () => {
  it('lists names shared by more than one note', () => {
    const collisions = findNameCollisions(files)
    expect(collisions).toHaveLength(1)
    expect(collisions[0].name).toBe('Cirrose Hepática')
    expect(collisions[0].files.map((f) => f.relativePath)).toEqual([
      'Patologias/Cirrose Hepática.md',
      'Clínica Médica/Cirrose Hepática.md',
    ])
  })

  it('returns nothing when every name is unique', () => {
    expect(findNameCollisions([f('A.md'), f('B.md')])).toEqual([])
  })
})

describe('findOrphanNotes', () => {
  it('lists notes nothing links to', () => {
    const orphans = findOrphanNotes(files, { 'Sepse': ['Anemia'] })
    expect(orphans.map((o) => o.name)).not.toContain('Sepse')
    expect(orphans.map((o) => o.name)).toContain('Anemia')
  })

  it('counts a link made through the folder path', () => {
    const orphans = findOrphanNotes(files, { 'Patologias/Cirrose Hepática': ['Sepse'] })
    expect(orphans.map((o) => o.relativePath)).not.toContain('Patologias/Cirrose Hepática.md')
  })

  it('ignores a target nobody actually links', () => {
    expect(findOrphanNotes(files, { 'Sepse': [] }).map((o) => o.name)).toContain('Sepse')
  })
})

describe('noteExists', () => {
  it('is true for a target with an anchor', () => {
    expect(noteExists(files, 'Sepse#Conduta')).toBe(true)
  })

  it('is false for a missing note', () => {
    expect(noteExists(files, 'Fantasma')).toBe(false)
  })

  it('is true for an anchor into the current note', () => {
    expect(noteExists(files, '#Conduta')).toBe(true)
  })
})
