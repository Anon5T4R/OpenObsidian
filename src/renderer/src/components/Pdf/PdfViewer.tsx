import React from 'react'
import { useT } from '../../i18n'
import './PdfViewer.css'

interface PdfViewerProps {
  filePath: string
  onOpenNotes: () => void
}

export default function PdfViewer({ filePath, onOpenNotes }: PdfViewerProps) {
  const t = useT()
  const fileUrl = 'file:///' + filePath.replace(/\\/g, '/')
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <span className="pdf-title">📕 {fileName}</span>
        <button className="pdf-notes-btn" onClick={onOpenNotes} title="Open companion notes for this PDF">
          {t('pdfOpenNotes')}
        </button>
      </div>
      <iframe className="pdf-frame" src={fileUrl} title={fileName} />
    </div>
  )
}
