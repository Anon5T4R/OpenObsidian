// Locating text inside rendered HTML, as Ranges.
// Ranges (rather than injected <mark> tags) keep the search read-only: the
// preview owns its innerHTML and rewrites it on every render pass.

/** Every case-insensitive match of `query` inside `root`, in document order. */
export function collectRanges(root: Node, query: string): Range[] {
  const ranges: Range[] = []
  const needle = query.trim().toLowerCase()
  if (!needle) return ranges

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue ?? '').toLowerCase()
    let from = text.indexOf(needle)
    while (from !== -1) {
      const range = document.createRange()
      range.setStart(node, from)
      range.setEnd(node, from + needle.length)
      ranges.push(range)
      from = text.indexOf(needle, from + needle.length)
    }
  }
  return ranges
}
