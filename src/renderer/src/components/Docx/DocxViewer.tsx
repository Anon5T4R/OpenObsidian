import React, { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import './DocxViewer.css'

interface DocxViewerProps {
  filePath: string
  onOpenInApp: () => void
  onConvertToMd: () => void
  isConverting: boolean
}

export default function DocxViewer({ filePath, onOpenInApp, onConvertToMd, isConverting }: DocxViewerProps) {
  const t = useT()
  const [html,    setHtml]    = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null); setHtml('')
    window.api.docxToHtml(filePath).then(({ html: h, error: e }) => {
      if (e) setError(e); else setHtml(h)
      setLoading(false)
    })
  }, [filePath])

  const fileName = filePath.split(/[/\\]/).pop() ?? filePath

  return (
    <div className="docx-viewer">
      <div className="docx-toolbar">
        <span className="docx-title">📝 {fileName}</span>
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
