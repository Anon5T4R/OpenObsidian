import React, { useState } from 'react'
import { useT, formatDailyDate } from '../../i18n'
import type { TranslationKey, Locale } from '../../i18n'
import { useSettings } from '../../hooks/useSettings'
import { X } from 'lucide-react'
import { useModalA11y } from '../../hooks/useModalA11y'
import './TemplateModal.css'

interface Template {
  id: string
  nameKey: TranslationKey
  icon: string
  content: (title: string) => string
}

function buildTemplates(
  t: ReturnType<typeof useT>,
  locale: Locale,
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
        `# ${title}\n\n**${t('tmDate')}:** ${new Date().toISOString().slice(0, 10)}\n**${t('tmAttendees')}:** \n\n## ${t('tmAgenda')}\n\n- \n\n## ${t('tmNotes')}\n\n\n\n## ${t('tmActionItems')}\n\n- [ ] \n`,
    },
    {
      id: 'project',
      nameKey: 'tplProject',
      icon: '🚀',
      content: (title) =>
        `# ${title}\n\n## ${t('tpOverview')}\n\n\n\n## ${t('tpGoals')}\n\n- \n\n## ${t('tpTasks')}\n\n- [ ] \n- [ ] \n- [ ] \n\n## ${t('tmNotes')}\n\n\n\n## ${t('tpResources')}\n\n- \n`,
    },
    {
      id: 'book',
      nameKey: 'tplBook',
      icon: '📚',
      content: (title) =>
        `# ${title}\n\n**${t('tbAuthor')}:** \n**${t('tbRating')}:** ⭐⭐⭐⭐⭐\n\n## ${t('tbSummary')}\n\n\n\n## ${t('tbKeyIdeas')}\n\n- \n\n## ${t('tbQuotes')}\n\n> \n\n## ${t('tbTakeaways')}\n\n\n`,
    },
    {
      id: 'idea',
      nameKey: 'tplIdea',
      icon: '💡',
      content: (title) =>
        `# ${title}\n\n## ${t('tiIdea')}\n\n\n\n## ${t('tiWhy')}\n\n\n\n## ${t('tiHow')}\n\n- \n\n## ${t('tiRelated')}\n\n- [[  ]]\n`,
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
  const dialogRef = useModalA11y<HTMLDivElement>(onCancel)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const tpl = templates.find((tp) => tp.id === selected) ?? templates[0]
    onConfirm(trimmed, tpl.content(trimmed))
  }

  return (
    <div className="tpl-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="tpl-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('tplTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tpl-header">
          <span className="tpl-title">{t('tplTitle')}</span>
          {folderHint && <span className="tpl-folder">{t('tplIn', { folder: folderHint })}</span>}
          <button className="tpl-close" onClick={onCancel} aria-label={t('close')}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="tpl-name-row">
            <input
              data-autofocus
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
