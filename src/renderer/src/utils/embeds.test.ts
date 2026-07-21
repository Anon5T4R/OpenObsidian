import { describe, it, expect } from 'vitest'
import { expandEmbeds, extractSection } from './embeds'

const notes: Record<string, string> = {
  'Doses': '# Doses\n\n| Droga | Dose |\n| --- | --- |\n| Nora | 0,1 |',
  'Sepse': '# Sepse\n\n## Conduta\n\nAntibiótico em 1h.\n\n### Detalhe\n\nsub\n\n## Prognóstico\n\ntexto',
  'ComFront': '---\ntags: [x]\n---\n# Com frontmatter\n\ncorpo',
  'A': 'inicio A\n\n![[B]]',
  'B': 'inicio B\n\n![[A]]',
}
const resolve = (target: string) => notes[target] ?? null

describe('extractSection', () => {
  it('takes the section up to the next heading of the same level', () => {
    const out = extractSection(notes['Sepse'], 'Conduta')
    expect(out).toContain('Antibiótico em 1h.')
    expect(out).toContain('### Detalhe')
    expect(out).not.toContain('Prognóstico')
  })

  it('matches case-insensitively', () => {
    expect(extractSection(notes['Sepse'], 'conduta')).toContain('Antibiótico')
  })

  it('returns empty for a section that does not exist', () => {
    expect(extractSection(notes['Sepse'], 'Nada')).toBe('')
  })
})

describe('expandEmbeds', () => {
  it('inlines the whole note', () => {
    const out = expandEmbeds('antes\n\n![[Doses]]\n\ndepois', resolve)
    expect(out).toContain('class="embed"')
    expect(out).toContain('| Nora | 0,1 |')
    expect(out).toContain('antes')
    expect(out).toContain('depois')
  })

  it('surrounds the payload with blank lines so remark still parses it', () => {
    const out = expandEmbeds('![[Doses]]', resolve)
    expect(out).toMatch(/<div class="embed">[\s\S]*\n\n[\s\S]*\n\n<\/div>/)
  })

  it('inlines only the requested section', () => {
    const out = expandEmbeds('![[Sepse#Conduta]]', resolve)
    expect(out).toContain('Antibiótico em 1h.')
    expect(out).not.toContain('Prognóstico')
  })

  it('drops the frontmatter of the embedded note', () => {
    const out = expandEmbeds('![[ComFront]]', resolve)
    expect(out).not.toContain('tags: [x]')
    expect(out).toContain('corpo')
  })

  it('marks an unresolved target instead of failing', () => {
    const out = expandEmbeds('![[Fantasma]]', resolve)
    expect(out).toContain('embed-missing')
    // brackets escaped so the later wikilink pass leaves the literal alone
    expect(out).toContain('!&#91;&#91;Fantasma&#93;&#93;')
  })

  it('marks a section that does not exist', () => {
    expect(expandEmbeds('![[Sepse#Nada]]', resolve)).toContain('embed-missing')
  })

  it('does not hang on a cycle', () => {
    const out = expandEmbeds('![[A]]', resolve)
    expect(out).toContain('inicio A')
    expect(out).toContain('inicio B')
    expect(out).toContain('embed-missing')
  })

  it('leaves an embed inside a code fence alone', () => {
    const md = '```\n![[Doses]]\n```'
    expect(expandEmbeds(md, resolve)).toBe(md)
  })

  it('leaves a plain [[link]] alone', () => {
    expect(expandEmbeds('[[Doses]]', resolve)).toBe('[[Doses]]')
  })

  it('keeps an image link untouched', () => {
    expect(expandEmbeds('![alt](img.png)', resolve)).toBe('![alt](img.png)')
  })
})
