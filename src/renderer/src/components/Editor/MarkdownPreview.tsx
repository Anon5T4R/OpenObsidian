import React, { useMemo, useRef, useEffect, useState, useCallback, useDeferredValue } from 'react'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'
import mermaid from 'mermaid'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  CODE_BLOCK_RE,
  processCallouts,
  processHighlights,
  addHeadingIds,
  decodeMermaidCode,
  processWikiLinks,
  toggleCheckbox,
} from './markdownTransforms'
import { useT } from '../../i18n'
import './MarkdownPreview.css'

// ── Math (KaTeX) ───────────────────────────────────────────────────────────

function processMath(html: string): string {
  const parts = html.split(CODE_BLOCK_RE)
  return parts.map((part, i) => {
    if (i % 2 === 1) return part // inside a code block — skip
    // Block math: $$...$$ and \[...\]
    part = part.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
      try {
        return `<div class="math-block">${katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false })}</div>`
      } catch { return `<span class="math-error">$$${tex}$$</span>` }
    })
    part = part.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => {
      try {
        return `<div class="math-block">${katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false })}</div>`
      } catch { return `<span class="math-error">\\[${tex}\\]</span>` }
    })
    // Inline math: $...$ (requires non-space after opening $)
    part = part.replace(/\$(?!\s)([^$\n<>]+?)(?<!\s)\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false })
      } catch { return `<span class="math-error">$${tex}$</span>` }
    })
    // Inline math: \(...\)
    part = part.replace(/\\\((.+?)\\\)/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false })
      } catch { return `<span class="math-error">\\(${tex}\\)</span>` }
    })
    return part
  }).join('')
}

// ── Mermaid diagram support ────────────────────────────────────────────────

function getMermaidTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark'
}

interface MarkdownPreviewProps {
  content: string
  onWikiLinkClick: (noteName: string) => void
  onChange?: (content: string) => void
  vaultPath?: string | null
}

export default function MarkdownPreview({ content, onWikiLinkClick, onChange, vaultPath }: MarkdownPreviewProps) {
  const t = useT()
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Mermaid zoom modal ────────────────────────────────────────────────────
  type ZoomModal = { html: string; w: number; h: number }
  const [zoomModal, setZoomModal] = useState<ZoomModal | null>(null)
  const [zoom, setZoom]           = useState(1)

  useEffect(() => {
    if (!zoomModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomModal(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomModal])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.max(0.2, Math.min(6, z - e.deltaY * 0.0008)))
  }, [])

  // Defer the pipeline (remark + KaTeX + regex passes) so fast typing stays
  // responsive in split mode — the preview catches up when React is idle
  const deferredContent = useDeferredValue(content)

  const html = useMemo(() => {
    const withLinks = processWikiLinks(deferredContent)
    const result = remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).processSync(withLinks)
    let h = String(result)
      // Remove "disabled" from checkboxes so they are clickable in preview
      .replace(/(<input\b[^>]*?) disabled/g, '$1')
    h = processCallouts(h)
    h = processHighlights(h)
    h = processMath(h)
    h = addHeadingIds(h)
    // Wrap mermaid code blocks
    h = h.replace(
      /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
      (_, code) => `<div class="mermaid-block"><pre class="mermaid">${decodeMermaidCode(code)}</pre></div>`
    )
    // Resolve relative image paths to absolute file:// URLs
    if (vaultPath) {
      const base = 'file:///' + vaultPath.replace(/\\/g, '/')
      h = h.replace(/src="(?!https?:\/\/|data:|file:\/\/)([^"]+)"/g, (_, rel) => {
        return `src="${base}/${rel}"`
      })
    }
    return h
  }, [deferredContent, vaultPath])

  // Render mermaid diagrams after HTML is injected into the DOM
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('pre.mermaid'))
    if (nodes.length === 0) return
    mermaid.initialize({ startOnLoad: false, theme: getMermaidTheme(), securityLevel: 'loose' })
    mermaid.run({ nodes }).catch(console.error)
  }, [html])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement

    // Mermaid diagram zoom
    const mermaidBlock = target.closest?.('.mermaid-block') as HTMLElement | null
    if (mermaidBlock) {
      const svg = mermaidBlock.querySelector('svg')
      if (svg) {
        const rect = svg.getBoundingClientRect()
        setZoomModal({ html: svg.outerHTML, w: rect.width || 800, h: rect.height || 600 })
        setZoom(1)
        return
      }
    }

    // Interactive checkbox
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      e.preventDefault()
      if (!onChange) return
      const container = e.currentTarget
      const all = Array.from(container.querySelectorAll('input[type="checkbox"]'))
      const idx = all.indexOf(target)
      if (idx !== -1) onChange(toggleCheckbox(content, idx))
      return
    }

    // WikiLink navigation
    if (target.classList.contains('wikilink')) {
      e.preventDefault()
      const noteName = target.getAttribute('data-target')
      if (noteName) onWikiLinkClick(noteName)
    }
  }

  return (
    <>
      <div
        ref={containerRef}
        className="markdown-preview"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {zoomModal && (
        <div className="mermaid-zoom-overlay" onClick={() => setZoomModal(null)}>
          <div className="mermaid-zoom-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="mermaid-zoom-toolbar">
              <button onClick={() => setZoom((z) => Math.min(6, z + 0.25))}>+</button>
              <span className="mermaid-zoom-pct">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.25))}>−</button>
              <button onClick={() => setZoom(1)}>{t('mermaidReset')}</button>
              <span className="mermaid-zoom-hint">{t('mermaidZoomHint')}</span>
              <button className="mermaid-zoom-close" onClick={() => setZoomModal(null)} title={t('mermaidCloseTip')}>✕</button>
            </div>
            <div className="mermaid-zoom-view" onWheel={handleWheel}>
              <div style={{ width: zoomModal.w * zoom, height: zoomModal.h * zoom, position: 'relative', flexShrink: 0 }}>
                <div
                  style={{ position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: `scale(${zoom})` }}
                  dangerouslySetInnerHTML={{ __html: zoomModal.html }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
