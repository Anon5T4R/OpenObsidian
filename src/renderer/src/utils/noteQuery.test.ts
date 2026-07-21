import { describe, it, expect } from 'vitest'
import { parseQueryBlock, runQuery, matchesQuery, isEmptySpec, sortIssues, QueryNote } from './noteQuery'

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

describe('sortIssues — ordenar por criado', () => {
  const nota = (name: string, criado?: string): QueryNote => ({
    file: { name, path: name, relativePath: `${name}.md` } as never,
    tags: ['x'],
    frontmatter: criado === undefined ? {} : { criado },
    mtime: 0,
  })
  const porCriado = parseQueryBlock('tag: x\nsort: criado')

  it('says nothing when every note has an ISO date', () => {
    expect(sortIssues([nota('A', '2026-01-05'), nota('B', '2026-07-21')], porCriado)).toEqual([])
  })

  it('reports that nobody declares the field', () => {
    // This is the silent one: all values tie, a stable sort returns scan order,
    // and the list looks ordered
    expect(sortIssues([nota('A'), nota('B')], porCriado)).toEqual([
      { kind: 'created-missing', missing: 2, total: 2 },
    ])
  })

  it('reports a partly filled set, where the gaps clump at one end', () => {
    const issues = sortIssues([nota('A', '2026-01-05'), nota('B')], porCriado)
    expect(issues).toContainEqual({ kind: 'created-missing', missing: 1, total: 2 })
  })

  it('reports a date that is not ISO, quoting the offender', () => {
    const issues = sortIssues([nota('A', '21/07/2025'), nota('B', '2026-01-05')], porCriado)
    expect(issues).toContainEqual({ kind: 'created-not-iso', sample: '21/07/2025' })
  })

  it('does not try to guess what 03/01/2026 means', () => {
    // 3 January or 1 March depending on where you live. Reported, never fixed.
    const issues = sortIssues([nota('A', '03/01/2026'), nota('B', '2026-05-01')], porCriado)
    expect(issues.some((i) => i.kind === 'created-not-iso')).toBe(true)
    // and the order is left exactly as it was — no silent rewrite
    const r = runQuery([nota('A', '03/01/2026'), nota('B', '2026-05-01')], porCriado)
    expect(r).toHaveLength(2)
  })

  it('accepts an ISO date carrying a time', () => {
    expect(sortIssues([nota('A', '2026-01-05T10:30:00')], porCriado)).toEqual([])
  })

  it('stays quiet for every other sort key', () => {
    for (const key of ['titulo', 'modificado', 'caminho']) {
      expect(sortIssues([nota('A'), nota('B')], parseQueryBlock(`tag: x\nsort: ${key}`)), key).toEqual([])
    }
  })

  it('stays quiet when the query matched nothing — there is nothing to mis-order', () => {
    expect(sortIssues([], porCriado)).toEqual([])
  })

  it('still sorts ISO dates correctly, which is why ISO is the supported form', () => {
    const r = runQuery([nota('Jul', '2026-07-21'), nota('Jan', '2026-01-05')], porCriado)
    expect(r.map((n) => n.file.name)).toEqual(['Jan', 'Jul'])
  })
})
