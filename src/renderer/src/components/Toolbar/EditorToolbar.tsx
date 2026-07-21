import React from 'react'
import { CalendarDays, Layers, Share2, CircleHelp, Settings } from 'lucide-react'
import type { PluginInfo } from '../../../../preload/index'
import { useT } from '../../i18n'

const ICON = 17

interface ToolbarRightProps {
  /** Toggles the calendar popover (today's note is one click inside it) */
  onDailyNote: () => void
  calendarOpen: boolean
  /** Rendered inside the toolbar so the popover can anchor to the button */
  calendar?: React.ReactNode
  onReview: () => void
  /** Cards waiting: shown as a dot on the review button */
  cardsDue: number
  graphOpen: boolean
  onToggleGraph: () => void
  plugins: PluginInfo[]
  activePluginId: string | null
  onPluginPanelToggle: (id: string) => void
  onHelp: () => void
  onSettings: () => void
  /** Extra buttons (e.g. TOC / export) rendered between Daily Note and Graph. */
  children?: React.ReactNode
}

/**
 * Shared right-hand toolbar cluster. Used by both the "no note open" and
 * "note open" branches of App so the Daily Note / Graph / plugin / Help /
 * Settings buttons live in one place instead of being duplicated.
 */
export function ToolbarRight({
  onDailyNote,
  calendarOpen,
  calendar,
  onReview,
  cardsDue,
  graphOpen,
  onToggleGraph,
  plugins,
  activePluginId,
  onPluginPanelToggle,
  onHelp,
  onSettings,
  children,
}: ToolbarRightProps) {
  const t = useT()
  return (
    <div className="toolbar-right">
      <div className="toolbar-calendar-wrap">
        <button
          className={`toolbar-icon-btn ${calendarOpen ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onDailyNote() }}
          title={t('ttCalendar')}
          aria-label={t('ttCalendar')}
        >
          <CalendarDays size={ICON} />
        </button>
        {calendarOpen && calendar}
      </div>
      <button
        className={`toolbar-icon-btn ${cardsDue > 0 ? 'has-badge' : ''}`}
        onClick={onReview}
        title={cardsDue > 0 ? t('ttReviewDue', { count: cardsDue }) : t('ttReview')}
        aria-label={t('ttReview')}
      >
        <Layers size={ICON} />
        {cardsDue > 0 && <span className="toolbar-badge">{cardsDue > 99 ? '99+' : cardsDue}</span>}
      </button>
      {children}
      <button
        className={`toolbar-icon-btn ${graphOpen ? 'active' : ''}`}
        onClick={onToggleGraph}
        title={t('ttGraph')}
        aria-label={t('ttGraph')}
      >
        <Share2 size={ICON} />
      </button>
      {plugins.filter((p) => p.enabled && p.panelPath).map((p) => (
        <button
          key={p.id}
          className={`toolbar-icon-btn ${activePluginId === p.id ? 'active' : ''}`}
          onClick={() => onPluginPanelToggle(p.id)}
          title={t('ttPlugin', { name: p.name })}
          aria-label={t('ttPlugin', { name: p.name })}
        >{p.icon ?? '⬡'}</button>
      ))}
      <button className="toolbar-icon-btn" onClick={onHelp} title={t('ttHelp')} aria-label={t('ttHelp')}>
        <CircleHelp size={ICON} />
      </button>
      <button className="toolbar-icon-btn" onClick={onSettings} title={t('ttSettings')} aria-label={t('ttSettings')}>
        <Settings size={ICON} />
      </button>
    </div>
  )
}
