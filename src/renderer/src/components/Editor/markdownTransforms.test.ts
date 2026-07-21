import { describe, it, expect } from 'vitest'
import {
  processHighlights,
  processCallouts,
  addHeadingIds,
  processWikiLinks,
  processTags,
  stripComments,
  toggleCheckbox,
  decodeMermaidCode,
  slugify,
  hasMath,
  processMath,
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

  it('renders a callout inside another one, innermost first', () => {
    // What remark produces for `> [!warning] X` holding `> > [!card]- Q`
    const html = '<blockquote>\n<p>[!warning] Emergência</p>\n' +
      '<blockquote>\n<p>[!card]- Dose?\n0,5 mg IM</p></blockquote>\n</blockquote>'
    const out = processCallouts(html)
    expect(out).toContain('callout-warning')
    expect(out).toContain('callout-card')
    // The inner one is inside the outer one's body, not a sibling left over
    expect(out.indexOf('callout-warning')).toBeLessThan(out.indexOf('callout-card'))
    // And no raw blockquote survives
    expect(out).not.toContain('<blockquote>')
  })

  it('keeps a plain quote inside a callout balanced', () => {
    const html = '<blockquote>\n<p>[!info] Com citação</p>\n' +
      '<blockquote>\n<p>só uma citação</p>\n</blockquote>\n</blockquote>'
    const out = processCallouts(html)
    expect(out).toContain('callout-info')
    // The quote stays a quote, and its tags still pair up
    expect(out.match(/<blockquote>/g)).toHaveLength(1)
    expect(out.match(/<\/blockquote>/g)).toHaveLength(1)
  })

  it('leaves a blockquote that is not a callout alone', () => {
    const html = '<blockquote>\n<p>citação comum</p>\n</blockquote>'
    expect(processCallouts(html)).toBe(html)
  })

  it('leaves no stray text when the nesting is three deep', () => {
    const html = '<blockquote>\n<p>[!info] A</p>\n<blockquote>\n<p>[!tip] B</p>\n' +
      '<blockquote>\n<p>[!card] C</p></blockquote>\n</blockquote>\n</blockquote>'
    const out = processCallouts(html)
    expect(out).not.toContain('<blockquote>')
    expect(out).toContain('callout-info')
    expect(out).toContain('callout-tip')
    expect(out).toContain('callout-card')
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

describe('stripComments', () => {
  it('removes an inline comment', () => {
    expect(stripComments('antes %%nota privada%% depois')).toBe('antes  depois')
  })

  it('removes a comment spanning several lines', () => {
    expect(stripComments('a\n%%\nlixo\n%%\nb')).toBe('a\n\nb')
  })

  it('removes more than one comment', () => {
    expect(stripComments('%%a%%x%%b%%')).toBe('x')
  })

  it('leaves a comment inside a code block alone', () => {
    const md = '```\n%%exemplo%%\n```'
    expect(stripComments(md)).toBe(md)
  })

  it('leaves a lone percent sign alone', () => {
    expect(stripComments('50% de 100%')).toBe('50% de 100%')
  })
})

describe('processTags', () => {
  it('turns a tag into a clickable chip', () => {
    expect(processTags('veja #cardio aqui'))
      .toBe('veja <a href="#" class="tag" data-tag="cardio">#cardio</a> aqui')
  })

  it('keeps accents and nesting', () => {
    expect(processTags('#pré-natal #sistema/cardio')).toContain('data-tag="pré-natal"')
    expect(processTags('#sistema/cardio')).toContain('data-tag="sistema/cardio"')
  })

  it('leaves a hex colour alone', () => {
    expect(processTags('cor #ff0000')).toBe('cor #ff0000')
  })

  it('leaves tags inside code blocks alone', () => {
    expect(processTags('<pre><code>#cardio</code></pre>')).toBe('<pre><code>#cardio</code></pre>')
  })

  it('does not touch a heading id or an anchor href', () => {
    expect(processTags('<a href="#conduta">x</a>')).toBe('<a href="#conduta">x</a>')
  })

  it('keeps the trailing separator out of the tag', () => {
    expect(processTags('#cardio/')).toContain('data-tag="cardio"')
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

// hasMath decides whether KaTeX is ever fetched. A false negative does not make
// the formula render late — it never renders at all.
describe('hasMath', () => {
  it('sees the four supported forms', () => {
    expect(hasMath('<p>$$x^2$$</p>')).toBe(true)
    expect(hasMath('<p>\\[x^2\\]</p>')).toBe(true)
    expect(hasMath('<p>o valor $x^2$ aqui</p>')).toBe(true)
    expect(hasMath('<p>o valor \\(x^2\\) aqui</p>')).toBe(true)
  })

  it('sees block math spanning several lines', () => {
    expect(hasMath('<p>$$\n\\frac{a}{b}\n$$</p>')).toBe(true)
  })

  it('does not take prices for formulas', () => {
    expect(hasMath('<p>custa $10 e depois $20</p>')).toBe(false)
    expect(hasMath('<p>sem matematica nenhuma</p>')).toBe(false)
  })

  it('gives the same answer twice — no leftover regex state', () => {
    const html = '<p>$a$ e $b$</p>'
    expect(hasMath(html)).toBe(true)
    expect(hasMath(html)).toBe(true)
  })
})

describe('processMath', () => {
  const fake = { renderToString: (tex: string, o: { displayMode: boolean }) =>
    `<${o.displayMode ? 'BLOCK' : 'INLINE'}>${tex}</${o.displayMode ? 'BLOCK' : 'INLINE'}>` }

  it('leaves the markup untouched while KaTeX has not arrived', () => {
    const html = '<p>$$x^2$$</p>'
    expect(processMath(html, null)).toBe(html)
  })

  it('renders block and inline in their own modes', () => {
    expect(processMath('<p>$$x^2$$</p>', fake))
      .toBe('<p><div class="math-block"><BLOCK>x^2</BLOCK></div></p>')
    expect(processMath('<p>vale $x^2$ aqui</p>', fake))
      .toBe('<p>vale <INLINE>x^2</INLINE> aqui</p>')
  })

  it('never touches math inside a code block', () => {
    const html = '<pre><code>$$x^2$$</code></pre>'
    expect(processMath(html, fake)).toBe(html)
  })

  it('keeps the source when the renderer throws', () => {
    const bad = { renderToString: () => { throw new Error('nope') } }
    expect(processMath('<p>$x^2$</p>', bad)).toBe('<p><span class="math-error">$x^2$</span></p>')
  })
})
