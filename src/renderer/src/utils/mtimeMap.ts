import { TreeNode } from '../store/vaultStore'

export function buildMtimeMap(nodes: TreeNode[]): Record<string, number> {
  const map: Record<string, number> = {}
  const walk = (ns: TreeNode[]) => {
    for (const n of ns) {
      if (n.type === 'file') map[n.path] = n.mtime ?? 0
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return map
}
