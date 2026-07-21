// Transclusion — `![[Nota]]` / `![[Nota#Seção]]`.
// Without it, content used in ten notes has to be copied ten times, and the
// copies drift apart. Pure string work so it can be unit-tested.

import { parseWikiTarget } from './linkResolver'
import { parseFrontmatter } from './frontmatter'

const EMBED_RE = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
// An `![[…]]` inside a code block is documentation — injecting a <div> there
// would wreck the fence
const CODE_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g
const MAX_DEPTH = 3

/** Markdown of a note, or null when there is no note behind the target. */
export type EmbedResolver = (target: string) => string | null

/**
 * The slice of `md` under the heading whose text matches `heading`, up to the
 * next heading of the same or higher level. Empty string when not found.
 */
export function extractSection(md: string, heading: string): string {
  const lines = md.split('\n')
  const wanted = heading.trim().toLowerCase()
  let start = -1
  let level = 0
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i])
    if (!m) continue
    if (m[2].trim().toLowerCase() === wanted) { start = i; level = m[1].length; break }
  }
  if (start === -1) return ''
  const out: string[] = [lines[start]]
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#{1,6})\s+/.exec(lines[i])
    if (m && m[1].length <= level) break
    out.push(lines[i])
  }
  return out.join('\n').trim()
}

/**
 * Replaces every `![[…]]` with the content it points at, wrapped in a div.
 * The blank lines around the payload matter: they end the HTML block, so the
 * embedded markdown is still parsed as markdown by remark.
 * `seen` breaks cycles (A embeds B embeds A) and MAX_DEPTH bounds the nesting.
 */
export function expandEmbeds(
  md: string,
  resolve: EmbedResolver,
  depth = 0,
  seen: Set<string> = new Set(),
): string {
  if (depth >= MAX_DEPTH) return md
  return md.split(CODE_RE).map((part, i) => {
    if (i % 2 === 1) return part
    return expandChunk(part, resolve, depth, seen)
  }).join('')
}

function expandChunk(md: string, resolve: EmbedResolver, depth: number, seen: Set<string>): string {
  return md.replace(EMBED_RE, (whole, raw: string) => {
    const { target, hash } = parseWikiTarget(raw)
    const key = raw.trim().toLowerCase()
    if (seen.has(key)) return `<div class="embed embed-missing">${whole}</div>`

    const resolved = resolve(target)
    if (resolved === null) return `<div class="embed embed-missing">${whole}</div>`

    // The embedded note is no longer at the top of the document, so its own
    // frontmatter would render as a setext heading — drop it here
    const source = parseFrontmatter(resolved).body
    const body = hash && !hash.startsWith('^') ? extractSection(source, hash) : source
    if (!body.trim()) return `<div class="embed embed-missing">${whole}</div>`

    const inner = expandEmbeds(body, resolve, depth + 1, new Set([...seen, key]))
    const title = `<div class="embed-source"><a href="#" class="wikilink" data-target="${raw.trim()}">${raw.trim()}</a></div>`
    return `\n\n<div class="embed">\n${title}\n\n${inner}\n\n</div>\n\n`
  })
}
