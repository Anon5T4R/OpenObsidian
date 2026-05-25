import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { useVaultStore, NoteFile } from '../../store/vaultStore'
import './GraphView.css'

// ── Types ─────────────────────────────────────────────────────────────────

interface GNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  path: string
  connections: number
  folder: string
}

interface GLink extends d3.SimulationLinkDatum<GNode> {
  source: string | GNode
  target: string | GNode
}

interface GraphData {
  nodes: GNode[]
  links: GLink[]
}

// ── Data builder ──────────────────────────────────────────────────────────

function buildGraph(files: NoteFile[], backlinks: Record<string, string[]>): GraphData {
  const nodes: GNode[] = files.map((f) => ({
    id: f.path,
    name: f.name,
    path: f.path,
    connections: 0,
    folder: f.relativePath.includes('/') || f.relativePath.includes('\\')
      ? f.relativePath.split(/[/\\]/)[0]
      : ''
  }))

  const nodeByName = new Map(files.map((f) => [f.name.toLowerCase(), f.path]))
  const links: GLink[] = []
  const seen = new Set<string>()

  for (const [targetName, sources] of Object.entries(backlinks)) {
    const targetPath = nodeByName.get(targetName.toLowerCase())
    if (!targetPath) continue
    for (const srcName of sources) {
      const srcPath = nodeByName.get(srcName.toLowerCase())
      if (!srcPath || srcPath === targetPath) continue
      const key = [srcPath, targetPath].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ source: srcPath, target: targetPath })
      const s = nodes.find((n) => n.id === srcPath)
      const t = nodes.find((n) => n.id === targetPath)
      if (s) s.connections++
      if (t) t.connections++
    }
  }

  return { nodes, links }
}

// ── Colour palette per folder ─────────────────────────────────────────────

const PALETTE = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#0891b2', '#65a30d'
]

function folderColor(folders: string[], folder: string, active: boolean, theme: string) {
  if (active) return theme === 'light' ? '#7c3aed' : '#a78bfa'
  if (!folder) return theme === 'light' ? '#94a3b8' : '#64748b'
  const idx = folders.indexOf(folder) % PALETTE.length
  return PALETTE[Math.max(0, idx)]
}

// ── Drag helper ───────────────────────────────────────────────────────────

function drag(sim: d3.Simulation<GNode, GLink>) {
  return d3
    .drag<SVGGElement, GNode>()
    .on('start', (e, d) => {
      if (!e.active) sim.alphaTarget(0.3).restart()
      d.fx = d.x; d.fy = d.y
    })
    .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
    .on('end', (e, d) => {
      if (!e.active) sim.alphaTarget(0)
      d.fx = null; d.fy = null
    })
}

// ── Component ─────────────────────────────────────────────────────────────

interface GraphViewProps {
  onNodeClick: (file: NoteFile) => void
  onClose: () => void
}

export default function GraphView({ onNodeClick, onClose }: GraphViewProps) {
  const { files, backlinks, activeFile } = useVaultStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [localMode, setLocalMode] = useState(false)
  const [search, setSearch] = useState('')
  const [nodeCount, setNodeCount] = useState(0)
  const [linkCount, setLinkCount] = useState(0)

  const theme = document.documentElement.getAttribute('data-theme') ?? 'dark'
  const isDark = theme !== 'light'

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = containerRef.current.getBoundingClientRect()
    if (!width || !height) return

    svg.attr('width', width).attr('height', height)

    let { nodes, links } = buildGraph(files, backlinks)

    // Local mode: only show nodes connected to active note
    if (localMode && activeFile) {
      const local = new Set<string>()
      local.add(activeFile.path)
      for (const l of links) {
        const s = typeof l.source === 'string' ? l.source : (l.source as GNode).id
        const t = typeof l.target === 'string' ? l.target : (l.target as GNode).id
        if (s === activeFile.path || t === activeFile.path) {
          local.add(s); local.add(t)
        }
      }
      nodes = nodes.filter((n) => local.has(n.id))
      links = links.filter((l) => {
        const s = typeof l.source === 'string' ? l.source : (l.source as GNode).id
        const t = typeof l.target === 'string' ? l.target : (l.target as GNode).id
        return local.has(s) && local.has(t)
      })
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      const matched = new Set(nodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id))
      // Keep matched + their immediate neighbors
      for (const l of links) {
        const s = typeof l.source === 'string' ? l.source : (l.source as GNode).id
        const t = typeof l.target === 'string' ? l.target : (l.target as GNode).id
        if (matched.has(s)) matched.add(t)
        if (matched.has(t)) matched.add(s)
      }
      nodes = nodes.filter((n) => matched.has(n.id))
      links = links.filter((l) => {
        const s = typeof l.source === 'string' ? l.source : (l.source as GNode).id
        const t = typeof l.target === 'string' ? l.target : (l.target as GNode).id
        return matched.has(s) && matched.has(t)
      })
    }

    setNodeCount(nodes.length)
    setLinkCount(links.length)

    if (nodes.length === 0) return

    const folders = [...new Set(nodes.map((n) => n.folder).filter(Boolean))]

    // ── Simulation ───────────────────────────────────────────────────────
    const simulation = d3
      .forceSimulation<GNode>(nodes)
      .force('link', d3.forceLink<GNode, GLink>(links).id((d) => d.id).distance(80).strength(0.5))
      .force('charge', d3.forceManyBody<GNode>().strength((d) => -120 - d.connections * 20))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GNode>().radius((d) => nodeR(d) + 6))

    // ── Zoom ─────────────────────────────────────────────────────────────
    const g = svg.append('g')
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 6])
      .on('zoom', (e) => g.attr('transform', e.transform.toString()))
    svg.call(zoomBehavior)
    svg.on('dblclick.zoom', null) // disable dblclick zoom

    // ── Links ─────────────────────────────────────────────────────────────
    const linkEls = g
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, GLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', isDark ? '#334155' : '#cbd5e1')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.7)

    // ── Nodes ─────────────────────────────────────────────────────────────
    const nodeEls = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group')
      .call(drag(simulation) as any)
      .on('click', (_e, d) => {
        const file = files.find((f) => f.path === d.id)
        if (file) onNodeClick(file)
      })
      .on('mouseenter', function (_e, d) {
        d3.select(this).select('circle').attr('stroke-width', 3)
        // Highlight connected links
        linkEls
          .attr('stroke-opacity', (l) => {
            const s = typeof l.source === 'string' ? l.source : (l.source as GNode).id
            const t = typeof l.target === 'string' ? l.target : (l.target as GNode).id
            return s === d.id || t === d.id ? 1 : 0.15
          })
          .attr('stroke-width', (l) => {
            const s = typeof l.source === 'string' ? l.source : (l.source as GNode).id
            const t = typeof l.target === 'string' ? l.target : (l.target as GNode).id
            return s === d.id || t === d.id ? 2.5 : 1.5
          })
      })
      .on('mouseleave', function () {
        d3.select(this).select('circle').attr('stroke-width', 1.5)
        linkEls.attr('stroke-opacity', 0.7).attr('stroke-width', 1.5)
      })

    nodeEls
      .append('circle')
      .attr('r', (d) => nodeR(d))
      .attr('fill', (d) => folderColor(folders, d.folder, d.id === activeFile?.path, theme))
      .attr('stroke', isDark ? '#1e293b' : '#fff')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')

    // Labels (only visible when zoomed in or for high-connection nodes)
    nodeEls
      .append('text')
      .text((d) => d.name)
      .attr('x', (d) => nodeR(d) + 4)
      .attr('y', 4)
      .attr('font-size', 11)
      .attr('fill', isDark ? '#94a3b8' : '#64748b')
      .attr('pointer-events', 'none')
      .attr('class', (d) => (d.connections > 2 ? 'label-always' : 'label-zoom'))

    nodeEls.append('title').text((d) => `${d.name}\n${d.connections} connection${d.connections !== 1 ? 's' : ''}`)

    // ── Tick ──────────────────────────────────────────────────────────────
    simulation.on('tick', () => {
      linkEls
        .attr('x1', (d) => (d.source as GNode).x ?? 0)
        .attr('y1', (d) => (d.source as GNode).y ?? 0)
        .attr('x2', (d) => (d.target as GNode).x ?? 0)
        .attr('y2', (d) => (d.target as GNode).y ?? 0)

      nodeEls.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Auto-fit after simulation settles
    simulation.on('end', () => {
      const bounds = (g.node() as SVGGElement).getBBox()
      if (!bounds.width || !bounds.height) return
      const scale = Math.min(0.9, 0.9 * Math.min(width / bounds.width, height / bounds.height))
      const tx = width / 2 - scale * (bounds.x + bounds.width / 2)
      const ty = height / 2 - scale * (bounds.y + bounds.height / 2)
      svg.transition().duration(600).call(
        zoomBehavior.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      )
    })

    return () => simulation.stop()
  }, [files, backlinks, activeFile, localMode, search, theme])

  useEffect(() => {
    const cleanup = render()
    return cleanup
  }, [render])

  // Re-render on resize
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => render())
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [render])

  return (
    <div className="graph-overlay">
      <div className="graph-header">
        <div className="graph-title">
          <span className="graph-icon">◎</span>
          <span>Graph View</span>
          <span className="graph-stats">{nodeCount} notes · {linkCount} links</span>
        </div>

        <div className="graph-controls">
          <div className="graph-search-wrap">
            <input
              placeholder="Search nodes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button onClick={() => setSearch('')}>✕</button>}
          </div>

          <button
            className={`graph-btn ${localMode ? 'active' : ''}`}
            onClick={() => setLocalMode((l) => !l)}
            title="Show only notes connected to current note"
          >
            Local
          </button>

          <button className="graph-close" onClick={onClose} title="Close (Ctrl+G)">✕</button>
        </div>
      </div>

      <div className="graph-canvas" ref={containerRef}>
        <svg ref={svgRef} />
        {nodeCount === 0 && (
          <div className="graph-empty">
            {files.length === 0
              ? 'Open a vault with notes to see the graph'
              : localMode
              ? 'Current note has no connections'
              : 'No connections found — add [[WikiLinks]] between notes'}
          </div>
        )}
      </div>

      <div className="graph-legend">
        <span>Scroll to zoom</span>
        <span>·</span>
        <span>Drag to pan</span>
        <span>·</span>
        <span>Click node to open</span>
        <span>·</span>
        <span>Hover to highlight</span>
      </div>
    </div>
  )
}

function nodeR(d: GNode) {
  return Math.max(5, Math.min(18, 5 + d.connections * 2.5))
}
