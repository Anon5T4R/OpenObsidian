import React from 'react'
import type { Settings } from '../../hooks/useSettings'
import './SettingsModal.css'

interface SettingsModalProps {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

export default function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          <section>
            <h3>Appearance</h3>

            <div className="setting-row">
              <label>Theme</label>
              <div className="theme-toggle">
                <button
                  className={settings.theme === 'dark' ? 'active' : ''}
                  onClick={() => onChange({ theme: 'dark' })}
                >
                  🌙 Dark
                </button>
                <button
                  className={settings.theme === 'light' ? 'active' : ''}
                  onClick={() => onChange({ theme: 'light' })}
                >
                  ☀️ Light
                </button>
              </div>
            </div>

            <div className="setting-row">
              <label>Editor font size</label>
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
              <label>Editor font</label>
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
        </div>
      </div>
    </div>
  )
}
