// Pure HTML/markdown string transforms used by the preview pipeline.
// Kept free of heavy imports (katex / mermaid / CSS) so they are unit-testable
// in isolation. Math rendering (which needs katex) stays in MarkdownPreview.

// ── Callout / admonition support ───────────────────────────────────────────

export const CALLOUT_META: Record<string, { icon: string; color: string }> = {
  info:      { icon: 'ℹ️',  color: '#3b82f6' },
  tip:       { icon: '💡',  color: '#10b981' },
  hint:      { icon: '💡',  color: '#10b981' },
  warning:   { icon: '⚠️',  color: '#f59e0b' },
  caution:   { icon: '⚠️',  color: '#f59e0b' },
  attention: { icon: '⚠️',  color: '#f59e0b' },
  danger:    { icon: '🔥',  color: '#ef4444' },
  error:     { icon: '❌',  color: '#ef4444' },
  bug:       { icon: '🐛',  color: '#ef4444' },
  success:   { icon: '✅',  color: '#10b981' },
  check:     { icon: '✅',  color: '#10b981' },
  done:      { icon: '✅',  color: '#10b981' },
  note:      { icon: '📝',  color: '#6366f1' },
  abstract:  { icon: '📋',  color: '#6366f1' },
  summary:   { icon: '📋',  color: '#6366f1' },
  tldr:      { icon: '📋',  color: '#6366f1' },
  question:  { icon: '❓',  color: '#8b5cf6' },
  help:      { icon: '❓',  color: '#8b5cf6' },
  faq:       { icon: '❓',  color: '#8b5cf6' },
  important: { icon: '❗',  color: '#ec4899' },
  example:   { icon: '📌',  color: '#6366f1' },
  quote:     { icon: '💬',  color: '#6b7280' },
  cite:      { icon: '💬',  color: '#6b7280' },
  failure:   { icon: '💥',  color: '#ef4444' },
  fail:      { icon: '💥',  color: '#ef4444' },
  missing:   { icon: '💥',  color: '#ef4444' },
  todo:      { icon: '☑️',  color: '#6366f1' },
  // Flashcards: a card is a callout, so it stays readable anywhere
  card:      { icon: '🃏',  color: '#8b5cf6' },
  flashcard: { icon: '🃏',  color: '#8b5cf6' },
  pergunta:  { icon: '🃏',  color: '#8b5cf6' },
  mnemonic:  { icon: '🧠',  color: '#f59e0b' },
  mnemonico: { icon: '🧠',  color: '#f59e0b' },
}

// `?` marks a mnemonic as reviewable (see utils/cards.ts). It is captured here
// so it never leaks into the rendered title, but it does not fold the callout.
const CALLOUT_HEAD_RE = /^\s*<p>\[!([\wÀ-ɏ]+)\]([-+?])?([^\n<]*)(?:\n([\s\S]*?))?<\/p>/

const BQ_OPEN = '<blockquote>'
const BQ_CLOSE = '</blockquote>'

/**
 * Index just past the `</blockquote>` that closes the one opening at `start`,
 * or -1 if the HTML is unbalanced. A regex cannot do this: `[\s\S]*?` stops at
 * the first close tag, which is the *inner* one whenever quotes are nested.
 */
function blockquoteEnd(html: string, start: number): number {
  let depth = 0
  let i = start
  while (i < html.length) {
    const open = html.indexOf(BQ_OPEN, i)
    const close = html.indexOf(BQ_CLOSE, i)
    if (close === -1) return -1
    if (open !== -1 && open < close) {
      depth++
      i = open + BQ_OPEN.length
    } else {
      depth--
      i = close + BQ_CLOSE.length
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * `> [!warning]` blocks → callouts, at any nesting depth. A quote holding a
 * callout, a callout holding a quote and a card inside an admonition all come
 * out intact; whatever is not a callout stays the blockquote it was.
 */
export function processCallouts(html: string): string {
  let out = ''
  let i = 0
  for (;;) {
    const start = html.indexOf(BQ_OPEN, i)
    if (start === -1) break
    const end = blockquoteEnd(html, start)
    if (end === -1) break
    out += html.slice(i, start) + renderBlockquote(html.slice(start, end))
    i = end
  }
  return out + html.slice(i)
}

function renderBlockquote(block: string): string {
  const inner = block.slice(BQ_OPEN.length, block.length - BQ_CLOSE.length)
  // Innermost first, so what this one holds is already rendered
  const body = processCallouts(inner)
  const head = CALLOUT_HEAD_RE.exec(body)
  if (!head) return BQ_OPEN + body + BQ_CLOSE
  return renderCallout(
    head[0], head[1], head[2], head[3], head[4], body.slice(head[0].length),
  )
}

function renderCallout(
  _match: string, type: string, fold: string, titleRest: string, bodyInP: string, bodyExtra: string,
): string {
    const t = type.toLowerCase()
    const meta = CALLOUT_META[t] ?? { icon: '📌', color: '#6b7280' }
    const title = titleRest.trim() || (t.charAt(0).toUpperCase() + t.slice(1))
    const collapsible = fold === '-' || fold === '+'
    const startClosed = fold === '-'

    const bodyParts = [
      bodyInP?.trim() ? `<p>${bodyInP.trim()}</p>` : '',
      (bodyExtra ?? '').trim(),
    ].filter(Boolean).join('\n')

    const bodyHtml = bodyParts
      ? `<div class="callout-content">${bodyParts}</div>`
      : ''

    const style = `style="--callout-color:${meta.color}"`

    if (collapsible) {
      const foldIcon = `<span class="callout-fold">▾</span>`
      return `<details class="callout callout-${t}" ${style}${startClosed ? '' : ' open'}>
<summary class="callout-title"><span class="callout-icon">${meta.icon}</span><span class="callout-title-text">${title}</span>${foldIcon}</summary>
${bodyHtml}</details>`
    }

    return `<div class="callout callout-${t}" ${style}>
<div class="callout-title"><span class="callout-icon">${meta.icon}</span><span class="callout-title-text">${title}</span></div>
${bodyHtml}</div>`
}

// Split on code blocks so inline transforms never touch content inside ``` … ```
export const CODE_BLOCK_RE = /(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/g

// Same idea, but on raw markdown (before remark) — fences and inline code
export const MD_CODE_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g

/** Applies `fn` to every stretch of markdown that is not code. */
export function mapOutsideCode(md: string, fn: (chunk: string) => string): string {
  return md.split(MD_CODE_RE).map((part, i) => (i % 2 === 1 ? part : fn(part))).join('')
}

// ── Highlight syntax ==text== ─────────────────────────────────────────────

export function processHighlights(html: string): string {
  const parts = html.split(CODE_BLOCK_RE)
  return parts.map((part, i) => {
    if (i % 2 === 1) return part
    return part.replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
  }).join('')
}

// ── Private comments %%…%% ────────────────────────────────────────────────

/**
 * `%%text%%` is an annotation for the author only: it stays in the file but is
 * not rendered. Runs on raw markdown so a comment can also swallow block
 * syntax (a whole paragraph, a heading) without leaving debris behind.
 */
export function stripComments(md: string): string {
  return mapOutsideCode(md, (chunk) => chunk.replace(/%%[\s\S]*?%%/g, ''))
}

// ── Inline tags ───────────────────────────────────────────────────────────

// Same shape as extractTags in the store, so what is rendered as a tag and
// what gets indexed as a tag never disagree
const TAG_RE = /(^|[\s(>])#([\p{L}\p{N}_/-]+)/gu
const NUMERIC_RE = /^\d+$/
const HEX_COLOUR_RE = /^(?=.*\d)[0-9a-fA-F]{3}$|^(?=.*\d)[0-9a-fA-F]{6}$|^(?=.*\d)[0-9a-fA-F]{8}$/

export function processTags(html: string): string {
  const parts = html.split(CODE_BLOCK_RE)
  return parts.map((part, i) => {
    if (i % 2 === 1) return part
    return part.replace(TAG_RE, (whole, lead: string, raw: string) => {
      const tag = raw.replace(/[/-]+$/, '')
      if (!tag || NUMERIC_RE.test(tag) || HEX_COLOUR_RE.test(tag)) return whole
      const trailing = raw.slice(tag.length)
      return `${lead}<a href="#" class="tag" data-tag="${tag.toLowerCase()}">#${tag}</a>${trailing}`
    })
  }).join('')
}

// ── Heading IDs for TOC anchor scrolling ─────────────────────────────────

// Heading text → anchor id. Shared with wikilink anchors ([[Nota#Seção]]) so a
// link and its target always agree on the id.
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/--+/g, '-').trim()
}

export function addHeadingIds(html: string): string {
  const counts: Record<string, number> = {}
  return html.replace(/<h([1-3])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, '')
    let id = slugify(text)
    if (counts[id] !== undefined) { counts[id]++; id = `${id}-${counts[id]}` }
    else counts[id] = 0
    return `<h${level} id="${id}">${inner}</h${level}>`
  })
}

// remark-html HTML-escapes code block content; decode before passing to mermaid
export function decodeMermaidCode(code: string): string {
  return code
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

// ── WikiLinks ──────────────────────────────────────────────────────────────

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

/**
 * `[[Nota]]` / `[[Nota#Seção|texto]]` → anchor. `exists` (when given) marks
 * targets with no note behind them so a dead link fails visibly instead of
 * silently doing nothing on click.
 */
export function processWikiLinks(md: string, exists?: (target: string) => boolean): string {
  return mapOutsideCode(md, (chunk) =>
    chunk.replace(WIKILINK_RE, (_, target, alias) => {
      const display = alias ?? displayTarget(target)
      const dead = exists ? !exists(target) : false
      const cls = dead ? 'wikilink wikilink-unresolved' : 'wikilink'
      return `<a href="#" class="${cls}" data-target="${target}">${display}</a>`
    }),
  )
}

// `Nota#Seção` reads better as `Nota › Seção`; a block ref (`#^id`) is machine
// noise, so only the note name is shown. data-target keeps the literal value.
export function displayTarget(target: string): string {
  const i = target.indexOf('#')
  if (i === -1) return target
  const note = target.slice(0, i).trim()
  const hash = target.slice(i + 1).trim()
  if (!hash || hash.startsWith('^')) return note || target
  return note ? `${note} › ${hash}` : hash
}

// Toggle the nth `- [ ]` / `- [x]` occurrence in raw markdown
export function toggleCheckbox(markdown: string, index: number): string {
  let count = -1
  return markdown.replace(/- \[[ xX]\]/g, (match) => {
    count++
    if (count === index) {
      return /\[[ ]\]/.test(match) ? '- [x]' : '- [ ]'
    }
    return match
  })
}
