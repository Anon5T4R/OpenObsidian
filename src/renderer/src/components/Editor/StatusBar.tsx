import React from 'react'
import { EditorStats } from './MarkdownEditor'
import { useT } from '../../i18n'
import './StatusBar.css'

interface StatusBarProps {
  stats: EditorStats
  filename?: string
  onOpenFind?: () => void
  /** Cards waiting for review across the vault */
  cardsDue?: number
  onReview?: () => void
}

export default function StatusBar({ stats, filename, onOpenFind, cardsDue = 0, onReview }: StatusBarProps) {
  const t = useT()
  return (
    <div className="status-bar">
      <div className="status-left">
        {filename && <span className="status-filename">{filename}</span>}
      </div>
      <div className="status-right">
        {cardsDue > 0 && onReview && (
          <>
            <button className="status-btn status-due" onClick={onReview} title={t('ttReviewDue', { count: cardsDue })}>
              🃏 {cardsDue}
            </button>
            <span className="status-sep">·</span>
          </>
        )}
        <span className="status-item">{t('statusWords', { count: stats.words.toLocaleString() })}</span>
        <span className="status-sep">·</span>
        <span className="status-item">{t('statusChars', { count: stats.chars.toLocaleString() })}</span>
        <span className="status-sep">·</span>
        <span className="status-item">{t('statusLnCol', { line: stats.line, col: stats.col })}</span>
        {onOpenFind && (
          <>
            <span className="status-sep">·</span>
            <button className="status-btn" onClick={onOpenFind} title={t('ttFind')}>
              {t('statusFind')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
