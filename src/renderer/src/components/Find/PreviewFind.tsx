import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'
import { collectRanges } from '../../utils/textRanges'
import './PreviewFind.css'

interface PreviewFindProps {
  /** Re-runs the search when the rendered note changes underneath it */
  content: string
  /** Bumped on every Ctrl+F so the shortcut re-focuses an already open bar */
  focusToken?: number
  onClose: () => void
}

const ALL = 'oo-find'
const CURRENT = 'oo-find-current'

// The CSS Custom Highlight API paints ranges without touching the DOM — which
// matters here, because the preview replaces its innerHTML on every render.
const highlightsAvailable = () => typeof CSS !== 'undefined' && 'highlights' in CSS

function clearHighlights(): void {
  if (!highlightsAvailable()) return
  CSS.highlights.delete(ALL)
  CSS.highlights.delete(CURRENT)
}

export default function PreviewFind({ content, focusToken = 0, onClose }: PreviewFindProps) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [total, setTotal] = useState(0)
  const [current, setCurrent] = useState(0)
  const rangesRef = useRef<Range[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [focusToken])
  useEffect(() => clearHighlights, [])

  const scrollTo = useCallback((range: Range) => {
    const preview = document.querySelector('.markdown-preview')
    if (!preview) return
    const box = range.getBoundingClientRect()
    const view = preview.getBoundingClientRect()
    if (box.top < view.top || box.bottom > view.bottom) {
      preview.scrollTop += box.top - view.top - view.height / 3
    }
  }, [])

  const paint = useCallback((index: number) => {
    if (!highlightsAvailable()) return
    const ranges = rangesRef.current
    if (ranges.length === 0) { clearHighlights(); return }
    const active = ranges[Math.min(index, ranges.length - 1)]
    CSS.highlights.set(ALL, new Highlight(...ranges.filter((r) => r !== active)))
    CSS.highlights.set(CURRENT, new Highlight(active))
    scrollTo(active)
  }, [scrollTo])

  // Debounced so typing in a long note stays responsive, like SearchPanel
  useEffect(() => {
    const run = () => {
      const preview = document.querySelector('.markdown-preview')
      const ranges = preview ? collectRanges(preview, query.trim()) : []
      rangesRef.current = ranges
      setTotal(ranges.length)
      setCurrent(0)
      if (ranges.length === 0) clearHighlights()
      else paint(0)
    }
    const timer = setTimeout(run, 150)
    return () => clearTimeout(timer)
  }, [query, content, paint])

  const step = useCallback((delta: number) => {
    const n = rangesRef.current.length
    if (n === 0) return
    const next = (current + delta + n) % n
    setCurrent(next)
    paint(next)
  }, [current, paint])

  const close = useCallback(() => { clearHighlights(); onClose() }, [onClose])

  return (
    <div className="preview-find" onKeyDown={(e) => {
      if (e.key === 'Escape') { e.preventDefault(); close() }
      if (e.key === 'Enter')  { e.preventDefault(); step(e.shiftKey ? -1 : 1) }
    }}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('findPlaceholder')}
      />
      <span className={`preview-find-count ${query && total === 0 ? 'none' : ''}`}>
        {query.trim() === '' ? '' : total === 0 ? t('findNoMatches') : t('findCount', { current: current + 1, total })}
      </span>
      <button onClick={() => step(-1)} disabled={total === 0} title={t('findPrev')}>↑</button>
      <button onClick={() => step(1)}  disabled={total === 0} title={t('findNext')}>↓</button>
      <button onClick={close} title={t('findClose')}>✕</button>
    </div>
  )
}
