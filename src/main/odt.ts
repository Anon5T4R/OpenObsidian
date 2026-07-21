// ODT (OpenDocument Text) → HTML.
// An .odt is a ZIP whose content.xml holds the document. This is the same role
// mammoth plays for .docx; the output feeds the viewer and the turndown step
// that produces Markdown. Pure string work so it is unit-testable.

// ── Minimal XML tree ───────────────────────────────────────────────────────

export type XElement = { tag: string; attrs: Record<string, string>; children: XNode[] }
export type XNode = XElement | { text: string }

const isElement = (n: XNode): n is XElement => 'tag' in n

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[body] ?? whole
  })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const ATTR_RE = /([\w:.-]+)\s*=\s*"([^"]*)"/g

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  let m: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  while ((m = ATTR_RE.exec(raw)) !== null) attrs[m[1]] = decodeEntities(m[2])
  return attrs
}

/** Parses a well-formed XML fragment. ODF files are machine-generated, so a
 *  tolerant scanner is enough — no need to pull in a parser dependency. */
export function parseXml(xml: string): XElement {
  const root: XElement = { tag: '#root', attrs: {}, children: [] }
  const stack: XElement[] = [root]
  const TAG_RE = /<(\/)?([\w:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/)?>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<![\s\S]*?>/g

  let cursor = 0
  let m: RegExpExecArray | null
  while ((m = TAG_RE.exec(xml)) !== null) {
    const text = xml.slice(cursor, m.index)
    if (text) stack[stack.length - 1].children.push({ text: decodeEntities(text) })
    cursor = m.index + m[0].length

    if (m[5] !== undefined) { stack[stack.length - 1].children.push({ text: m[5] }); continue }
    if (m[2] === undefined) continue // comment / declaration / doctype

    if (m[1]) {
      // Closing tag — unwind to it, tolerating a stray close
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === m[2]) { stack.length = i; break }
      }
      continue
    }
    const el: XElement = { tag: m[2], attrs: parseAttrs(m[3] ?? ''), children: [] }
    stack[stack.length - 1].children.push(el)
    if (!m[4]) stack.push(el)
  }
  const tail = xml.slice(cursor)
  if (tail) stack[stack.length - 1].children.push({ text: decodeEntities(tail) })
  return root
}

function find(node: XElement, tag: string): XElement | null {
  for (const child of node.children) {
    if (!isElement(child)) continue
    if (child.tag === tag) return child
    const deep = find(child, tag)
    if (deep) return deep
  }
  return null
}

// ── Style lookup ───────────────────────────────────────────────────────────

type TextStyle = { bold?: boolean; italic?: boolean; underline?: boolean }

/** style:name → inline formatting, read from the document's style definitions. */
function collectTextStyles(root: XElement): Map<string, TextStyle> {
  const styles = new Map<string, TextStyle>()
  const walk = (node: XElement) => {
    for (const child of node.children) {
      if (!isElement(child)) continue
      if (child.tag === 'style:style' && child.attrs['style:family'] === 'text') {
        const props = find(child, 'style:text-properties')
        if (props) {
          styles.set(child.attrs['style:name'], {
            bold: props.attrs['fo:font-weight'] === 'bold',
            italic: props.attrs['fo:font-style'] === 'italic',
            underline: (props.attrs['style:text-underline-style'] ?? 'none') !== 'none',
          })
        }
      }
      walk(child)
    }
  }
  walk(root)
  return styles
}

/** List styles whose first level is numbered render as <ol>. */
function collectOrderedLists(root: XElement): Set<string> {
  const ordered = new Set<string>()
  const walk = (node: XElement) => {
    for (const child of node.children) {
      if (!isElement(child)) continue
      if (child.tag === 'text:list-style') {
        const first = child.children.find(isElement)
        if (first?.tag === 'text:list-level-style-number') ordered.add(child.attrs['style:name'])
      }
      walk(child)
    }
  }
  walk(root)
  return ordered
}

// ── Rendering ──────────────────────────────────────────────────────────────

const SKIPPED = new Set([
  'text:sequence-decls', 'text:soft-page-break', 'office:forms',
  'text:tracked-changes', 'draw:frame', 'office:annotation',
])

function renderInline(nodes: XNode[], styles: Map<string, TextStyle>): string {
  return nodes.map((node) => {
    if (!isElement(node)) return escapeHtml(node.text)
    switch (node.tag) {
      case 'text:span': {
        const style = styles.get(node.attrs['text:style-name'] ?? '')
        let html = renderInline(node.children, styles)
        if (style?.bold)      html = `<strong>${html}</strong>`
        if (style?.italic)    html = `<em>${html}</em>`
        if (style?.underline) html = `<u>${html}</u>`
        return html
      }
      case 'text:a':
        return `<a href="${escapeHtml(node.attrs['xlink:href'] ?? '#')}">${renderInline(node.children, styles)}</a>`
      case 'text:line-break': return '<br>'
      case 'text:tab':        return ' '
      case 'text:s':          return ' '.repeat(Math.max(1, parseInt(node.attrs['text:c'] ?? '1', 10) || 1))
      default:
        if (SKIPPED.has(node.tag)) return ''
        return renderInline(node.children, styles)
    }
  }).join('')
}

function renderBlocks(nodes: XNode[], styles: Map<string, TextStyle>, ordered: Set<string>): string {
  const out: string[] = []
  for (const node of nodes) {
    if (!isElement(node)) continue
    if (SKIPPED.has(node.tag)) continue

    switch (node.tag) {
      case 'text:h': {
        const level = Math.min(6, Math.max(1, parseInt(node.attrs['text:outline-level'] ?? '1', 10) || 1))
        const inner = renderInline(node.children, styles).trim()
        if (inner) out.push(`<h${level}>${inner}</h${level}>`)
        break
      }
      case 'text:p': {
        const inner = renderInline(node.children, styles).trim()
        if (inner) out.push(`<p>${inner}</p>`)
        break
      }
      case 'text:list': {
        const tag = ordered.has(node.attrs['text:style-name'] ?? '') ? 'ol' : 'ul'
        const items = node.children.filter(isElement)
          .filter((c) => c.tag === 'text:list-item' || c.tag === 'text:list-header')
          .map((item) => `<li>${unwrapSingleParagraph(renderBlocks(item.children, styles, ordered))}</li>`)
        if (items.length) out.push(`<${tag}>${items.join('')}</${tag}>`)
        break
      }
      case 'table:table':
        out.push(renderTable(node, styles, ordered))
        break
      default:
        out.push(renderBlocks(node.children, styles, ordered))
    }
  }
  return out.join('\n')
}

// A list item is almost always a single <p>; the tags only add noise in Markdown
function unwrapSingleParagraph(html: string): string {
  const m = /^<p>([\s\S]*)<\/p>$/.exec(html.trim())
  return m && !m[1].includes('<p>') ? m[1] : html
}

function renderTable(table: XElement, styles: Map<string, TextStyle>, ordered: Set<string>): string {
  const rowsOf = (node: XElement): { row: XElement; header: boolean }[] => {
    const rows: { row: XElement; header: boolean }[] = []
    for (const child of node.children) {
      if (!isElement(child)) continue
      if (child.tag === 'table:table-row') rows.push({ row: child, header: node.tag === 'table:table-header-rows' })
      else if (child.tag === 'table:table-header-rows' || child.tag === 'table:table-row-group') rows.push(...rowsOf(child))
    }
    return rows
  }

  const rows = rowsOf(table)
  if (rows.length === 0) return ''

  const cellsOf = (row: XElement) => row.children.filter(isElement)
    .filter((c) => c.tag === 'table:table-cell' || c.tag === 'table:covered-table-cell')
    .flatMap((cell) => {
      const repeat = Math.min(64, parseInt(cell.attrs['table:number-columns-repeated'] ?? '1', 10) || 1)
      const html = unwrapSingleParagraph(renderBlocks(cell.children, styles, ordered))
      return Array.from({ length: repeat }, () => html)
    })

  // No explicit header rows: treat the first row as one, like most converters do
  const hasExplicitHeader = rows.some((r) => r.header)
  const body = rows.map(({ row, header }, i) => {
    const tag = header || (!hasExplicitHeader && i === 0) ? 'th' : 'td'
    return `<tr>${cellsOf(row).map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`
  })
  return `<table>${body.join('')}</table>`
}

/**
 * content.xml (and optionally styles.xml, which holds styles used by headers
 * and footers) → HTML.
 */
export function odtToHtml(contentXml: string, stylesXml = ''): string {
  const content = parseXml(contentXml)
  const styles = collectTextStyles(content)
  const ordered = collectOrderedLists(content)
  if (stylesXml) {
    const extra = parseXml(stylesXml)
    for (const [k, v] of collectTextStyles(extra)) if (!styles.has(k)) styles.set(k, v)
    for (const name of collectOrderedLists(extra)) ordered.add(name)
  }
  const body = find(content, 'office:text')
  if (!body) return ''
  return renderBlocks(body.children, styles, ordered)
}
