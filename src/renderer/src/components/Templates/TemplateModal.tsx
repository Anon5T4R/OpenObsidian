import React, { useState, useRef, useEffect } from 'react'
import { useT, useSettings, formatDailyDate } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import './TemplateModal.css'

interface Template {
  id: string
  nameKey: TranslationKey
  icon: string
  content: (title: string) => string
}

function buildTemplates(
  t: ReturnType<typeof useT>,
  locale: ReturnType<typeof useSettings>['settings']['locale'],
): Template[] {
  const displayDate = formatDailyDate(locale)
  return [
    {
      id: 'blank',
      nameKey: 'tplBlank',
      icon: '📄',
      content: (title) => `# ${title}\n\n`,
    },
    {
      id: 'daily',
      nameKey: 'tplDaily',
      icon: '📅',
      content: (title) =>
        `# ${title}\n\n${displayDate}\n\n${t('dailyAnnotations')}\n\n\n\n${t('dailyTasks')}\n\n- [ ] ${t('dailyTask1')}\n- [ ] ${t('dailyTask2')}\n- [ ] ${t('dailyTask3')}\n`,
    },
    {
      id: 'meeting',
      nameKey: 'tplMeeting',
      icon: '🤝',
      content: (title) =>
        `# ${title}\n\n**Date:** ${new Date().toISOString().slice(0, 10)}\n**Attendees:** \n\n## Agenda\n\n- \n\n## Notes\n\n\n\n## Action items\n\n- [ ] \n`,
    },
    {
      id: 'project',
      nameKey: 'tplProject',
      icon: '🚀',
      content: (title) =>
        `# ${title}\n\n## Overview\n\n\n\n## Goals\n\n- \n\n## Tasks\n\n- [ ] \n- [ ] \n- [ ] \n\n## Notes\n\n\n\n## Resources\n\n- \n`,
    },
    {
      id: 'book',
      nameKey: 'tplBook',
      icon: '📚',
      content: (title) =>
        `# ${title}\n\n**Author:** \n**Rating:** ⭐⭐⭐⭐⭐\n\n## Summary\n\n\n\n## Key ideas\n\n- \n\n## Quotes\n\n> \n\n## My takeaways\n\n\n`,
    },
    {
      id: 'idea',
      nameKey: 'tplIdea',
      icon: '💡',
      content: (title) =>
        `# ${title}\n\n## The idea\n\n\n\n## Why it matters\n\n\n\n## How to explore it\n\n- \n\n## Related\n\n- [[  ]]\n`,
    },
  ]
}

interface TemplateModalProps {
  onConfirm: (name: string, content: string) => void
  onCancel: () => void
  folderHint?: string
}

export default function TemplateModal({ onConfirm, onCancel, folderHint }: TemplateModalProps) {
  const t = useT()
  const { settings } = useSettings()
  const templates = buildTemplates(t, settings.locale)

  const [name,     setName]     = useState('')
  const [selected, setSelected] = useState('blank')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const tpl = templates.find((tp) => tp.id === selected) ?? templates[0]
    onConfirm(trimmed, tpl.content(trimmed))
  }

  return (
    <div className="tpl-overlay" onClick={onCancel}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-header">
          <span className="tpl-title">{t('tplTitle')}</span>
          {folderHint && <span className="tpl-folder">{t('tplIn', { folder: folderHint })}</span>}
          <button className="tpl-close" onClick={onCancel}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="tpl-name-row">
            <input
              ref={inputRef}
              className="tpl-name-input"
              placeholder={t('tplNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="tpl-grid">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className={`tpl-item ${selected === tpl.id ? 'selected' : ''}`}
                onClick={() => setSelected(tpl.id)}
              >
                <span className="tpl-item-icon">{tpl.icon}</span>
                <span className="tpl-item-name">{t(tpl.nameKey)}</span>
              </button>
            ))}
          </div>

          <div className="tpl-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>{t('tplCancel')}</button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>{t('tplCreate')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
