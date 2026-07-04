// LLM module — main process only.
// node-llama-cpp is ESM-only: always loaded via dynamic import(), never bundled.

import { app, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LlmProvider = 'local' | 'anthropic' | 'openai' | 'openai-compatible' | 'gemini'
export type LlmStatus   = 'idle' | 'loading' | 'loaded'

export interface ChatMessage {
  role:    'user' | 'assistant' | 'system'
  content: string
}

export interface LlmSettings {
  provider:     LlmProvider
  modelPath:    string
  systemPrompt: string
  apiKey:       string
  baseUrl:      string   // openai-compatible base URL
  modelName:    string   // remote model identifier
}

// ── Settings persistence ──────────────────────────────────────────────────────

const DEFAULTS: LlmSettings = {
  provider:     'local',
  modelPath:    '',
  systemPrompt: 'You are a helpful assistant.',
  apiKey:       '',
  baseUrl:      'https://api.openai.com/v1',
  modelName:    '',
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'llm-settings.json')
}

// API key is encrypted at rest via Electron safeStorage (OS keychain-backed).
// Marker prefix lets us distinguish encrypted values from legacy plaintext ones.
const ENC_PREFIX = 'enc:v1:'

function encryptSecret(plain: string): string {
  if (!plain) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return ENC_PREFIX + safeStorage.encryptString(plain).toString('base64')
    }
  } catch {}
  return plain // fallback: plaintext (previous behaviour) when encryption unavailable
}

function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return stored // legacy plaintext or empty
  try {
    return safeStorage.decryptString(Buffer.from(stored.slice(ENC_PREFIX.length), 'base64'))
  } catch {
    return ''
  }
}

export function getLlmSettings(): LlmSettings {
  try {
    const raw = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')) }
    raw.apiKey = decryptSecret(raw.apiKey)
    return raw
  } catch {
    return { ...DEFAULTS }
  }
}

export function setLlmSettings(patch: Partial<LlmSettings>): LlmSettings {
  const next = { ...getLlmSettings(), ...patch } // apiKey held in plaintext in memory
  try {
    const onDisk = { ...next, apiKey: encryptSecret(next.apiKey) }
    fs.writeFileSync(settingsPath(), JSON.stringify(onDisk, null, 2), 'utf-8')
  } catch {}
  return next
}

// ── Local inference state ─────────────────────────────────────────────────────

// Dynamic import — never bundle node-llama-cpp with rollup
let nlc: typeof import('node-llama-cpp') | null = null
let llamaInst: any  = null
let llmModel: any   = null
let llmContext: any = null
let abortCtrl: AbortController | null = null
let llmStatus: LlmStatus = 'idle'
let loadedPath: string | null = null

async function requireNlc() {
  if (!nlc) nlc = (await import('node-llama-cpp')) as any
  return nlc!
}

// ── Local model API ───────────────────────────────────────────────────────────

export function getStatus(): { status: LlmStatus; modelPath: string | null } {
  return { status: llmStatus, modelPath: loadedPath }
}

export async function loadModel(
  modelPath: string,
  onProgress: (p: number) => void,
): Promise<void> {
  await disposeLocal()

  llmStatus  = 'loading'
  loadedPath = null

  try {
    const { getLlama } = await requireNlc()

    if (!llamaInst) llamaInst = await getLlama()

    llmModel = await llamaInst.loadModel({
      modelPath,
      onLoadProgress: (p: number) => onProgress(Math.round(p * 100)),
    })
    llmContext = await llmModel.createContext()
    llmStatus  = 'loaded'
    loadedPath = modelPath
  } catch (e) {
    llmStatus  = 'idle'
    loadedPath = null
    throw e
  }
}

async function disposeLocal(): Promise<void> {
  try { llmContext?.dispose() } catch {}
  try { llmModel?.dispose()   } catch {}
  llmContext = null
  llmModel   = null
  llmStatus  = 'idle'
  loadedPath = null
}

export async function unloadModel(): Promise<void> {
  await disposeLocal()
}

export async function generateLocal(
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
): Promise<void> {
  if (llmStatus !== 'loaded' || !llmContext) throw new Error('No model loaded')

  const { LlamaChatSession } = await requireNlc()

  abortCtrl = new AbortController()
  const { signal } = abortCtrl

  // One sequence per generation, released in finally — fixes "No sequences left"
  const seq     = llmContext.getSequence()
  const session = new (LlamaChatSession as any)({ contextSequence: seq, systemPrompt })

  try {
    // Restore prior conversation so the model has context
    const history = messages.slice(0, -1).filter((m) => m.role !== 'system')
    if (history.length > 0) {
      const nlcHistory = history.map((m) =>
        m.role === 'user'
          ? { type: 'user',  text: m.content }
          : { type: 'model', response: [m.content] },
      )
      await session.setChatHistory(nlcHistory)
    }

    const last = messages[messages.length - 1]
    await session.prompt(last.content, { signal, onTextChunk: onChunk })
  } finally {
    try { (session as any).dispose?.() } catch {}
    try { seq.dispose?.()              } catch {}
    abortCtrl = null
  }
}

// ── Remote API (fetch-based, no extra packages) ───────────────────────────────

export async function generateRemote(
  messages: ChatMessage[],
  settings: LlmSettings,
  onChunk: (text: string) => void,
): Promise<void> {
  const ctrl = new AbortController()
  abortCtrl  = ctrl

  try {
    switch (settings.provider) {
      case 'anthropic':
        await anthropicStream(messages, settings, onChunk, ctrl.signal)
        break
      case 'openai':
      case 'openai-compatible':
        await openaiStream(messages, settings, onChunk, ctrl.signal)
        break
      case 'gemini':
        await geminiStream(messages, settings, onChunk, ctrl.signal)
        break
    }
  } finally {
    abortCtrl = null
  }
}

export function cancelGeneration(): void {
  abortCtrl?.abort()
}

// Single-shot transform (no streaming) — for fix/formalize/explain actions
export async function generateTransform(messages: ChatMessage[]): Promise<string> {
  const settings     = getLlmSettings()
  const sysMsg       = messages.find((m) => m.role === 'system')
  const systemPrompt = sysMsg?.content ?? ''
  const userMessages = messages.filter((m) => m.role !== 'system')

  let result = ''
  const collect = (t: string) => { result += t }

  if (settings.provider === 'local') {
    await generateLocal(userMessages, systemPrompt, collect)
  } else {
    await generateRemote(messages, { ...settings, systemPrompt }, collect)
  }

  return result.trim()
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

async function anthropicStream(
  messages: ChatMessage[],
  s: LlmSettings,
  onChunk: (t: string) => void,
  signal: AbortSignal,
) {
  const filtered = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key':         s.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      s.modelName || 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system:     s.systemPrompt,
      messages:   filtered,
      stream:     true,
    }),
  })
  if (!res.ok || !res.body) throw new Error(`Anthropic ${res.status}`)
  await readSse(res.body, (d) => {
    if (d.type === 'content_block_delta' && d.delta?.type === 'text_delta') onChunk(d.delta.text)
  })
}

// ── OpenAI / OpenAI-compatible ────────────────────────────────────────────────

async function openaiStream(
  messages: ChatMessage[],
  s: LlmSettings,
  onChunk: (t: string) => void,
  signal: AbortSignal,
) {
  const base = (s.provider === 'openai-compatible' ? s.baseUrl : 'https://api.openai.com/v1')
    .replace(/\/$/, '')

  const apiMessages = [
    { role: 'system', content: s.systemPrompt },
    ...messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
  ]

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${s.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model:    s.modelName || 'gpt-4o-mini',
      messages: apiMessages,
      stream:   true,
    }),
  })
  if (!res.ok || !res.body) throw new Error(`OpenAI ${res.status}`)
  await readSse(res.body, (d) => {
    const text = d.choices?.[0]?.delta?.content
    if (text) onChunk(text)
  })
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function geminiStream(
  messages: ChatMessage[],
  s: LlmSettings,
  onChunk: (t: string) => void,
  signal: AbortSignal,
) {
  const model    = s.modelName || 'gemini-1.5-flash'
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${s.apiKey}&alt=sse`
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: s.systemPrompt }] },
      contents,
    }),
  })
  if (!res.ok || !res.body) throw new Error(`Gemini ${res.status}`)
  await readSse(res.body, (d) => {
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text
    if (text) onChunk(text)
  })
}

// ── SSE reader ────────────────────────────────────────────────────────────────

async function readSse(
  body: ReadableStream<Uint8Array>,
  onData: (parsed: any) => void,
): Promise<void> {
  const reader  = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw || raw === '[DONE]') continue
      try { onData(JSON.parse(raw)) } catch {}
    }
  }
}
