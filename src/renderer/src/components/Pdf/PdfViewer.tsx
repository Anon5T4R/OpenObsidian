import React from 'react'
import './PdfViewer.css'

interface PdfViewerProps {
  filePath: string
  onOpenNotes: () => void
}

export default function PdfViewer({ filePath, onOpenNotes }: PdfViewerProps) {
  const fileUrl = 'file:///' + filePath.replace(/\\/g, '/')
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <span className="pdf-title">📕 {fileName}</span>
        <button className="pdf-notes-btn" onClick={onOpenNotes} title="Open companion notes for this PDF">
          📝 Open Notes
        </button>
      </div>
      <iframe
        className="pdf-frame"
        src={fileUrl}
        title={fileName}
      />
    </div>
  )
}
