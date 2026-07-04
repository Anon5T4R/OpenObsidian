import React, { useMemo, useState, useCallback } from 'react'
import type { NoteFile } from '../../store/vaultStore'
import { useT } from '../../i18n'
import { useModalA11y } from '../../hooks/useModalA11y'
import './CommandPalette.css'

export interface Command {
  id: string
  label: string
  icon?: string
  run: () => void
}

interface CommandPaletteProps {
  files: NoteFile[]
  commands: Command[]
  onFileSelect: (file: NoteFile) => void
  onClose: () => void
}

type Item = { kind: 'note'; file: NoteFile } | { kind: 'cmd'; cmd: Command }

export default function CommandPalette({ files, commands, onFileSelect, onClose }: CommandPaletteProps) {
  const t = useT()
  const dialogRef = useModalA11y<HTMLDivElement>(onClose)
  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)

  const q = query.trim().toLowerCase()

  const noteMatches = useMemo(
    () => (q ? files.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 12) : files.slice(0, 8)),
    [files, q],
  )
  const cmdMatches = useMemo(
    () => (q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands),
    [commands, q],
  )

  const items: Item[] = useMemo(
    () => [
      ...noteMatches.map((f) => ({ kind: 'note' as const, file: f })),
      ...cmdMatches.map((c) => ({ kind: 'cmd' as const, cmd: c })),
    ],
    [noteMatches, cmdMatches],
  )

  const clamped = Math.min(active, Math.max(items.length - 1, 0))

  const run = useCallback(
    (item: Item) => {
      onClose()
      if (item.kind === 'note') onFileSelect(item.file)
      else item.cmd.run()
    },
    [onClose, onFileSelect],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[clamped]; if (it) run(it) }
  }

  let idx = -1
  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="cmdk-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('ttCommandPalette')}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          data-autofocus
          className="cmdk-input"
          placeholder={t('cmdkPlaceholder')}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onKeyDown={onKeyDown}
        />
        <div className="cmdk-list">
          {items.length === 0 && <div className="cmdk-empty">{t('cmdkEmpty')}</div>}

          {noteMatches.length > 0 && <div className="cmdk-section">{t('cmdkNotes')}</div>}
          {noteMatches.map((f) => {
            const i = ++idx
            return (
              <button
                key={`n:${f.path}`}
                className={`cmdk-item ${i === clamped ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => run({ kind: 'note', file: f })}
              >
                <span className="cmdk-item-icon">📄</span>
                <span className="cmdk-item-label">{f.name}</span>
              </button>
            )
          })}

          {cmdMatches.length > 0 && <div className="cmdk-section">{t('cmdkCommands')}</div>}
          {cmdMatches.map((c) => {
            const i = ++idx
            return (
              <button
                key={`c:${c.id}`}
                className={`cmdk-item ${i === clamped ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => run({ kind: 'cmd', cmd: c })}
              >
                <span className="cmdk-item-icon">{c.icon ?? '⚡'}</span>
                <span className="cmdk-item-label">{c.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
