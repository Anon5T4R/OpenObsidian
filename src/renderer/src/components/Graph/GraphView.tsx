import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { useVaultStore, NoteFile } from '../../store/vaultStore'
import { useT } from '../../i18n'
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
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
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
      const s = nodeById.get(srcPath)
      const t = nodeById.get(targetPath)
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

// ── Layout memory ─────────────────────────────────────────────────────────
// Node positions and camera survive closing/reopening the graph (per vault,
// session-scoped) so the layout doesn't reshuffle on every open.

const savedPositions = new Map<string, Map<string, { x: number; y: number }>>()
const savedTransforms = new Map<string, d3.ZoomTransform>()

function vaultPositions(key: string): Map<string, { x: number; y: number }> {
  let m = savedPositions.get(key)
  if (!m) { m = new Map(); savedPositions.set(key, m) }
  return m
}

// ── Component ─────────────────────────────────────────────────────────────

interface GraphViewProps {
  onNodeClick: (file: NoteFile) => void
  onClose: () => void
}

function GraphView({ onNodeClick, onClose }: GraphViewProps) {
  const t = useT()
  const files      = useVaultStore((s) => s.files)
  const backlinks  = useVaultStore((s) => s.backlinks)
  const activeFile = useVaultStore((s) => s.activeFile)
  const vaultPath  = useVaultStore((s) => s.vaultPath)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [localMode, setLocalMode] = useState(false)
  const [search, setSearch] = useState('')
  const [nodeCount, setNodeCount] = useState(0)
  const [linkCount, setLinkCount] = useState(0)

  // Survive re-renders triggered by store updates (auto-save, watcher events):
  // keep the running simulation, the current zoom transform and node positions
  // so a rebuild doesn't reset the camera or scramble the layout.
  const posKey = vaultPath ?? ''
  const simulationRef = useRef<d3.Simulation<GNode, GLink> | null>(null)
  const zoomTransformRef = useRef<d3.ZoomTransform | null>(savedTransforms.get(posKey) ?? null)
  const positionsRef = useRef(vaultPositions(posKey))

  // Re-point the layout cache if the vault changes while the graph is mounted
  useEffect(() => {
    positionsRef.current = vaultPositions(posKey)
    zoomTransformRef.current = savedTransforms.get(posKey) ?? null
  }, [posKey])

  const theme = document.documentElement.getAttribute('data-theme') ?? 'dark'
  const isDark = theme !== 'light'

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return

    simulationRef.current?.stop()
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

    // Restore node positions from the previous render so data refreshes
    // (auto-save, watcher events) don't scramble the layout
    let restored = 0
    for (const n of nodes) {
      const p = positionsRef.current.get(n.id)
      if (p) { n.x = p.x; n.y = p.y; restored++ }
    }
    const allRestored = restored === nodes.length

    // ── Simulation ───────────────────────────────────────────────────────
    const simulation = d3
      .forceSimulation<GNode>(nodes)
      .force('link', d3.forceLink<GNode, GLink>(links).id((d) => d.id).distance(80).strength(0.5))
      .force('charge', d3.forceManyBody<GNode>().strength((d) => -120 - d.connections * 20))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GNode>().radius((d) => nodeR(d) + 6))
    if (allRestored) simulation.alpha(0.1) // layout already settled — just nudge
    simulationRef.current = simulation

    // ── Zoom ─────────────────────────────────────────────────────────────
    const g = svg.append('g')
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 6])
      .on('zoom', (e) => {
        g.attr('transform', e.transform.toString())
        zoomTransformRef.current = e.transform
        savedTransforms.set(posKey, e.transform)
      })
    svg.call(zoomBehavior)
    svg.on('dblclick.zoom', null) // disable dblclick zoom
    // Re-apply the camera from before the rebuild so the view doesn't jump
    if (zoomTransformRef.current) svg.call(zoomBehavior.transform, zoomTransformRef.current)

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

    nodeEls.append('title').text((d) =>
      `${d.name}\n${d.connections === 1 ? t('graphConnection', { n: d.connections }) : t('graphConnections', { n: d.connections })}`
    )

    // ── Tick ──────────────────────────────────────────────────────────────
    const ticked = () => {
      linkEls
        .attr('x1', (d) => (d.source as GNode).x ?? 0)
        .attr('y1', (d) => (d.source as GNode).y ?? 0)
        .attr('x2', (d) => (d.target as GNode).x ?? 0)
        .attr('y2', (d) => (d.target as GNode).y ?? 0)

      nodeEls.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)

      for (const n of nodes) {
        if (n.x != null && n.y != null) positionsRef.current.set(n.id, { x: n.x, y: n.y })
      }
    }
    simulation.on('tick', ticked)

    // Warm up fresh layouts synchronously so the first paint is already
    // settled. This lets the camera fit happen right here, at render time —
    // any deferred fit (e.g. on simulation 'end', seconds after opening) is
    // exactly the "camera zooms out on its own" bug.
    if (!allRestored) {
      const warmTicks = nodes.length > 1500 ? 80 : nodes.length > 600 ? 150 : 300
      simulation.tick(warmTicks) // tick() doesn't emit events — painted below
    }
    ticked()

    // Fit the camera instantly when there is none to restore (first open of
    // the session, Local/search change, vault switch). After this point the
    // camera only ever moves through user input.
    if (!zoomTransformRef.current) {
      const bounds = (g.node() as SVGGElement).getBBox()
      if (bounds.width && bounds.height) {
        const scale = Math.min(0.9, 0.9 * Math.min(width / bounds.width, height / bounds.height))
        const tx = width / 2 - scale * (bounds.x + bounds.width / 2)
        const ty = height / 2 - scale * (bounds.y + bounds.height / 2)
        svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
      }
    }
  }, [files, backlinks, activeFile, localMode, search, theme, posKey, t, isDark, onNodeClick])

  // Changing the visible subset is a deliberate action — reset the camera so
  // the new subset gets auto-fitted (declared before the render effect below).
  // Skipped on mount, otherwise it would wipe the camera restored from the
  // previous time the graph was open.
  const subsetMountRef = useRef(true)
  useEffect(() => {
    if (subsetMountRef.current) { subsetMountRef.current = false; return }
    zoomTransformRef.current = null
    savedTransforms.delete(posKey)
  }, [localMode, search, posKey])

  useEffect(() => {
    render()
    return () => { simulationRef.current?.stop() }
  }, [render])

  // Re-render on resize (skip the initial fire on observe, coalesce bursts)
  useEffect(() => {
    if (!containerRef.current) return
    let first = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(() => {
      // Skip the automatic fire on observe — unless the initial render bailed
      // out (container had no size yet), in which case this is our chance
      if (first) {
        first = false
        if (svgRef.current?.hasChildNodes()) return
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(render, 150)
    })
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); if (timer) clearTimeout(timer) }
  }, [render])

  return (
    <div className="graph-overlay">
      <div className="graph-header">
        <div className="graph-title">
          <span className="graph-icon">◎</span>
          <span>{t('graphTitle')}</span>
          <span className="graph-stats">{t('graphStats', { notes: nodeCount, links: linkCount })}</span>
        </div>

        <div className="graph-controls">
          <div className="graph-search-wrap">
            <input
              placeholder={t('graphSearchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button onClick={() => setSearch('')}>✕</button>}
          </div>

          <button
            className={`graph-btn ${localMode ? 'active' : ''}`}
            onClick={() => setLocalMode((l) => !l)}
            title={t('graphLocalTip')}
          >
            {t('graphLocal')}
          </button>

          <button className="graph-close" onClick={onClose} title={t('graphCloseTip')}>✕</button>
        </div>
      </div>

      <div className="graph-canvas" ref={containerRef}>
        <svg ref={svgRef} />
        {nodeCount === 0 && (
          <div className="graph-empty">
            {files.length === 0
              ? t('graphEmptyNoVault')
              : localMode
              ? t('graphEmptyLocal')
              : t('graphEmptyNoLinks')}
          </div>
        )}
      </div>

      <div className="graph-legend">
        <span>{t('graphLegendZoom')}</span>
        <span>·</span>
        <span>{t('graphLegendPan')}</span>
        <span>·</span>
        <span>{t('graphLegendOpen')}</span>
        <span>·</span>
        <span>{t('graphLegendHighlight')}</span>
      </div>
    </div>
  )
}

function nodeR(d: GNode) {
  return Math.max(5, Math.min(18, 5 + d.connections * 2.5))
}

export default React.memo(GraphView)
