import React, { useState, useRef, useEffect } from 'react'
import { NoteFile } from '../../store/vaultStore'
import './InsertMenu.css'

interface InsertMenuProps {
  onInsert: (text: string, cursorOffset?: number) => void
  files: NoteFile[]
}

type Item = {
  label: string
  icon: string
  shortcut?: string
  apply: string
  cursor?: number
}

type Group = { title: string; items: Item[] }

const GROUPS: Group[] = [
  {
    title: 'Headings',
    items: [
      { label: 'Heading 1',   icon: 'H1',  shortcut: '/h1',  apply: '# ',   cursor: 2 },
      { label: 'Heading 2',   icon: 'H2',  shortcut: '/h2',  apply: '## ',  cursor: 3 },
      { label: 'Heading 3',   icon: 'H3',  shortcut: '/h3',  apply: '### ', cursor: 4 },
    ]
  },
  {
    title: 'Structure',
    items: [
      { label: 'Table',          icon: '⊞',   shortcut: '/table',   apply: '| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n' },
      { label: 'Code block',     icon: '</>',  shortcut: '/code',    apply: '```\n\n```', cursor: -4 },
      { label: 'Blockquote',     icon: '❝',   shortcut: '/quote',   apply: '> ' },
      { label: 'Horizontal rule',icon: '—',   shortcut: '/hr',      apply: '\n---\n' },
      { label: 'Task list',       icon: '✅',   shortcut: '/check',   apply: '- [ ] \n- [ ] \n- [ ] ', cursor: -14 },
      { label: 'Bullet list',    icon: '•',   shortcut: '/list',    apply: '- ' },
    ]
  },
  {
    title: 'Inline',
    items: [
      { label: 'Bold',         icon: 'B',   shortcut: '/bold',    apply: '**text**', cursor: -2 },
      { label: 'Italic',       icon: 'I',   shortcut: '/italic',  apply: '*text*',   cursor: -1 },
      { label: 'Inline code',  icon: '`',   shortcut: '/inline',  apply: '`code`',   cursor: -1 },
    ]
  },
  {
    title: 'Links',
    items: [
      { label: 'Link to note', icon: '[[]]', shortcut: '/wikilink', apply: '[[', cursor: 0 },
      { label: 'Web link',     icon: '🔗',  shortcut: '/link',     apply: '[text](https://)', cursor: -1 },
      { label: 'Image',        icon: '🖼',  shortcut: '/image',    apply: '![alt](url)', cursor: -1 },
    ]
  },
  {
    title: 'Symbols',
    items: [
      { label: 'Right arrow', icon: '→', shortcut: '/rarr',  apply: '→' },
      { label: 'Left arrow',  icon: '←', shortcut: '/larr',  apply: '←' },
      { label: 'Up arrow',    icon: '↑', shortcut: '/uarr',  apply: '↑' },
      { label: 'Down arrow',  icon: '↓', shortcut: '/darr',  apply: '↓' },
      { label: 'Check mark',  icon: '✓', shortcut: '/tick',  apply: '✓' },
      { label: 'Cross mark',  icon: '✗', shortcut: '/cross', apply: '✗' },
      { label: 'Em dash',     icon: '—', shortcut: '/mdash', apply: '—' },
      { label: 'Ellipsis',    icon: '…', shortcut: '/dots',  apply: '…' },
    ]
  }
]

export default function InsertMenu({ onInsert }: InsertMenuProps) {
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
        title="Insert element (or type / in editor)"
      >
        <span className="insert-trigger-plus">+</span>
        Insert
        <span className="insert-trigger-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="insert-dropdown">
          <div className="insert-hint">
            Tip: type <kbd>/</kbd> in the editor for slash commands, or <kbd>[[</kbd> for note links
          </div>
          {GROUPS.map((group) => (
            <div key={group.title} className="insert-group">
              <div className="insert-group-title">{group.title}</div>
              <div className="insert-group-items">
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    className="insert-item"
                    onClick={() => doInsert(item)}
                    title={item.shortcut ? `Slash command: ${item.shortcut}` : undefined}
                  >
                    <span className="insert-icon">{item.icon}</span>
                    <span className="insert-label">{item.label}</span>
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
