import React, { useState, useEffect, useRef } from 'react'
import { useVaultStore, NoteFile } from '../../store/vaultStore'
import { useT } from '../../i18n'
import './SearchPanel.css'

interface SearchResult {
  file: NoteFile
  matches: { line: number; text: string }[]
}

interface SearchPanelProps {
  onFileSelect: (file: NoteFile, line?: number) => void
  onClose: () => void
}

export default function SearchPanel({ onFileSelect, onClose }: SearchPanelProps) {
  const files = useVaultStore((s) => s.files)
  const t = useT()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    const lower = query.toLowerCase()
    // Guards against a stale in-flight search overwriting newer results
    let cancelled = false
    const doSearch = async () => {
      const perFile = await Promise.all(files.map(async (file) => {
        const content = await window.api.readFile(file.path)
        const lines = content.split('\n')
        const matches: { line: number; text: string }[] = []
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lower))
            matches.push({ line: i + 1, text: lines[i].trim() })
        }
        return { file, matches: matches.slice(0, 5) }
      }))
      if (cancelled) return
      setResults(perFile.filter((r) => r.matches.length > 0))
      setSearching(false)
    }
    const timer = setTimeout(doSearch, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, files])

  const highlight = (text: string) => {
    const lower = query.toLowerCase()
    const idx = text.toLowerCase().indexOf(lower)
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <div className="search-panel" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="search-header">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
          {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
        </div>
        <button className="search-close" onClick={onClose}>{t('searchClose')}</button>
      </div>

      <div className="search-results">
        {searching && <div className="search-status">{t('searching')}</div>}
        {!searching && query && results.length === 0 && (
          <div className="search-status">{t('noResults', { query })}</div>
        )}
        {results.map(({ file, matches }) => (
          <div key={file.path} className="search-result-group">
            <button className="search-result-file" onClick={() => onFileSelect(file)}>
              📄 {file.name}
              <span className="match-count">{matches.length}</span>
            </button>
            {matches.map((m, i) => (
              <button key={i} className="search-result-line" onClick={() => onFileSelect(file, m.line)}>
                <span className="line-num">{m.line}</span>
                <span className="line-text">{highlight(m.text)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
