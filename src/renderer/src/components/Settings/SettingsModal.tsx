import React from 'react'
import type { Settings } from '../../hooks/useSettings'
import { useT, LOCALES } from '../../i18n'
import './SettingsModal.css'

interface SettingsModalProps {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

export default function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  const t = useT()

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t('settings')}</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
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
        </div>
      </div>
    </div>
  )
}
