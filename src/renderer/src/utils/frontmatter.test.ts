import { describe, it, expect } from 'vitest'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'
import remarkFrontmatter from 'remark-frontmatter'
import { parseFrontmatter, asList, frontmatterTags, frontmatterAliases } from './frontmatter'

// Guards the actual reason item 1 exists: without remarkFrontmatter, CommonMark
// reads `tags: x` followed by `---` as a setext heading and shows it as an <h2>
describe('preview pipeline', () => {
  const render = (md: string) =>
    String(remark().use(remarkGfm).use(remarkFrontmatter, ['yaml']).use(remarkHtml, { sanitize: false }).processSync(md))

  it('does not render the frontmatter block', () => {
    const html = render('---\ntags: [cardiologia]\n---\n\n# Sepse\n')
    expect(html).not.toContain('cardiologia')
    expect(html).not.toContain('<h2')
    expect(html).toContain('<h1>Sepse</h1>')
  })

  it('still renders a --- rule in the middle of the note', () => {
    expect(render('a\n\n---\n\nb')).toContain('<hr>')
  })
})

describe('parseFrontmatter', () => {
  it('splits fields from the body', () => {
    const { data, body } = parseFrontmatter('---\ntitulo: Sepse\n---\n# Sepse\n\ntexto')
    expect(data).toEqual({ titulo: 'Sepse' })
    expect(body).toBe('# Sepse\n\ntexto')
  })

  it('reads inline and block lists', () => {
    const { data } = parseFrontmatter('---\ntags: [cardio, uti]\naliases:\n  - IAM\n  - infarto\n---\ncorpo')
    expect(data?.tags).toEqual(['cardio', 'uti'])
    expect(data?.aliases).toEqual(['IAM', 'infarto'])
  })

  it('ignores a --- block that does not start the note', () => {
    const md = 'texto\n\n---\ntags: x\n---\n'
    expect(parseFrontmatter(md)).toEqual({ data: null, body: md })
  })

  it('keeps the body when the YAML is invalid', () => {
    const md = '---\n: : :\n\tx\n---\ncorpo'
    const { data, body } = parseFrontmatter(md)
    expect(data).toBeNull()
    expect(body).toBe('corpo')
  })

  it('returns the note untouched when there is no frontmatter', () => {
    expect(parseFrontmatter('# Só um título')).toEqual({ data: null, body: '# Só um título' })
  })

  it('handles an empty frontmatter block', () => {
    expect(parseFrontmatter('---\n\n---\ncorpo').body).toBe('corpo')
  })
})

describe('asList', () => {
  it('accepts an array', () => { expect(asList(['a', 'b'])).toEqual(['a', 'b']) })
  it('accepts a comma-separated string', () => { expect(asList('a, b')).toEqual(['a', 'b']) })
  it('accepts a single value', () => { expect(asList('a')).toEqual(['a']) })
  it('returns empty for null', () => { expect(asList(null)).toEqual([]) })
})

describe('frontmatterTags', () => {
  it('strips the # and lowercases', () => {
    expect(frontmatterTags({ tags: ['#Cardio', 'UTI'] })).toEqual(['cardio', 'uti'])
  })

  it('accepts the singular key', () => {
    expect(frontmatterTags({ tag: 'cardio' })).toEqual(['cardio'])
  })

  it('returns empty without frontmatter', () => {
    expect(frontmatterTags(null)).toEqual([])
  })
})

describe('frontmatterAliases', () => {
  it('reads aliases', () => {
    expect(frontmatterAliases({ aliases: ['IAM', 'infarto'] })).toEqual(['IAM', 'infarto'])
  })
})
