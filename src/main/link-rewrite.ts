// Pure helpers for rewriting [[wikilinks]] when a note is renamed.
// Kept free of electron/fs imports so they are unit-testable in isolation.

// Fenced code blocks and inline code must never be rewritten — a `[[Nota]]`
// inside ``` is documentation, not a link.
const CODE_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g

// Captures the whole link so the alias / anchor parts can be preserved.
// group 1: target · group 2: #anchor (optional) · group 3: |alias (optional)
const LINK_RE = /\[\[([^\]|#]+)(#[^\]|]*)?(\|[^\]]*)?\]\]/g

/** The link `[[Pasta/Nota]]` targets the note `Nota` — compare only the last segment. */
function targetMatches(target: string, name: string): boolean {
  const clean = target.trim().replace(/\.md$/i, '')
  const last = clean.split('/').pop() ?? clean
  return last.toLowerCase() === name.toLowerCase()
}

/** Replaces the last path segment of `target` with `newName`, keeping any folder prefix. */
function replaceLastSegment(target: string, newName: string): string {
  const trimmed = target.replace(/\.md$/i, '')
  const parts = trimmed.split('/')
  parts[parts.length - 1] = newName
  return parts.join('/')
}

function mapOutsideCode(content: string, fn: (chunk: string) => string): string {
  return content.split(CODE_RE).map((part, i) => (i % 2 === 1 ? part : fn(part))).join('')
}

/** Rewrites every `[[oldName]]` (with alias/anchor/folder variants) to `newName`. */
export function rewriteLinks(
  content: string,
  oldName: string,
  newName: string,
): { content: string; count: number } {
  let count = 0
  const out = mapOutsideCode(content, (chunk) =>
    chunk.replace(LINK_RE, (match, target: string, anchor = '', alias = '') => {
      if (!targetMatches(target, oldName)) return match
      count++
      // Keep leading/trailing spaces the author wrote inside the brackets
      const lead  = target.match(/^\s*/)?.[0] ?? ''
      const trail = target.match(/\s*$/)?.[0] ?? ''
      return `[[${lead}${replaceLastSegment(target.trim(), newName)}${trail}${anchor}${alias}]]`
    }),
  )
  return { content: out, count }
}

/** How many links in `content` point at the note `name`. */
export function countRefs(content: string, name: string): number {
  return rewriteLinks(content, name, name).count
}
