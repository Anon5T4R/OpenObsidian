import React from 'react'
import { useVaultStore } from '../../store/vaultStore'
import './BacklinksPanel.css'

interface BacklinksPanelProps {
  onFileSelect: (noteName: string) => void
}

export default function BacklinksPanel({ onFileSelect }: BacklinksPanelProps) {
  const { activeFile, backlinks } = useVaultStore()

  if (!activeFile) {
    return (
      <div className="backlinks-panel">
        <div className="backlinks-header">Backlinks</div>
        <div className="backlinks-empty">No file open</div>
      </div>
    )
  }

  const links = backlinks[activeFile.name] ?? []

  return (
    <div className="backlinks-panel">
      <div className="backlinks-header">
        Backlinks
        <span className="backlinks-count">{links.length}</span>
      </div>

      {links.length === 0 ? (
        <div className="backlinks-empty">No notes link here</div>
      ) : (
        <div className="backlinks-list">
          {links.map((name) => (
            <button key={name} className="backlink-item" onClick={() => onFileSelect(name)}>
              <span className="backlink-icon">←</span>
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
