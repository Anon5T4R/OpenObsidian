import React, { useMemo, useState } from 'react'
import { useVaultStore, NoteFile } from '../../store/vaultStore'
import { buildAliasIndex, findUnresolvedLinks, findNameCollisions, findOrphanNotes } from '../../utils/linkResolver'
import { useT } from '../../i18n'
import './VaultDiagnosticsPanel.css'

interface VaultDiagnosticsPanelProps {
  onFileSelect: (file: NoteFile) => void
  onClose: () => void
}

type Tab = 'broken' | 'orphans' | 'collisions'

// Lives in the main area, not the sidebar: the file tree has to stay usable
export default function VaultDiagnosticsPanel({ onFileSelect, onClose }: VaultDiagnosticsPanelProps) {
  const files       = useVaultStore((s) => s.files)
  const backlinks   = useVaultStore((s) => s.backlinks)
  const frontmatter = useVaultStore((s) => s.frontmatter)
  const t = useT()
  const [tab, setTab] = useState<Tab>('broken')

  const aliases    = useMemo(() => buildAliasIndex(frontmatter), [frontmatter])
  const broken     = useMemo(() => findUnresolvedLinks(backlinks, files, aliases), [backlinks, files, aliases])
  const orphans    = useMemo(() => findOrphanNotes(files, backlinks), [files, backlinks])
  const collisions = useMemo(() => findNameCollisions(files), [files])

  const brokenLinks = broken.reduce((sum, b) => sum + b.sources.length, 0)

  const openByName = (name: string) => {
    const file = files.find((f) => f.name.toLowerCase() === name.toLowerCase())
    if (file) onFileSelect(file)
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'broken',     label: t('diagBroken'),     count: broken.length },
    { id: 'orphans',    label: t('diagOrphans'),    count: orphans.length },
    { id: 'collisions', label: t('diagCollisions'), count: collisions.length },
  ]

  return (
    <div className="diag-panel" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="diag-header">
        <span className="diag-title">🩺 {t('diagTitle')}</span>
        <button className="diag-close" onClick={onClose}>{t('searchClose')}</button>
      </div>

      <div className="diag-tabs">
        {TABS.map(({ id, label, count }) => (
          <button
            key={id}
            className={`diag-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
            <span className={`diag-tab-count ${count === 0 ? 'zero' : ''}`}>{count}</span>
          </button>
        ))}
      </div>

      <div className="diag-body">
        {tab === 'broken' && (
          broken.length === 0 ? <div className="diag-empty">✅ {t('diagBrokenNone')}</div> : (
            <>
              <div className="diag-summary">{t('diagBrokenSummary', { links: brokenLinks, targets: broken.length })}</div>
              {broken.map(({ target, sources }) => (
                <div key={target} className="diag-group">
                  <div className="diag-item">
                    <span className="diag-dead">[[{target}]]</span>
                    <span className="diag-count">{sources.length}</span>
                  </div>
                  {sources.map((name) => (
                    <button key={name} className="diag-sub" onClick={() => openByName(name)}>
                      <span className="diag-arrow">←</span>{name}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )
        )}

        {tab === 'orphans' && (
          orphans.length === 0 ? <div className="diag-empty">✅ {t('diagOrphansNone')}</div> : (
            <>
              <div className="diag-summary">{t('diagOrphansSummary', { count: orphans.length })}</div>
              {orphans.map((file) => (
                <button key={file.path} className="diag-sub" onClick={() => onFileSelect(file)}>
                  <span className="diag-arrow">📄</span>{file.name}
                  <span className="diag-path">{file.relativePath}</span>
                </button>
              ))}
            </>
          )
        )}

        {tab === 'collisions' && (
          collisions.length === 0 ? <div className="diag-empty">✅ {t('diagCollisionsNone')}</div> : (
            <>
              <div className="diag-summary">{t('diagCollisionsSummary', { count: collisions.length })}</div>
              {collisions.map(({ name, files: twins }) => (
                <div key={name} className="diag-group">
                  <div className="diag-item">
                    <span className="diag-clash">{name}</span>
                    <span className="diag-count">{twins.length}</span>
                  </div>
                  {twins.map((file) => (
                    <button key={file.path} className="diag-sub" onClick={() => onFileSelect(file)}>
                      <span className="diag-arrow">📄</span>{file.relativePath}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )
        )}
      </div>
    </div>
  )
}
