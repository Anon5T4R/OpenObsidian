import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'
import mermaid from 'mermaid'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './MarkdownPreview.css'

// ── Callout / admonition support ───────────────────────────────────────────

const CALLOUT_META: Record<string, { icon: string; color: string }> = {
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
}

const CALLOUT_RE = /<blockquote>\n?<p>\[!(\w+)\]([-+])?([^\n<]*)(?:\n([\s\S]*?))?<\/p>([\s\S]*?)<\/blockquote>/g

function processCallouts(html: string): string {
  return html.replace(CALLOUT_RE, (_, type, fold, titleRest, bodyInP, bodyExtra) => {
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
  })
}

// ── Math (KaTeX) ───────────────────────────────────────────────────────────

// Split on code blocks so math inside ``` is never processed
const CODE_BLOCK_RE = /(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/g

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

// ── Highlight syntax ==text== ─────────────────────────────────────────────

function processHighlights(html: string): string {
  const parts = html.split(CODE_BLOCK_RE)
  return parts.map((part, i) => {
    if (i % 2 === 1) return part
    return part.replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
  }).join('')
}

// ── Heading IDs for TOC anchor scrolling ─────────────────────────────────

function addHeadingIds(html: string): string {
  const counts: Record<string, number> = {}
  return html.replace(/<h([1-3])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, '')
    let id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/--+/g, '-').trim()
    if (counts[id] !== undefined) { counts[id]++; id = `${id}-${counts[id]}` }
    else counts[id] = 0
    return `<h${level} id="${id}">${inner}</h${level}>`
  })
}

// ── Mermaid diagram support ────────────────────────────────────────────────

function getMermaidTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark'
}

// remark-html HTML-escapes code block content; decode before passing to mermaid
function decodeMermaidCode(code: string): string {
  return code
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

interface MarkdownPreviewProps {
  content: string
  onWikiLinkClick: (noteName: string) => void
  onChange?: (content: string) => void
  vaultPath?: string | null
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

function processWikiLinks(md: string): string {
  return md.replace(WIKILINK_RE, (_, target, alias) => {
    const display = alias ?? target
    return `<a href="#" class="wikilink" data-target="${target}">${display}</a>`
  })
}

// Toggle the nth - [ ] / - [x] occurrence in raw markdown
function toggleCheckbox(markdown: string, index: number): string {
  let count = -1
  return markdown.replace(/- \[[ xX]\]/g, (match) => {
    count++
    if (count === index) {
      return /\[[ ]\]/.test(match) ? '- [x]' : '- [ ]'
    }
    return match
  })
}

export default function MarkdownPreview({ content, onWikiLinkClick, onChange, vaultPath }: MarkdownPreviewProps) {
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

  const html = useMemo(() => {
    const withLinks = processWikiLinks(content)
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
  }, [content, vaultPath])

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
              <button onClick={() => setZoom(1)}>Reset</button>
              <span className="mermaid-zoom-hint">scroll wheel to zoom · drag to scroll</span>
              <button className="mermaid-zoom-close" onClick={() => setZoomModal(null)} title="Close (Esc)">✕</button>
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
