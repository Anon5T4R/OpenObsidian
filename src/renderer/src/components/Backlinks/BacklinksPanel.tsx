import React, { useCallback, useState } from 'react'
import { useVaultStore } from '../../store/vaultStore'
import { useT } from '../../i18n'
import './BacklinksPanel.css'

interface BacklinksPanelProps {
  onFileSelect: (noteName: string) => void
}

const COLLAPSED_KEY = 'oo-backlinks-collapsed'

// Memo + narrow selectors: editor keystrokes update activeContent in the store,
// which must not re-render this panel
function BacklinksPanel({ onFileSelect }: BacklinksPanelProps) {
  const activeFile = useVaultStore((s) => s.activeFile)
  const backlinks  = useVaultStore((s) => s.backlinks)
  const t = useT()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      return !c
    })
  }, [])

  const links = activeFile ? backlinks[activeFile.name] ?? [] : []

  const header = (
    <button className="backlinks-header" onClick={toggle} title={t('backlinksToggle')}>
      {t('backlinks')}
      {activeFile && <span className="backlinks-count">{links.length}</span>}
      <span className="backlinks-fold">▾</span>
    </button>
  )

  if (collapsed) {
    return <div className="backlinks-panel collapsed">{header}</div>
  }

  if (!activeFile) {
    return (
      <div className="backlinks-panel">
        {header}
        <div className="backlinks-empty">{t('noFileOpen')}</div>
      </div>
    )
  }

  return (
    <div className="backlinks-panel">
      {header}

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
