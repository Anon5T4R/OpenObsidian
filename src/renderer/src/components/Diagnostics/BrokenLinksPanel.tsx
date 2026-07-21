import React, { useMemo } from 'react'
import { useVaultStore, NoteFile } from '../../store/vaultStore'
import { findUnresolvedLinks } from '../../utils/linkResolver'
import { useT } from '../../i18n'
import './BrokenLinksPanel.css'

interface BrokenLinksPanelProps {
  onFileSelect: (file: NoteFile) => void
  onClose: () => void
}

// Lives in the main area, not the sidebar: the file tree has to stay usable
export default function BrokenLinksPanel({ onFileSelect, onClose }: BrokenLinksPanelProps) {
  const files     = useVaultStore((s) => s.files)
  const backlinks = useVaultStore((s) => s.backlinks)
  const t = useT()

  const broken = useMemo(() => findUnresolvedLinks(backlinks, files), [backlinks, files])
  const total  = broken.reduce((sum, b) => sum + b.sources.length, 0)

  const openSource = (name: string) => {
    const file = files.find((f) => f.name.toLowerCase() === name.toLowerCase())
    if (file) onFileSelect(file)
  }

  return (
    <div className="broken-panel" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="broken-header">
        <span className="broken-title">🔗 {t('brokenTitle')}</span>
        <button className="broken-close" onClick={onClose}>{t('searchClose')}</button>
      </div>

      <div className="broken-body">
        {broken.length === 0 ? (
          <div className="broken-empty">✅ {t('brokenNone')}</div>
        ) : (
          <>
            <div className="broken-summary">{t('brokenSummary', { links: total, targets: broken.length })}</div>
            {broken.map(({ target, sources }) => (
              <div key={target} className="broken-group">
                <div className="broken-target">
                  <span className="broken-target-name">[[{target}]]</span>
                  <span className="broken-count">{sources.length}</span>
                </div>
                {sources.map((name) => (
                  <button key={name} className="broken-source" onClick={() => openSource(name)}>
                    <span className="broken-arrow">←</span>{name}
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
