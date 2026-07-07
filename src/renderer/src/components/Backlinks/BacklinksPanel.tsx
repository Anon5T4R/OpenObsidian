import React from 'react'
import { useVaultStore } from '../../store/vaultStore'
import { useT } from '../../i18n'
import './BacklinksPanel.css'

interface BacklinksPanelProps {
  onFileSelect: (noteName: string) => void
}

// Memo + narrow selectors: editor keystrokes update activeContent in the store,
// which must not re-render this panel
function BacklinksPanel({ onFileSelect }: BacklinksPanelProps) {
  const activeFile = useVaultStore((s) => s.activeFile)
  const backlinks  = useVaultStore((s) => s.backlinks)
  const t = useT()

  if (!activeFile) {
    return (
      <div className="backlinks-panel">
        <div className="backlinks-header">{t('backlinks')}</div>
        <div className="backlinks-empty">{t('noFileOpen')}</div>
      </div>
    )
  }

  const links = backlinks[activeFile.name] ?? []

  return (
    <div className="backlinks-panel">
      <div className="backlinks-header">
        {t('backlinks')}
        <span className="backlinks-count">{links.length}</span>
      </div>

      {links.length === 0 ? (
        <div className="backlinks-empty">{t('noBacklinks')}</div>
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

export default React.memo(BacklinksPanel)
