import React from 'react'
import { EditorStats } from './MarkdownEditor'
import './StatusBar.css'

interface StatusBarProps {
  stats: EditorStats
  filename?: string
  onOpenFind?: () => void
}

export default function StatusBar({ stats, filename, onOpenFind }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-left">
        {filename && <span className="status-filename">{filename}</span>}
      </div>
      <div className="status-right">
        <span className="status-item">{stats.words.toLocaleString()} words</span>
        <span className="status-sep">·</span>
        <span className="status-item">{stats.chars.toLocaleString()} chars</span>
        <span className="status-sep">·</span>
        <span className="status-item">Ln {stats.line}  Col {stats.col}</span>
        {onOpenFind && (
          <>
            <span className="status-sep">·</span>
            <button className="status-btn" onClick={onOpenFind} title="Find & Replace (Ctrl+F)">
              Find
            </button>
          </>
        )}
      </div>
    </div>
  )
}
