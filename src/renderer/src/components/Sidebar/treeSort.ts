import type { TreeNode } from '../../store/vaultStore'
import type { SidebarSort } from '../../hooks/useSettings'

// Sorts one level of the tree. Loose files come first, folders last — so a folder's
// indented children never butt up against a same-level sibling file when expanded.
// Within each group, entries follow the chosen sort order.
export function sortNodes(nodes: TreeNode[], sort: SidebarSort): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'file' ? -1 : 1
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'name-desc') return b.name.localeCompare(a.name)
    if (sort === 'modified') return (b.mtime ?? 0) - (a.mtime ?? 0)
    return 0
  })
}
