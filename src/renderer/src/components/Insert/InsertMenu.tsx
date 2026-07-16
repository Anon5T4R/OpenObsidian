import React, { useState, useRef, useEffect } from 'react'
import { NoteFile } from '../../store/vaultStore'
import { useT } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import './InsertMenu.css'

interface InsertMenuProps {
  onInsert: (text: string, cursorOffset?: number) => void
  files: NoteFile[]
}

type Item = {
  labelKey: TranslationKey
  icon: string
  shortcut?: string
  apply: string
  cursor?: number
}

type Group = { titleKey: TranslationKey; items: Item[] }

const GROUPS: Group[] = [
  {
    titleKey: 'insGroupHeadings',
    items: [
      { labelKey: 'insHeading1',   icon: 'H1',  shortcut: '/h1',  apply: '# ',   cursor: 2 },
      { labelKey: 'insHeading2',   icon: 'H2',  shortcut: '/h2',  apply: '## ',  cursor: 3 },
      { labelKey: 'insHeading3',   icon: 'H3',  shortcut: '/h3',  apply: '### ', cursor: 4 },
    ]
  },
  {
    titleKey: 'insGroupStructure',
    items: [
      { labelKey: 'insTable',       icon: '⊞',   shortcut: '/table',   apply: '| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n' },
      { labelKey: 'insCodeBlock',   icon: '</>',  shortcut: '/code',    apply: '```\n\n```', cursor: -4 },
      { labelKey: 'insBlockquote',  icon: '❝',   shortcut: '/quote',   apply: '> ' },
      { labelKey: 'insHr',          icon: '—',   shortcut: '/hr',      apply: '\n---\n' },
      { labelKey: 'insTaskList',    icon: '✅',   shortcut: '/check',   apply: '- [ ] \n- [ ] \n- [ ] ', cursor: -14 },
      { labelKey: 'insBulletList',  icon: '•',   shortcut: '/list',    apply: '- ' },
    ]
  },
  {
    titleKey: 'insGroupInline',
    items: [
      { labelKey: 'insBold',        icon: 'B',   shortcut: '/bold',    apply: '**text**', cursor: -2 },
      { labelKey: 'insItalic',      icon: 'I',   shortcut: '/italic',  apply: '*text*',   cursor: -1 },
      { labelKey: 'insInlineCode',  icon: '`',   shortcut: '/inline',  apply: '`code`',   cursor: -1 },
    ]
  },
  {
    titleKey: 'insGroupLinks',
    items: [
      { labelKey: 'insLinkToNote', icon: '[[]]', shortcut: '/wikilink', apply: '[[', cursor: 0 },
      { labelKey: 'insWebLink',    icon: '🔗',  shortcut: '/link',     apply: '[text](https://)', cursor: -1 },
      { labelKey: 'insImage',      icon: '🖼',  shortcut: '/image',    apply: '![alt](url)', cursor: -1 },
    ]
  },
  {
    titleKey: 'insGroupSymbols',
    items: [
      { labelKey: 'insArrowRight', icon: '→', shortcut: '/rarr',  apply: '→' },
      { labelKey: 'insArrowLeft',  icon: '←', shortcut: '/larr',  apply: '←' },
      { labelKey: 'insArrowUp',    icon: '↑', shortcut: '/uarr',  apply: '↑' },
      { labelKey: 'insArrowDown',  icon: '↓', shortcut: '/darr',  apply: '↓' },
      { labelKey: 'insCheckMark',  icon: '✓', shortcut: '/tick',  apply: '✓' },
      { labelKey: 'insCrossMark',  icon: '✗', shortcut: '/cross', apply: '✗' },
      { labelKey: 'insEmDash',     icon: '—', shortcut: '/mdash', apply: '—' },
      { labelKey: 'insEllipsis',   icon: '…', shortcut: '/dots',  apply: '…' },
    ]
  }
]

export default function InsertMenu({ onInsert }: InsertMenuProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const doInsert = (item: Item) => {
    onInsert(item.apply, item.cursor)
    setOpen(false)
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
          <div className="insert-hint">
            {t('insHintPre')} <kbd>/</kbd> {t('insHintMid')} <kbd>[[</kbd> {t('insHintPost')}
          </div>
          {GROUPS.map((group) => (
            <div key={group.titleKey} className="insert-group">
              <div className="insert-group-title">{t(group.titleKey)}</div>
              <div className="insert-group-items">
                {group.items.map((item) => (
                  <button
                    key={item.labelKey}
                    className="insert-item"
                    onClick={() => doInsert(item)}
                    title={item.shortcut ? t('insSlashCmd', { cmd: item.shortcut }) : undefined}
                  >
                    <span className="insert-icon">{item.icon}</span>
                    <span className="insert-label">{t(item.labelKey)}</span>
                    {item.shortcut && <kbd className="insert-shortcut">{item.shortcut}</kbd>}
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
