// Transclusion — `![[Nota]]` / `![[Nota#Seção]]`.
// Without it, content used in ten notes has to be copied ten times, and the
// copies drift apart. Pure string work so it can be unit-tested.

import { parseWikiTarget } from './linkResolver'
import { parseFrontmatter } from './frontmatter'
import { mapOutsideCode } from '../components/Editor/markdownTransforms'

const EMBED_RE = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
const MAX_DEPTH = 3

// Shown when the target is missing: keep the literal `![[…]]` visible instead
// of letting the later wikilink pass turn it into a half-broken link
function missing(raw: string): string {
  return `<div class="embed embed-missing">!&#91;&#91;${raw.trim()}&#93;&#93;</div>`
}

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
  // An `![[…]]` inside a code block is documentation — injecting a <div>
  // there would wreck the fence
  return mapOutsideCode(md, (chunk) => chunk.replace(EMBED_RE, (_, raw: string) => {
    const { target, hash } = parseWikiTarget(raw)
    const key = raw.trim().toLowerCase()
    if (seen.has(key)) return missing(raw)

    const resolved = resolve(target)
    if (resolved === null) return missing(raw)

    // The embedded note is no longer at the top of the document, so its own
    // frontmatter would render as a setext heading — drop it here
    const source = parseFrontmatter(resolved).body
    const body = hash && !hash.startsWith('^') ? extractSection(source, hash) : source
    if (!body.trim()) return missing(raw)

    const inner = expandEmbeds(body, resolve, depth + 1, new Set([...seen, key]))
    const title = `<div class="embed-source"><a href="#" class="wikilink" data-target="${raw.trim()}">${raw.trim()}</a></div>`
    return `\n\n<div class="embed">\n${title}\n\n${inner}\n\n</div>\n\n`
  }))
}
