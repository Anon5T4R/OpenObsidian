import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useVaultStore } from '../../store/vaultStore'
import { useSettings } from '../../hooks/useSettings'
import { DATE_LOCALE, useT } from '../../i18n'
import { monthGrid, monthLabel, weekdayLabels, todayISO, addMonths, isDailyNoteName } from '../../utils/calendar'
import './CalendarPopover.css'

interface CalendarPopoverProps {
  /** Opens the daily note for that date, creating it when missing */
  onPickDate: (iso: string) => void
  onClose: () => void
}

export default function CalendarPopover({ onPickDate, onClose }: CalendarPopoverProps) {
  const files = useVaultStore((s) => s.files)
  const { settings } = useSettings()
  const t = useT()
  const locale = DATE_LOCALE[settings.locale]
  const today = todayISO()

  const [cursor, setCursor] = useState(today)
  const ref = useRef<HTMLDivElement>(null)

  // Which days already have a note — the whole point of showing a calendar
  const existing = useMemo(
    () => new Set(files.filter((f) => isDailyNoteName(f.name)).map((f) => f.name)),
    [files],
  )

  const grid = useMemo(() => monthGrid(cursor), [cursor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    // mousedown, not click: the click that opened the popover is still in flight
    setTimeout(() => window.addEventListener('mousedown', onDown), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  return (
    <div className="cal-popover" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="cal-header">
        <button className="cal-nav" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label={t('calPrev')}>
          <ChevronLeft size={15} />
        </button>
        <span className="cal-month">{monthLabel(cursor, locale)}</span>
        <button className="cal-nav" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label={t('calNext')}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="cal-grid cal-weekdays">
        {weekdayLabels(locale).map((label, i) => (
          <span key={i} className="cal-weekday">{label}</span>
        ))}
      </div>

      <div className="cal-grid">
        {grid.map(({ iso, day, inMonth }) => {
          const has = existing.has(iso)
          return (
            <button
              key={iso}
              className={[
                'cal-day',
                inMonth ? '' : 'outside',
                iso === today ? 'today' : '',
                has ? 'has-note' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onPickDate(iso)}
              title={has ? t('calOpenNote', { date: iso }) : t('calCreateNote', { date: iso })}
            >
              {day}
            </button>
          )
        })}
      </div>

      <div className="cal-footer">
        <button className="cal-today-btn" onClick={() => onPickDate(today)}>{t('calToday')}</button>
        <span className="cal-legend"><span className="cal-dot" /> {t('calHasNote')}</span>
      </div>
    </div>
  )
}
