import React, { MutableRefObject, useState, useEffect, useMemo, useRef } from 'react'
import { useVaultStore, NoteFile, extractTags, expandTagHierarchy } from '../../store/vaultStore'
import { parseFrontmatter, frontmatterTags } from '../../utils/frontmatter'
import {
  parseQuery, isEmptyQuery, matchNote, compileRegex, textNeedles, NoteMatch,
} from '../../utils/searchQuery'
import { useT } from '../../i18n'
import './SearchPanel.css'

interface SearchResult {
  file: NoteFile
  matches: NoteMatch[]
}

interface SearchPanelProps {
  onFileSelect: (file: NoteFile, line?: number) => void
  onClose: () => void
  /** The vault's contents, already in memory — avoids one disk read per note */
  contentsRef?: MutableRefObject<Record<string, string>>
}

const VISIBLE_MATCHES = 5

export default function SearchPanel({ onFileSelect, onClose, contentsRef }: SearchPanelProps) {
  const files = useVaultStore((s) => s.files)
  const t = useT()
  const [query, setQuery] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const parsed = useMemo(() => parseQuery(query), [query])
  const regex  = useMemo(
    () => (useRegex ? compileRegex(textNeedles(parsed).join(' ')) : null),
    [useRegex, parsed],
  )
  const regexInvalid = useRegex && textNeedles(parsed).length > 0 && regex === null

  useEffect(() => {
    if (isEmptyQuery(parsed) || regexInvalid) { setResults([]); setSearching(false); return }
    setSearching(true)
    // Guards against a stale in-flight search overwriting newer results
    let cancelled = false
    const doSearch = async () => {
      const found: SearchResult[] = []
      for (const file of files) {
        let content = contentsRef?.current[file.path]
        if (content === undefined) {
          try { content = await window.api.readFile(file.path) } catch { continue }
        }
        if (cancelled) return
        const { data } = parseFrontmatter(content)
        const tags = expandTagHierarchy([...extractTags(content), ...frontmatterTags(data)])
        const matches = matchNote({ name: file.name, relativePath: file.relativePath, content, tags }, parsed, regex)
        if (matches) found.push({ file, matches })
      }
      if (cancelled) return
      setResults(found)
      setExpanded(new Set())
      setSearching(false)
    }
    const timer = setTimeout(doSearch, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [parsed, regex, regexInvalid, files, contentsRef])

  const needles = textNeedles(parsed)

  const highlight = (text: string) => {
    const lower = text.toLowerCase()
    let at = -1
    let hit = ''
    for (const needle of needles) {
      const idx = lower.indexOf(needle)
      if (idx !== -1 && (at === -1 || idx < at)) { at = idx; hit = needle }
    }
    if (at === -1) return text
    return (
      <>
        {text.slice(0, at)}
        <mark>{text.slice(at, at + hit.length)}</mark>
        {text.slice(at + hit.length)}
      </>
    )
  }

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0)

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
        <button
          className={`search-regex ${useRegex ? 'active' : ''}`}
          onClick={() => setUseRegex((r) => !r)}
          title={t('searchRegexTip')}
        >.*</button>
        <button className="search-close" onClick={onClose}>{t('searchClose')}</button>
      </div>

      <div className="search-hint">{t('searchHint')}</div>

      <div className="search-results">
        {regexInvalid && <div className="search-status search-invalid">{t('searchRegexInvalid')}</div>}
        {searching && <div className="search-status">{t('searching')}</div>}
        {!searching && !regexInvalid && query && results.length === 0 && (
          <div className="search-status">{t('noResults', { query })}</div>
        )}
        {!searching && results.length > 0 && (
          <div className="search-summary">{t('searchSummary', { notes: results.length, matches: totalMatches })}</div>
        )}

        {results.map(({ file, matches }) => {
          const isExpanded = expanded.has(file.path)
          const shown = isExpanded ? matches : matches.slice(0, VISIBLE_MATCHES)
          const hidden = matches.length - shown.length
          return (
            <div key={file.path} className="search-result-group">
              <button className="search-result-file" onClick={() => onFileSelect(file)}>
                📄 {file.name}
                <span className="match-count">{matches.length}</span>
              </button>
              {shown.map((m, i) => (
                <button key={i} className="search-result-line" onClick={() => onFileSelect(file, m.line)}>
                  <span className="line-num">{m.line}</span>
                  <span className="line-text">{highlight(m.text)}</span>
                </button>
              ))}
              {/* Never hide occurrences silently — the old panel cut at 5 with no sign */}
              {hidden > 0 && (
                <button className="search-more" onClick={() => toggleExpanded(file.path)}>
                  {t('searchMore', { count: hidden })}
                </button>
              )}
              {isExpanded && matches.length > VISIBLE_MATCHES && (
                <button className="search-more" onClick={() => toggleExpanded(file.path)}>
                  {t('searchLess')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
