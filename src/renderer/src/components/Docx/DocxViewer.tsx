import React, { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import './DocxViewer.css'

interface DocxViewerProps {
  filePath: string
  onOpenInApp: () => void
  onConvertToMd: () => void
  isConverting: boolean
  /** Word documents by default; .odt reuses this viewer with its own reader */
  format?: 'docx' | 'odt'
}

const READERS = {
  docx: (p: string) => window.api.docxToHtml(p),
  odt:  (p: string) => window.api.odtToHtml(p),
}

const ICONS = { docx: '📝', odt: '📄' }

export default function DocxViewer({ filePath, onOpenInApp, onConvertToMd, isConverting, format = 'docx' }: DocxViewerProps) {
  const t = useT()
  const [html,    setHtml]    = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null); setHtml('')
    READERS[format](filePath).then(({ html: h, error: e }) => {
      if (e) setError(e); else setHtml(h)
      setLoading(false)
    })
  }, [filePath, format])

  const fileName = filePath.split(/[/\\]/).pop() ?? filePath

  return (
    <div className="docx-viewer">
      <div className="docx-toolbar">
        <span className="docx-title">{ICONS[format]} {fileName}</span>
        <button className="docx-btn" onClick={onOpenInApp} title={t('docxOpenInAppTip')}>
          {t('docxOpenInApp')}
        </button>
        <button
          className="docx-btn docx-btn-primary"
          onClick={onConvertToMd}
          disabled={isConverting || loading || !!error}
          title={t('docxConvertTip')}
        >
          {isConverting ? t('docxConverting') : t('docxConvert')}
        </button>
      </div>

      <div className="docx-content">
        {loading && (
          <div className="docx-state">
            <span className="docx-spinner" />
            {t('docxLoading')}
          </div>
        )}
        {error && (
          <div className="docx-state docx-error">
            ⚠️ {t('docxReadError', { error })}
          </div>
        )}
        {!loading && !error && (
          <div
            className="docx-body"
            dangerouslySetInnerHTML={{ __html: html || `<p style="color:var(--text-muted)">${t('docxEmpty')}</p>` }}
          />
        )}
      </div>
    </div>
  )
}
