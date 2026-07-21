import React, { useState, useRef, useEffect, useMemo } from 'react'
import { NoteFile } from '../../store/vaultStore'
import { useT } from '../../i18n'
import {
  CATEGORY_ORDER, CATEGORY_LABEL,
  Insertable, resolve, searchInsertables, primarySlash,
} from '../../utils/insertables'
import './InsertMenu.css'

interface InsertMenuProps {
  onInsert: (text: string, cursorOffset?: number) => void
  files: NoteFile[]
}

/**
 * Everything the editor can insert, grouped and searchable.
 *
 * It reads the same catalogue the `/` completion reads, so the two can never
 * again offer different things — which they did, while neither of them
 * mentioned flashcards, callouts, Mermaid or queries at all. The menu is where
 * someone finds out a feature exists, so each row carries a line of syntax
 * rather than only a name.
 */
export default function InsertMenu({ onInsert }: InsertMenuProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Opening with the keyboard and having to grab the mouse to filter would
  // defeat the point of the search box
  useEffect(() => {
    if (open) searchRef.current?.focus()
    else setQuery('')
  }, [open])

  const matches = useMemo(() => searchInsertables(query), [query])

  const grouped = useMemo(() => {
    const out: { category: (typeof CATEGORY_ORDER)[number]; items: Insertable[] }[] = []
    for (const category of CATEGORY_ORDER) {
      const items = matches.filter((i) => i.category === category)
      if (items.length > 0) out.push({ category, items })
    }
    return out
  }, [matches])

  const doInsert = (item: Insertable) => {
    const { text, cursor } = resolve(item)
    onInsert(text, cursor)
    setOpen(false)
  }

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    // Enter takes the first match, so a search can be finished without the mouse
    if (e.key === 'Enter' && matches.length > 0) { e.preventDefault(); doInsert(matches[0]) }
  }

  return (
    <div className="insert-menu" ref={ref}>
      <button
        className={`insert-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={t('insTriggerTitle')}
      >
        <span className="insert-trigger-plus">+</span>
        {t('insTrigger')}
        <span className="insert-trigger-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="insert-dropdown">
          <input
            ref={searchRef}
            className="insert-search"
            value={query}
            placeholder={t('insSearchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
          />
          <div className="insert-hint">
            {t('insHintSlash')} <kbd>/</kbd>
          </div>

          {grouped.length === 0 && <div className="insert-empty">{t('insNoMatch')}</div>}

          {grouped.map(({ category, items }) => (
            <div key={category} className="insert-group">
              <div className="insert-group-title">{t(CATEGORY_LABEL[category])}</div>
              <div className="insert-group-items">
                {items.map((item) => (
                  <button
                    key={item.id}
                    className="insert-item"
                    onClick={() => doInsert(item)}
                    title={t('insSlashCmd', { cmd: primarySlash(item) })}
                  >
                    <span className="insert-icon">{item.icon}</span>
                    <span className="insert-text">
                      <span className="insert-label">{t(item.labelKey)}</span>
                      <span className="insert-desc">{t(item.descKey)}</span>
                    </span>
                    <kbd className="insert-shortcut">{primarySlash(item)}</kbd>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
