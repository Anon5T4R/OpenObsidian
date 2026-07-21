import { describe, it, expect } from 'vitest'
import { parseWikiTarget, resolveNote, noteExists } from './linkResolver'
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
