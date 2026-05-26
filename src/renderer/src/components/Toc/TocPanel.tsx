import React, { useMemo } from 'react'
import './TocPanel.css'

interface Heading {
  level: number
  text: string
  id: string
}

interface TocPanelProps {
  content: string
  onJump: (id: string) => void
  onClose: () => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = []
  const idCounts: Record<string, number> = {}
  // Only match headings that aren't inside code blocks
  const lines = markdown.split('\n')
  let inCode = false
  for (const line of lines) {
    if (line.startsWith('```')) { inCode = !inCode; continue }
    if (inCode) continue
    const m = line.match(/^(#{1,3})\s+(.+)/)
    if (m) {
      const level = m[1].length
      const text = m[2].trim()
      let id = slugify(text)
      if (idCounts[id] !== undefined) { idCounts[id]++; id = `${id}-${idCounts[id]}` }
      else idCounts[id] = 0
      headings.push({ level, text, id })
    }
  }
  return headings
}

export default function TocPanel({ content, onJump, onClose }: TocPanelProps) {
  const headings = useMemo(() => extractHeadings(content), [content])

  return (
    <div className="toc-panel">
      <div className="toc-header">
        <span className="toc-title">Contents</span>
        <button className="toc-close" onClick={onClose} title="Close">✕</button>
      </div>
      <div className="toc-list">
        {headings.length === 0 ? (
          <div className="toc-empty">No headings found</div>
        ) : (
          headings.map((h, i) => (
            <button
              key={i}
              className={`toc-item toc-h${h.level}`}
              onClick={() => onJump(h.id)}
              title={h.text}
            >
              {h.text}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
