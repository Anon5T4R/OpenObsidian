import React, { useEffect, useState } from 'react'
import { useVaultStore } from '../../store/vaultStore'
import { useT } from '../../i18n'
import type { SrsReport } from '../../../../preload/index'
import './ReviewPanel.css'

interface ReviewStatsPanelProps {
  onClose: () => void
  onNotify: (msg: string) => void
}

export default function ReviewStatsPanel({ onClose, onNotify }: ReviewStatsPanelProps) {
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const t = useT()
  const [data, setData] = useState<SrsReport | null>(null)

  useEffect(() => {
    if (!vaultPath) return
    window.api.srsReport(vaultPath).then(setData).catch(() => setData(null))
  }, [vaultPath])

  const importAnki = async () => {
    if (!vaultPath) return
    const r = await window.api.srsImportAnki(vaultPath)
    if (!r) return
    if (r.error) { onNotify(r.error); return }
    onNotify(t('reviewImported', { count: r.count ?? 0, notes: r.notes ?? 1 }))
  }

  const peak = Math.max(1, ...(data?.forecast.map((f) => f.count) ?? [1]))

  return (
    <div className="review-panel">
      <div className="review-header">
        <span className="review-title">📊 {t('reviewStatsTitle')}</span>
        <span className="review-progress" />
        <button className="review-close" onClick={importAnki}>{t('reviewImportAnki')}</button>
        <button className="review-close" onClick={onClose}>{t('searchClose')}</button>
      </div>

      <div className="stats-body">
        {!data ? (
          <div className="review-empty">{t('searching')}</div>
        ) : data.total === 0 ? (
          <div className="review-empty">{t('reviewNothing')}</div>
        ) : (
          <>
            <div className="stats-grid">
              <Metric label={t('reviewStTotal')}     value={String(data.total)} />
              <Metric label={t('reviewStDue')}       value={String(data.due)} accent />
              <Metric label={t('reviewStFresh')}     value={String(data.fresh)} />
              <Metric label={t('reviewStLearned')}   value={String(data.learned)} />
              <Metric label={t('reviewStRetention')} value={`${Math.round(data.retention * 100)}%`} />
              <Metric label={t('reviewStEase')}      value={data.averageEase.toFixed(2)} />
              <Metric label={t('reviewStSuspended')} value={String(data.suspended)} />
            </div>

            <div className="stats-section">{t('reviewStForecast')}</div>
            <div className="stats-forecast">
              {data.forecast.map(({ date, count }) => (
                <div key={date} className="stats-bar-wrap" title={`${date}: ${count}`}>
                  <div className="stats-bar" style={{ height: `${Math.round((count / peak) * 100)}%` }} />
                  <span className="stats-bar-label">{date.slice(8)}</span>
                </div>
              ))}
            </div>

            {data.topFiles.length > 0 && (
              <>
                <div className="stats-section">{t('reviewStTopNotes')}</div>
                <div className="stats-files">
                  {data.topFiles.map(({ file, count }) => (
                    <div key={file} className="stats-file">
                      <span className="stats-file-name">{file}</span>
                      <span className="stats-file-count">{count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stats-metric">
      <div className={`stats-value ${accent ? 'accent' : ''}`}>{value}</div>
      <div className="stats-label">{label}</div>
    </div>
  )
}
