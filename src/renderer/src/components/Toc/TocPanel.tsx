import React, { useMemo } from 'react'
import { useT } from '../../i18n'
import './TocPanel.css'

interface Heading { level: number; text: string; id: string }

interface TocPanelProps {
  content: string
  onJump: (id: string) => void
  onClose: () => void
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/--+/g, '-').trim()
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = []
  const idCounts: Record<string, number> = {}
  let inCode = false
  for (const line of markdown.split('\n')) {
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
  const t = useT()
  const headings = useMemo(() => extractHeadings(content), [content])

  return (
    <div className="toc-panel">
      <div className="toc-header">
        <span className="toc-title">{t('tocTitle')}</span>
        <button className="toc-close" onClick={onClose} title={t('ctxCancelBtn')}>✕</button>
      </div>
      <div className="toc-list">
        {headings.length === 0 ? (
          <div className="toc-empty">{t('tocEmpty')}</div>
        ) : (
          headings.map((h, i) => (
            <button key={i} className={`toc-item toc-h${h.level}`} onClick={() => onJump(h.id)} title={h.text}>
              {h.text}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
