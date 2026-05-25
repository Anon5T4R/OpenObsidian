import React, { useState, useRef, useEffect } from 'react'
import './TemplateModal.css'

interface Template {
  id: string
  name: string
  icon: string
  content: (title: string) => string
}

const BUILT_IN: Template[] = [
  {
    id: 'blank',
    name: 'Blank note',
    icon: '📄',
    content: (t) => `# ${t}\n\n`
  },
  {
    id: 'daily',
    name: 'Daily note',
    icon: '📅',
    content: (t) => {
      const d = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      return `# ${t}\n\n${d}\n\n## Today's focus\n\n- \n\n## Notes\n\n\n\n## Done today\n\n- \n`
    }
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    icon: '🤝',
    content: (t) => `# ${t}\n\n**Date:** ${new Date().toISOString().slice(0, 10)}\n**Attendees:** \n\n## Agenda\n\n- \n\n## Notes\n\n\n\n## Action items\n\n- [ ] \n`
  },
  {
    id: 'project',
    name: 'Project plan',
    icon: '🚀',
    content: (t) => `# ${t}\n\n## Overview\n\n\n\n## Goals\n\n- \n\n## Tasks\n\n- [ ] \n- [ ] \n- [ ] \n\n## Notes\n\n\n\n## Resources\n\n- \n`
  },
  {
    id: 'book',
    name: 'Book notes',
    icon: '📚',
    content: (t) => `# ${t}\n\n**Author:** \n**Rating:** ⭐⭐⭐⭐⭐\n\n## Summary\n\n\n\n## Key ideas\n\n- \n\n## Quotes\n\n> \n\n## My takeaways\n\n\n`
  },
  {
    id: 'idea',
    name: 'Idea / brainstorm',
    icon: '💡',
    content: (t) => `# ${t}\n\n## The idea\n\n\n\n## Why it matters\n\n\n\n## How to explore it\n\n- \n\n## Related\n\n- [[  ]]\n`
  },
]

interface TemplateModalProps {
  onConfirm: (name: string, content: string) => void
  onCancel: () => void
  folderHint?: string
}

export default function TemplateModal({ onConfirm, onCancel, folderHint }: TemplateModalProps) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string>('blank')
  const inputRef = useRef<HTMLInputElement>(null)

  // Reliable focus — autoFocus is unreliable in Electron modals
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const tpl = BUILT_IN.find((t) => t.id === selected) ?? BUILT_IN[0]
    onConfirm(trimmed, tpl.content(trimmed))
  }

  return (
    <div className="tpl-overlay" onClick={onCancel}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-header">
          <span className="tpl-title">New Note</span>
          {folderHint && <span className="tpl-folder">in {folderHint}</span>}
          <button className="tpl-close" onClick={onCancel}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="tpl-name-row">
            <input
              ref={inputRef}
              className="tpl-name-input"
              placeholder="Note name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="tpl-grid">
            {BUILT_IN.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className={`tpl-item ${selected === tpl.id ? 'selected' : ''}`}
                onClick={() => setSelected(tpl.id)}
              >
                <span className="tpl-item-icon">{tpl.icon}</span>
                <span className="tpl-item-name">{tpl.name}</span>
              </button>
            ))}
          </div>

          <div className="tpl-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}
