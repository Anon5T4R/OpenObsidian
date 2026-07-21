import { describe, it, expect } from 'vitest'
import {
  processHighlights,
  processCallouts,
  addHeadingIds,
  processWikiLinks,
  toggleCheckbox,
  decodeMermaidCode,
  slugify,
} from './markdownTransforms'

describe('processHighlights', () => {
  it('wraps ==text== in <mark>', () => {
    expect(processHighlights('a ==b== c')).toBe('a <mark>b</mark> c')
  })

  it('does not touch highlights inside code blocks', () => {
    const html = '<pre><code>==keep==</code></pre> ==hit=='
    const out = processHighlights(html)
    expect(out).toContain('==keep==')
    expect(out).toContain('<mark>hit</mark>')
  })
})

describe('processCallouts', () => {
  it('renders a basic callout with icon and title', () => {
    const html = '<blockquote>\n<p>[!warning] Careful</p></blockquote>'
    const out = processCallouts(html)
    expect(out).toContain('callout callout-warning')
    expect(out).toContain('Careful')
    expect(out).toContain('--callout-color:#f59e0b')
  })

  it('renders a collapsible callout as <details> (closed with -)', () => {
    const html = '<blockquote>\n<p>[!note]- Hidden</p></blockquote>'
    const out = processCallouts(html)
    expect(out).toContain('<details')
    expect(out).not.toContain(' open>')
  })
})

describe('addHeadingIds', () => {
  it('adds slugified ids and de-duplicates', () => {
    const out = addHeadingIds('<h2>Hello World</h2><h2>Hello World</h2>')
    expect(out).toContain('<h2 id="hello-world">')
    expect(out).toContain('<h2 id="hello-world-1">')
  })
})

describe('processWikiLinks', () => {
  it('converts [[Note]] to an anchor with data-target', () => {
    expect(processWikiLinks('[[My Note]]')).toBe(
      '<a href="#" class="wikilink" data-target="My Note">My Note</a>',
    )
  })

  it('uses the alias for [[target|alias]]', () => {
    const out = processWikiLinks('[[target|shown]]')
    expect(out).toContain('data-target="target"')
    expect(out).toContain('>shown<')
  })

  it('keeps the anchor in data-target', () => {
    expect(processWikiLinks('[[Nota#Seção]]')).toContain('data-target="Nota#Seção"')
  })

  it('shows an anchor as "Nota › Seção"', () => {
    expect(processWikiLinks('[[Nota#Seção]]')).toContain('>Nota › Seção<')
  })

  it('shows only the note name for a block ref', () => {
    expect(processWikiLinks('[[Nota#^abc]]')).toContain('>Nota<')
  })

  it('an explicit alias still wins', () => {
    expect(processWikiLinks('[[Nota#Seção|ver aqui]]')).toContain('>ver aqui<')
  })

  it('shows just the section for an anchor into the current note', () => {
    expect(processWikiLinks('[[#Seção]]')).toContain('>Seção<')
  })

  it('marks a target with no note behind it', () => {
    const out = processWikiLinks('[[Fantasma]]', () => false)
    expect(out).toContain('class="wikilink wikilink-unresolved"')
  })

  it('does not linkify a [[link]] inside a code fence', () => {
    const md = '```\n[[Sepse]]\n```\n[[Sepse]]'
    const out = processWikiLinks(md)
    expect(out).toContain('```\n[[Sepse]]\n```')
    expect(out).toContain('<a href="#" class="wikilink"')
  })

  it('leaves a resolvable target unmarked', () => {
    const out = processWikiLinks('[[Sepse]]', () => true)
    expect(out).toContain('class="wikilink"')
    expect(out).not.toContain('unresolved')
  })
})

describe('slugify', () => {
  it('matches the id addHeadingIds generates', () => {
    const id = slugify('Conduta na Emergência')
    expect(addHeadingIds('<h2>Conduta na Emergência</h2>')).toContain(`id="${id}"`)
  })
})

describe('toggleCheckbox', () => {
  it('checks the nth unchecked box', () => {
    expect(toggleCheckbox('- [ ] a\n- [ ] b', 1)).toBe('- [ ] a\n- [x] b')
  })

  it('unchecks a checked box', () => {
    expect(toggleCheckbox('- [x] a', 0)).toBe('- [ ] a')
  })
})

describe('decodeMermaidCode', () => {
  it('decodes HTML entities', () => {
    expect(decodeMermaidCode('A --&gt; B &amp; C')).toBe('A --> B & C')
  })
})
