import { describe, it, expect } from 'vitest'
import { parseQueryBlock, runQuery, matchesQuery, isEmptySpec, QueryNote } from './noteQuery'

const note = (
  name: string,
  over: Partial<Omit<QueryNote, 'file'>> & { path?: string } = {},
): QueryNote => ({
  file: { name, path: `C:/v/${over.path ?? name + '.md'}`, relativePath: over.path ?? `${name}.md` },
  tags: over.tags ?? [],
  frontmatter: over.frontmatter ?? null,
  mtime: over.mtime,
})

const NOTES: QueryNote[] = [
  note('Sepse', { path: 'Patologias/Sepse.md', tags: ['uti', 'sistema/cardio'], frontmatter: { tipo: 'patologia', gravidade: 'alta' }, mtime: 300 }),
  note('Anemia', { path: 'Patologias/Anemia.md', tags: ['hemato'], frontmatter: { tipo: 'patologia' }, mtime: 100 }),
  note('Intubação', { path: 'Procedimentos/Intubação.md', tags: ['uti'], frontmatter: { tipo: 'procedimento' }, mtime: 200 }),
  note('Rascunho'),
]

describe('parseQueryBlock', () => {
  it('reads tags, paths and limit', () => {
    const spec = parseQueryBlock('tag: uti\npath: Patologias\nlimit: 5')
    expect(spec).toMatchObject({ tags: ['uti'], paths: ['patologias'], limit: 5 })
  })

  it('accepts several values on one line', () => {
    expect(parseQueryBlock('tag: uti, cardio').tags).toEqual(['uti', 'cardio'])
  })

  it('strips a leading # from a tag', () => {
    expect(parseQueryBlock('tag: #uti').tags).toEqual(['uti'])
  })

  it('treats an unknown key as a frontmatter field', () => {
    expect(parseQueryBlock('tipo: patologia').fields).toEqual({ tipo: ['patologia'] })
  })

  it('reads sort with direction', () => {
    expect(parseQueryBlock('sort: modificado desc')).toMatchObject({ sort: 'modificado', desc: true })
  })

  it('accepts the Portuguese keys', () => {
    const spec = parseQueryBlock('pasta: Patologias\nordenar: titulo\nlimite: 2')
    expect(spec).toMatchObject({ paths: ['patologias'], sort: 'titulo', limit: 2 })
  })

  it('ignores comments and blank lines', () => {
    expect(parseQueryBlock('# comentário\n\ntag: uti').tags).toEqual(['uti'])
  })

  it('collects what it could not understand instead of guessing', () => {
    const spec = parseQueryBlock('tag: uti\nlinha solta\nlimit: zero')
    expect(spec.unknown).toEqual(['linha solta', 'limit: zero'])
  })

  it('recognises an empty spec', () => {
    expect(isEmptySpec(parseQueryBlock('sort: titulo'))).toBe(true)
    expect(isEmptySpec(parseQueryBlock('tag: uti'))).toBe(false)
  })
})

describe('matchesQuery', () => {
  it('filters by tag', () => {
    expect(matchesQuery(NOTES[0], parseQueryBlock('tag: uti'))).toBe(true)
    expect(matchesQuery(NOTES[1], parseQueryBlock('tag: uti'))).toBe(false)
  })

  it('a parent tag matches its children', () => {
    expect(matchesQuery(NOTES[0], parseQueryBlock('tag: sistema'))).toBe(true)
  })

  it('filters by folder', () => {
    expect(matchesQuery(NOTES[0], parseQueryBlock('path: Patologias'))).toBe(true)
    expect(matchesQuery(NOTES[2], parseQueryBlock('path: Patologias'))).toBe(false)
  })

  it('filters by a frontmatter field', () => {
    expect(matchesQuery(NOTES[0], parseQueryBlock('tipo: patologia'))).toBe(true)
    expect(matchesQuery(NOTES[2], parseQueryBlock('tipo: patologia'))).toBe(false)
  })

  it('accepts any of several values for a field', () => {
    expect(matchesQuery(NOTES[2], parseQueryBlock('tipo: patologia, procedimento'))).toBe(true)
  })

  it('has: only requires the field to exist', () => {
    expect(matchesQuery(NOTES[0], parseQueryBlock('has: gravidade'))).toBe(true)
    expect(matchesQuery(NOTES[1], parseQueryBlock('has: gravidade'))).toBe(false)
  })

  it('combines conditions with AND', () => {
    expect(matchesQuery(NOTES[0], parseQueryBlock('tag: uti\ntipo: patologia'))).toBe(true)
    expect(matchesQuery(NOTES[2], parseQueryBlock('tag: uti\ntipo: patologia'))).toBe(false)
  })

  it('a note with no frontmatter never matches a field query', () => {
    expect(matchesQuery(NOTES[3], parseQueryBlock('tipo: patologia'))).toBe(false)
  })
})

describe('runQuery', () => {
  it('sorts by title by default', () => {
    const out = runQuery(NOTES, parseQueryBlock('tipo: patologia'))
    expect(out.map((n) => n.file.name)).toEqual(['Anemia', 'Sepse'])
  })

  it('sorts by modification date, newest first with desc', () => {
    const out = runQuery(NOTES, parseQueryBlock('tag: uti\nsort: modificado desc'))
    expect(out.map((n) => n.file.name)).toEqual(['Sepse', 'Intubação'])
  })

  it('respects the limit', () => {
    expect(runQuery(NOTES, parseQueryBlock('tipo: patologia\nlimit: 1'))).toHaveLength(1)
  })

  it('returns nothing when nothing matches', () => {
    expect(runQuery(NOTES, parseQueryBlock('tag: inexistente'))).toEqual([])
  })
})
