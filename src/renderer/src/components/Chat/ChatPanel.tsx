import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { LlmSettings, ChatMessage } from '../../../../preload/index'
import { useT } from '../../i18n'
import './ChatPanel.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type LlmStatusInfo = { status: string; modelPath: string | null }
type View = 'chat' | 'settings'

// ── Root component ────────────────────────────────────────────────────────────

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [view,         setView]         = useState<View>('chat')
  const [messages,     setMessages]     = useState<ChatMessage[]>([])
  const [input,        setInput]        = useState('')
  const [generating,   setGenerating]   = useState(false)
  const [status,       setStatus]       = useState<LlmStatusInfo>({ status: 'idle', modelPath: null })
  const [loadProgress, setLoadProgress] = useState<number | null>(null)
  const [settings,     setSettingsState]= useState<LlmSettings | null>(null)
  const msgEndRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.api.llmStatus().then(setStatus)
    window.api.llmGetSettings().then(setSettingsState)
  }, [])

  // Subscribe to streaming events
  useEffect(() => {
    let buf = ''

    const u1 = window.api.onLlmChunk((text) => {
      buf += text
      const snap = buf
      setMessages((prev) => {
        if (prev[prev.length - 1]?.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content: snap }]
        }
        return prev
      })
    })

    const u2 = window.api.onLlmDone(() => {
      setGenerating(false)
      buf = ''
    })

    const u3 = window.api.onLlmError((msg) => {
      setGenerating(false)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content: `⚠ ${msg}` }]
        }
        return prev
      })
      buf = ''
    })

    const u4 = window.api.onLlmLoadProgress((p) => {
      setLoadProgress(p)
      if (p >= 100) {
        setLoadProgress(null)
        window.api.llmStatus().then(setStatus)
      }
    })

    return () => { u1(); u2(); u3(); u4() }
  }, [])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || generating) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const next = [...messages, userMsg, { role: 'assistant' as const, content: '' }]
    setMessages(next)
    setInput('')
    setGenerating(true)

    await window.api.llmGenerate([...messages, userMsg])
  }, [input, messages, generating])

  const handleNewChat = useCallback(() => {
    setMessages([])
    setGenerating(false)
  }, [])

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">💬 {t('chatTitle')}</span>
        <div className="chat-header-actions">
          <button
            className={`chat-icon-btn ${view === 'settings' ? 'active' : ''}`}
            onClick={() => setView((v) => v === 'settings' ? 'chat' : 'settings')}
            title={t('chatSettings')}
          >⚙</button>
          <button className="chat-icon-btn" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      {view === 'settings' ? (
        <ChatSettings
          settings={settings}
          status={status}
          loadProgress={loadProgress}
          onStatusChange={setStatus}
          onSettingsChange={setSettingsState}
        />
      ) : (
        <>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                {status.status === 'idle' ? (
                  <>
                    <p>{t('chatNoModel')}</p>
                    <button className="btn-secondary" onClick={() => setView('settings')}>
                      {t('chatGoSettings')}
                    </button>
                  </>
                ) : (
                  <p className="chat-empty-hint">{t('chatPlaceholder')}</p>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
                <div className="chat-msg-label">
                  {msg.role === 'user' ? t('chatYou') : t('chatAssistant')}
                </div>
                <div className="chat-msg-content">
                  {msg.content || (generating && i === messages.length - 1
                    ? <span className="chat-cursor">▋</span>
                    : null
                  )}
                  {generating && i === messages.length - 1 && msg.content && (
                    <span className="chat-cursor">▋</span>
                  )}
                </div>
              </div>
            ))}

            <div ref={msgEndRef} />
          </div>

          <div className="chat-status-bar">
            <span className={`chat-status-dot status-${status.status}`} />
            <span className="chat-status-label">
              {loadProgress !== null
                ? t('chatLoadProgress', { p: String(loadProgress) })
                : status.status === 'loaded'
                  ? (status.modelPath?.split(/[/\\]/).pop() ?? t('chatModelReady'))
                  : t('chatNoModel')}
            </span>
            <button className="chat-new-btn" onClick={handleNewChat} title={t('chatNewChat')}>
              {t('chatNewChat')}
            </button>
          </div>

          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chatPlaceholder')}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
            />
            <div className="chat-send-row">
              {generating
                ? <button className="btn-danger" onClick={() => window.api.llmCancel()}>{t('chatStop')}</button>
                : <button
                    className="btn-primary"
                    onClick={handleSend}
                    disabled={!input.trim() || status.status === 'idle'}
                  >{t('chatSend')}</button>
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Settings sub-panel ────────────────────────────────────────────────────────

function ChatSettings({
  settings, status, loadProgress, onStatusChange, onSettingsChange,
}: {
  settings: LlmSettings | null
  status: LlmStatusInfo
  loadProgress: number | null
  onStatusChange: (s: LlmStatusInfo) => void
  onSettingsChange: (s: LlmSettings) => void
}) {
  const t = useT()
  const [modelInput, setModelInput] = useState(settings?.modelPath ?? '')
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    setModelInput(settings?.modelPath ?? '')
  }, [settings?.modelPath])

  const save = useCallback(async (patch: Partial<LlmSettings>) => {
    const updated = await window.api.llmSetSettings(patch)
    onSettingsChange(updated)
  }, [onSettingsChange])

  const browse = useCallback(async () => {
    const p = await window.api.llmBrowseGguf()
    if (!p) return
    setModelInput(p)
    await save({ modelPath: p })
  }, [save])

  const loadModel = useCallback(async () => {
    const p = modelInput.trim()
    if (!p) return
    setLoading(true)
    try {
      await save({ modelPath: p })
      await window.api.llmLoad(p)
      onStatusChange(await window.api.llmStatus())
    } finally {
      setLoading(false)
    }
  }, [modelInput, save, onStatusChange])

  const unload = useCallback(async () => {
    await window.api.llmUnload()
    onStatusChange(await window.api.llmStatus())
  }, [onStatusChange])

  const isLocal = settings?.provider === 'local'
  const busy    = loading || loadProgress !== null

  return (
    <div className="chat-settings">

      {/* Provider */}
      <div className="chat-settings-row">
        <label>{t('chatProvider')}</label>
        <select
          value={settings?.provider ?? 'local'}
          onChange={(e) => save({ provider: e.target.value as LlmSettings['provider'] })}
        >
          <option value="local">{t('chatProviderLocal')}</option>
          <option value="anthropic">{t('chatProviderAnthropic')}</option>
          <option value="openai">{t('chatProviderOpenAI')}</option>
          <option value="gemini">{t('chatProviderGemini')}</option>
          <option value="openai-compatible">{t('chatProviderCompatible')}</option>
        </select>
      </div>

      {/* ── Local ── */}
      {isLocal && (
        <>
          <div className="chat-settings-row">
            <label>{t('chatModelFile')}</label>
            <div className="chat-file-row">
              <input
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                onBlur={() => save({ modelPath: modelInput })}
                placeholder="D:\models\model.gguf"
              />
              <button onClick={browse}>{t('chatBrowse')}</button>
            </div>
          </div>

          {loadProgress !== null && (
            <div className="chat-progress-wrap">
              <div className="chat-progress-bar" style={{ width: `${loadProgress}%` }} />
              <span className="chat-progress-label">
                {t('chatLoadProgress', { p: String(loadProgress) })}
              </span>
            </div>
          )}

          <div className="chat-model-actions">
            <button className="btn-primary" onClick={loadModel} disabled={!modelInput.trim() || busy}>
              {t('chatLoad')}
            </button>
            {status.status === 'loaded' && (
              <button onClick={unload}>{t('chatUnload')}</button>
            )}
          </div>

          {status.status === 'loaded' && (
            <div className="chat-model-status">
              ✓ {status.modelPath?.split(/[/\\]/).pop()}
            </div>
          )}
        </>
      )}

      {/* ── Remote ── */}
      {!isLocal && (
        <>
          <div className="chat-settings-row">
            <label>{t('chatApiKey')}</label>
            <input
              type="password"
              value={settings?.apiKey ?? ''}
              onChange={(e) => save({ apiKey: e.target.value })}
            />
          </div>

          {settings?.provider === 'openai-compatible' && (
            <div className="chat-settings-row">
              <label>{t('chatBaseUrl')}</label>
              <input
                value={settings?.baseUrl ?? ''}
                onChange={(e) => save({ baseUrl: e.target.value })}
                placeholder="http://localhost:1234/v1"
              />
            </div>
          )}

          <div className="chat-settings-row">
            <label>{t('chatRemoteModel')}</label>
            <input
              value={settings?.modelName ?? ''}
              onChange={(e) => save({ modelName: e.target.value })}
              placeholder={
                settings?.provider === 'anthropic'        ? 'claude-haiku-4-5-20251001' :
                settings?.provider === 'gemini'           ? 'gemini-1.5-flash'           :
                settings?.provider === 'openai-compatible'? ''                           :
                'gpt-4o-mini'
              }
            />
          </div>
        </>
      )}

      {/* System prompt (all providers) */}
      <div className="chat-settings-row chat-settings-row-grow">
        <label>{t('chatSystemPrompt')}</label>
        <textarea
          value={settings?.systemPrompt ?? ''}
          onChange={(e) => save({ systemPrompt: e.target.value })}
          rows={5}
        />
      </div>

    </div>
  )
}
