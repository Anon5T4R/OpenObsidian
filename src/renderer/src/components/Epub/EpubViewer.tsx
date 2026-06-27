import React, { useEffect, useRef, useState } from 'react'
import Epub from 'epubjs'
import type { Book, Rendition, NavItem } from 'epubjs'
import { useT } from '../../i18n'
import './EpubViewer.css'

interface EpubViewerProps {
  filePath: string
  onOpenNotes: () => void
}

export default function EpubViewer({ filePath, onOpenNotes }: EpubViewerProps) {
  const t = useT()
  const containerRef  = useRef<HTMLDivElement>(null)
  const bookRef       = useRef<Book | null>(null)
  const renditionRef  = useRef<Rendition | null>(null)
  const [toc,          setToc]          = useState<NavItem[]>([])
  const [bookTitle,    setBookTitle]    = useState('')
  const [atStart,      setAtStart]      = useState(true)
  const [atEnd,        setAtEnd]        = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  const fileName = filePath.split(/[/\\]/).pop() ?? filePath

  useEffect(() => {
    if (!containerRef.current) return

    setLoading(true)
    setError(null)
    setToc([])
    setBookTitle('')
    setAtStart(true)
    setAtEnd(false)

    const fileUrl = 'file:///' + filePath.replace(/\\/g, '/')
    const book = Epub(fileUrl)
    bookRef.current = book

    const rendition = book.renderTo(containerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'scrolled-doc',
      allowScriptedContent: false,
    })
    renditionRef.current = rendition

    rendition.display().then(() => setLoading(false)).catch((e) => {
      setLoading(false)
      setError(String(e))
    })

    book.loaded.navigation.then((nav) => setToc(nav.toc)).catch(() => {})
    book.loaded.metadata.then((meta) => { if (meta.title) setBookTitle(meta.title) }).catch(() => {})

    rendition.on('relocated', (location: any) => {
      setAtStart(!!location.atStart)
      setAtEnd(!!location.atEnd)
    })

    return () => {
      try { rendition.destroy() } catch {}
      try { book.destroy() } catch {}
      bookRef.current = null
      renditionRef.current = null
    }
  }, [filePath])

  const handlePrev    = () => renditionRef.current?.prev()
  const handleNext    = () => renditionRef.current?.next()
  const handleChapter = (href: string) => { if (href) renditionRef.current?.display(href) }

  return (
    <div className="epub-viewer">
      <div className="epub-toolbar">
        <span className="epub-title">📖 {bookTitle || fileName}</span>

        {toc.length > 0 && (
          <select
            className="epub-toc-select"
            defaultValue=""
            onChange={(e) => handleChapter(e.target.value)}
          >
            <option value="" disabled>{t('epubChapters')}</option>
            {toc.map((item) => (
              <option key={item.href} value={item.href}>{item.label.trim()}</option>
            ))}
          </select>
        )}

        <div className="epub-nav">
          <button className="epub-nav-btn" onClick={handlePrev} disabled={atStart || loading} title={t('ttBack')}>‹</button>
          <button className="epub-nav-btn" onClick={handleNext} disabled={atEnd  || loading} title={t('ttForward')}>›</button>
        </div>

        <button className="epub-notes-btn" onClick={onOpenNotes} title={t('pdfOpenNotes')}>
          {t('pdfOpenNotes')}
        </button>
      </div>

      <div className="epub-body">
        {loading && <div className="epub-loading">{t('epubLoading')}</div>}
        {error   && <div className="epub-error">⚠ {error}</div>}
        <div ref={containerRef} className="epub-content" />
      </div>
    </div>
  )
}
