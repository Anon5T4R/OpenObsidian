import { describe, it, expect } from 'vitest'
import { odtToHtml, parseXml } from './odt'

const doc = (body: string, styles = '') => `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content>
  <office:automatic-styles>${styles}</office:automatic-styles>
  <office:body><office:text>${body}</office:text></office:body>
</office:document-content>`

const BOLD = '<style:style style:name="T1" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>'
const ITALIC = '<style:style style:name="T2" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>'

describe('parseXml', () => {
  it('builds a tree with attributes', () => {
    const root = parseXml('<a x="1"><b>txt</b></a>')
    const a = root.children[0] as { tag: string; attrs: Record<string, string>; children: unknown[] }
    expect(a.tag).toBe('a')
    expect(a.attrs.x).toBe('1')
    expect(a.children).toHaveLength(1)
  })

  it('handles self-closing tags', () => {
    const root = parseXml('<a><br/><b>x</b></a>')
    const a = root.children[0] as { children: { tag?: string }[] }
    expect(a.children.map((c) => c.tag)).toEqual(['br', 'b'])
  })

  it('decodes entities in text and attributes', () => {
    const root = parseXml('<a t="a&amp;b">1 &lt; 2 &#233;</a>')
    const a = root.children[0] as { attrs: Record<string, string>; children: { text: string }[] }
    expect(a.attrs.t).toBe('a&b')
    expect(a.children[0].text).toBe('1 < 2 é')
  })

  it('skips comments and the xml declaration', () => {
    const root = parseXml('<?xml version="1.0"?><!-- nota --><a>x</a>')
    expect(root.children).toHaveLength(1)
  })
})

describe('odtToHtml', () => {
  it('converts headings by outline level', () => {
    const html = odtToHtml(doc('<text:h text:outline-level="2">Conduta</text:h>'))
    expect(html).toBe('<h2>Conduta</h2>')
  })

  it('converts paragraphs', () => {
    expect(odtToHtml(doc('<text:p>Um texto</text:p>'))).toBe('<p>Um texto</p>')
  })

  it('drops empty paragraphs', () => {
    expect(odtToHtml(doc('<text:p/><text:p>x</text:p>'))).toBe('<p>x</p>')
  })

  it('applies bold and italic from the style definitions', () => {
    const html = odtToHtml(doc(
      '<text:p>a <text:span text:style-name="T1">forte</text:span> e <text:span text:style-name="T2">ênfase</text:span></text:p>',
      BOLD + ITALIC,
    ))
    expect(html).toContain('<strong>forte</strong>')
    expect(html).toContain('<em>ênfase</em>')
  })

  it('leaves an unstyled span as plain text', () => {
    const html = odtToHtml(doc('<text:p><text:span text:style-name="T9">x</text:span></text:p>'))
    expect(html).toBe('<p>x</p>')
  })

  it('converts links', () => {
    const html = odtToHtml(doc('<text:p><text:a xlink:href="https://x.com">site</text:a></text:p>'))
    expect(html).toBe('<p><a href="https://x.com">site</a></p>')
  })

  it('converts a bullet list', () => {
    const html = odtToHtml(doc(
      '<text:list><text:list-item><text:p>um</text:p></text:list-item><text:list-item><text:p>dois</text:p></text:list-item></text:list>',
    ))
    expect(html).toBe('<ul><li>um</li><li>dois</li></ul>')
  })

  it('converts a numbered list when the list style is numbered', () => {
    const html = odtToHtml(doc(
      '<text:list text:style-name="L1"><text:list-item><text:p>um</text:p></text:list-item></text:list>',
      '<text:list-style style:name="L1"><text:list-level-style-number text:level="1"/></text:list-style>',
    ))
    expect(html).toBe('<ol><li>um</li></ol>')
  })

  it('keeps nested lists nested', () => {
    const html = odtToHtml(doc(
      '<text:list><text:list-item><text:p>pai</text:p><text:list><text:list-item><text:p>filho</text:p></text:list-item></text:list></text:list-item></text:list>',
    ))
    expect(html).toContain('<ul><li>')
    expect(html).toContain('<ul><li>filho</li></ul>')
  })

  it('converts a table, treating the first row as the header', () => {
    const html = odtToHtml(doc(
      '<table:table><table:table-row><table:table-cell><text:p>Droga</text:p></table:table-cell><table:table-cell><text:p>Dose</text:p></table:table-cell></table:table-row>' +
      '<table:table-row><table:table-cell><text:p>Nora</text:p></table:table-cell><table:table-cell><text:p>0,1</text:p></table:table-cell></table:table-row></table:table>',
    ))
    expect(html).toBe('<table><tr><th>Droga</th><th>Dose</th></tr><tr><td>Nora</td><td>0,1</td></tr></table>')
  })

  it('honours an explicit header-rows block', () => {
    const html = odtToHtml(doc(
      '<table:table><table:table-header-rows><table:table-row><table:table-cell><text:p>H</text:p></table:table-cell></table:table-row></table:table-header-rows>' +
      '<table:table-row><table:table-cell><text:p>c</text:p></table:table-cell></table:table-row></table:table>',
    ))
    expect(html).toBe('<table><tr><th>H</th></tr><tr><td>c</td></tr></table>')
  })

  it('repeats a cell marked with number-columns-repeated', () => {
    const html = odtToHtml(doc(
      '<table:table><table:table-row><table:table-cell table:number-columns-repeated="3"><text:p>x</text:p></table:table-cell></table:table-row></table:table>',
    ))
    expect(html).toBe('<table><tr><th>x</th><th>x</th><th>x</th></tr></table>')
  })

  it('turns line breaks into <br>', () => {
    expect(odtToHtml(doc('<text:p>a<text:line-break/>b</text:p>'))).toBe('<p>a<br>b</p>')
  })

  it('expands text:s into spaces', () => {
    expect(odtToHtml(doc('<text:p>a<text:s text:c="3"/>b</text:p>'))).toBe('<p>a   b</p>')
  })

  it('escapes markup coming from the document text', () => {
    expect(odtToHtml(doc('<text:p>1 &lt; 2 &amp; 3</text:p>'))).toBe('<p>1 &lt; 2 &amp; 3</p>')
  })

  it('drops images, as the docx path does', () => {
    const html = odtToHtml(doc('<text:p><draw:frame><draw:image xlink:href="x.png"/></draw:frame>legenda</text:p>'))
    expect(html).toBe('<p>legenda</p>')
  })

  it('returns empty for a document with no text body', () => {
    expect(odtToHtml('<office:document-content></office:document-content>')).toBe('')
  })
})
