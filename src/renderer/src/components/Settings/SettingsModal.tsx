import React from 'react'
import type { Settings } from '../../hooks/useSettings'
import type { PluginInfo } from '../../../../preload/index'
import { useT, LOCALES } from '../../i18n'
import { X } from 'lucide-react'
import { useModalA11y } from '../../hooks/useModalA11y'
import './SettingsModal.css'

interface SettingsModalProps {
  settings:          Settings
  onChange:          (patch: Partial<Settings>) => void
  onClose:           () => void
  plugins:           PluginInfo[]
  onPluginToggle:    (id: string, enabled: boolean) => void
  onPluginInstallZip:() => void
  onPluginOpenDir:   () => void
  onPluginDelete:    (id: string) => void
}

export default function SettingsModal({
  settings, onChange, onClose,
  plugins, onPluginToggle, onPluginInstallZip, onPluginOpenDir, onPluginDelete,
}: SettingsModalProps) {
  const t = useT()
  const dialogRef = useModalA11y<HTMLDivElement>(onClose)

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>{t('settings')}</h2>
          <button className="settings-close" onClick={onClose} aria-label={t('close')}><X size={16} /></button>
        </div>

        <div className="settings-body">
          <section>
            <h3>{t('appearance')}</h3>

            <div className="setting-row">
              <label>{t('theme')}</label>
              <div className="theme-toggle">
                <button
                  className={settings.theme === 'dark' ? 'active' : ''}
                  onClick={() => onChange({ theme: 'dark' })}
                >
                  {t('themeDark')}
                </button>
                <button
                  className={settings.theme === 'light' ? 'active' : ''}
                  onClick={() => onChange({ theme: 'light' })}
                >
                  {t('themeLight')}
                </button>
              </div>
            </div>

            <div className="setting-row">
              <label>{t('editorFontSize')}</label>
              <div className="font-size-picker">
                {[12, 13, 14, 15, 16, 18].map((s) => (
                  <button
                    key={s}
                    className={settings.fontSize === s ? 'active' : ''}
                    onClick={() => onChange({ fontSize: s })}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-row">
              <label>{t('editorFont')}</label>
              <select
                value={settings.editorFont}
                onChange={(e) => onChange({ editorFont: e.target.value })}
              >
                <option value="JetBrains Mono, Fira Code, monospace">JetBrains Mono</option>
                <option value="Fira Code, monospace">Fira Code</option>
                <option value="Cascadia Code, monospace">Cascadia Code</option>
                <option value="Consolas, monospace">Consolas</option>
                <option value="system-ui, sans-serif">System UI</option>
              </select>
            </div>
          </section>

          <section>
            <h3>{t('language')}</h3>
            <div className="setting-row">
              <div className="locale-picker">
                {LOCALES.map(({ value, label }) => (
                  <button
                    key={value}
                    className={settings.locale === value ? 'active' : ''}
                    onClick={() => onChange({ locale: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h3>{t('plugins')}</h3>

            <div className="plugin-list">
              {plugins.length === 0 ? (
                <p className="plugin-list-empty">{t('pluginsEmpty')}</p>
              ) : (
                plugins.map((p) => (
                  <div key={p.id} className="plugin-item">
                    <span className="plugin-item-icon">{p.icon ?? '⬡'}</span>
                    <div className="plugin-item-info">
                      <span className="plugin-item-name">{p.name}</span>
                      <span className="plugin-item-meta">v{p.version}{p.author ? ` · ${p.author}` : ''}</span>
                      {p.description && <span className="plugin-item-desc">{p.description}</span>}
                    </div>
                    <div className="plugin-item-actions">
                      <label className="plugin-toggle" title={p.enabled ? t('pluginDisable') : t('pluginEnable')}>
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) => onPluginToggle(p.id, e.target.checked)}
                        />
                        <span className="plugin-toggle-track" />
                      </label>
                      <button
                        className="plugin-delete-btn"
                        onClick={() => onPluginDelete(p.id)}
                        title={t('pluginDelete')}
                      >🗑</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="plugin-footer">
              <button className="plugin-action-btn" onClick={onPluginInstallZip}>
                ⬆ {t('pluginInstallZip')}
              </button>
              <button className="plugin-action-btn" onClick={onPluginOpenDir}>
                📂 {t('pluginOpenDir')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
