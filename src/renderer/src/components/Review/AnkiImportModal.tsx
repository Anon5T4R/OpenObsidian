import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useModalA11y } from '../../hooks/useModalA11y'
import { useT } from '../../i18n'
import type { AnkiPreview } from '../../../../preload/index'
import './AnkiImportModal.css'

interface AnkiImportModalProps {
  preview: AnkiPreview
  onConfirm: (deckName: string) => void
  onCancel: () => void
}

/**
 * Shows what is about to land in the vault before anything is written.
 * It lives here rather than in a native dialog so it speaks the app's
 * language and matches the rest of the interface.
 */
export default function AnkiImportModal({ preview, onConfirm, onCancel }: AnkiImportModalProps) {
  const t = useT()
  const dialogRef = useModalA11y<HTMLDivElement>(onCancel)
  // Deck names come from a file name and are often full of underscores
  const [name, setName] = useState(preview.deck.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim())

  return (
    <div className="anki-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="anki-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('ankiTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="anki-header">
          <span className="anki-title">🃏 {t('ankiTitle')}</span>
          <button className="anki-close" onClick={onCancel} aria-label={t('close')}><X size={16} /></button>
        </div>

        <div className="anki-body">
          <div className="anki-count">
            <strong>{preview.count.toLocaleString()}</strong> {t('ankiCards')}
          </div>

          <label className="anki-label">
            {t('ankiDeckName')}
            <input
              data-autofocus
              className="anki-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="anki-detail">
            {preview.notes === 1
              ? t('ankiOneNote', { name: name || preview.deck })
              : t('ankiManyNotes', { notes: preview.notes, folder: name || preview.deck, per: preview.perNote })}
          </div>

          {preview.withMedia > 0 && (
            preview.mediaFiles > 0 ? (
              <div className="anki-detail">
                🖼️ {t('ankiMediaCopied', { count: preview.withMedia, files: preview.mediaFiles })}
              </div>
            ) : (
              <div className="anki-warn">
                ⚠️ {t('ankiMedia', { count: preview.withMedia })}
              </div>
            )
          )}
        </div>

        <div className="anki-actions">
          <button className="btn-secondary" onClick={onCancel}>{t('tplCancel')}</button>
          <button className="btn-primary" onClick={() => onConfirm(name)} disabled={!name.trim()}>
            {t('ankiImport')}
          </button>
        </div>
      </div>
    </div>
  )
}
