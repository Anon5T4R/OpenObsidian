import React, { useEffect, useState } from 'react'
import './DocxViewer.css'

interface DocxViewerProps {
  filePath: string
  onOpenInApp: () => void
  onConvertToMd: () => void
  isConverting: boolean
}

export default function DocxViewer({ filePath, onOpenInApp, onConvertToMd, isConverting }: DocxViewerProps) {
  const [html,    setHtml]    = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setHtml('')
    window.api.docxToHtml(filePath).then(({ html: h, error: e }) => {
      if (e) setError(e)
      else   setHtml(h)
      setLoading(false)
    })
  }, [filePath])

  const fileName = filePath.split(/[/\\]/).pop() ?? filePath

  return (
    <div className="docx-viewer">
      <div className="docx-toolbar">
        <span className="docx-title">📝 {fileName}</span>
        <button
          className="docx-btn"
          onClick={onOpenInApp}
          title="Open in Word, LibreOffice or system default app"
        >
          ↗ Open in App
        </button>
        <button
          className="docx-btn docx-btn-primary"
          onClick={onConvertToMd}
          disabled={isConverting || loading || !!error}
          title="Convert document content to a Markdown note"
        >
          {isConverting ? '…Converting' : '⬇ Convert to .md'}
        </button>
      </div>

      <div className="docx-content">
        {loading && (
          <div className="docx-state">
            <span className="docx-spinner" />
            Loading document…
          </div>
        )}
        {error && (
          <div className="docx-state docx-error">
            ⚠️ Could not read file: {error}
          </div>
        )}
        {!loading && !error && (
          <div
            className="docx-body"
            dangerouslySetInnerHTML={{ __html: html || '<p style="color:var(--text-muted)">Empty document.</p>' }}
          />
        )}
      </div>
    </div>
  )
}
