import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react'
import { EditorState, Extension, Compartment } from '@codemirror/state'
import { EditorView, keymap, ViewUpdate, Decoration, DecorationSet, ViewPlugin } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { RangeSetBuilder } from '@codemirror/state'
import { search, searchKeymap, openSearchPanel } from '@codemirror/search'
import {
  autocompletion, CompletionContext, CompletionResult,
  closeBrackets, closeBracketsKeymap
} from '@codemirror/autocomplete'
import { NoteFile } from '../../store/vaultStore'
import { Theme } from '../../hooks/useSettings'
import { useT } from '../../i18n'
import './MarkdownEditor.css'

export interface MarkdownEditorHandle {
  insertText: (text: string, cursorOffset?: number) => void
  focus: () => void
  openFind: () => void
}

export interface EditorStats {
  words: number
  chars: number
  line: number
  col: number
}

// ── WikiLink decoration ────────────────────────────────────────────────────

const wikilinkMark = Decoration.mark({ class: 'cm-wikilink' })

const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = this.build(view) }
    update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view) }
    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>()
      const re = /\[\[[^\]]+\]\]/g
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to)
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null)
          builder.add(from + m.index, from + m.index + m[0].length, wikilinkMark)
      }
      return builder.finish()
    }
  },
  { decorations: (v) => v.decorations }
)

// ── Themes ────────────────────────────────────────────────────────────────

const markdownHighlightDark = HighlightStyle.define([
  { tag: tags.heading1,  fontSize: '1.6em', fontWeight: 'bold' },
  { tag: tags.heading2,  fontSize: '1.4em', fontWeight: 'bold' },
  { tag: tags.heading3,  fontSize: '1.2em', fontWeight: 'bold' },
  { tag: tags.strong,    fontWeight: 'bold' },
  { tag: tags.emphasis,  fontStyle: 'italic' },
  { tag: tags.link,      color: '#a78bfa', textDecoration: 'underline' },
  { tag: tags.monospace, fontFamily: 'var(--editor-font, monospace)' }
])

const markdownHighlightLight = HighlightStyle.define([
  { tag: tags.heading1,  fontSize: '1.6em', fontWeight: 'bold', color: '#1e1b4b' },
  { tag: tags.heading2,  fontSize: '1.4em', fontWeight: 'bold', color: '#1e1b4b' },
  { tag: tags.heading3,  fontSize: '1.2em', fontWeight: 'bold', color: '#1e1b4b' },
  { tag: tags.strong,    fontWeight: 'bold' },
  { tag: tags.emphasis,  fontStyle: 'italic' },
  { tag: tags.link,      color: '#6d28d9', textDecoration: 'underline' },
  { tag: tags.monospace, fontFamily: 'var(--editor-font, monospace)', color: '#6d28d9' },
  { tag: tags.string,    color: '#059669' },
  { tag: tags.comment,   color: '#6b7280', fontStyle: 'italic' }
])

const lightEditorTheme = EditorView.theme({
  '&': { background: 'transparent', color: 'var(--text-primary)' },
  '.cm-content': { caretColor: 'var(--text-primary)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text-primary)' },
  '& .cm-selectionBackground': { background: 'rgba(109,40,217,0.15) !important' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': { background: 'rgba(109,40,217,0.2)' },
  '.cm-activeLine': { background: 'rgba(0,0,0,0.04)' },
  '.cm-gutters': { background: 'transparent', border: 'none', color: '#9ca3af' },
  '.cm-panels': { background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)' },
  '.cm-search': { padding: '6px 10px' },
  '.cm-search input': { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', padding: '3px 7px' },
  '.cm-button': { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer' },
}, { dark: false })

const darkSearchTheme = EditorView.theme({
  '.cm-panels': { background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)' },
  '.cm-search': { padding: '6px 10px' },
  '.cm-search input': { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', padding: '3px 7px' },
  '.cm-button': { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer' },
})

function buildThemeExtensions(theme: Theme): Extension[] {
  if (theme === 'dark') return [oneDark, darkSearchTheme, syntaxHighlighting(markdownHighlightDark)]
  return [lightEditorTheme, syntaxHighlighting(markdownHighlightLight)]
}

// ── WikiLink autocomplete ──────────────────────────────────────────────────

function makeWikilinkCompletion(
  filesRef: React.MutableRefObject<NoteFile[]>,
  aliasesRef: React.MutableRefObject<{ alias: string; note: string }[]>,
) {
  // closeBrackets already typed the closing `]]` when the user typed `[[`, so
  // appending our own produced `[[Note]]]]`. Insert the text, then add the
  // brackets only if they are not already sitting after the cursor.
  const applyLink = (text: string) =>
    (view: EditorView, _c: unknown, from: number, to: number): void => {
      const after = view.state.doc.sliceString(to, to + 2)
      const insert = after === ']]' ? text : `${text}]]`
      const anchor = from + insert.length + (after === ']]' ? 2 : 0)
      view.dispatch({ changes: { from, to, insert }, selection: { anchor } })
    }

  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\[\[[^\]]*/)
    if (!match) return null
    const query = match.text.slice(2).toLowerCase()

    const notes = filesRef.current
      .filter((f) => f.name.toLowerCase().includes(query))
      .slice(0, 30)
      .map((f) => ({
        label: f.name,
        apply: applyLink(f.name),
        type: 'text',
        detail: f.relativePath.includes('/') || f.relativePath.includes('\\')
          ? f.relativePath.split(/[/\\]/)[0] : 'note',
        boost: f.name.toLowerCase().startsWith(query) ? 1 : 0
      }))

    // Insert the alias as written: `[[IAM]]` resolves through the alias index,
    // and if the alias is ever removed the link shows up as broken (red, and
    // listed in the vault diagnostics) instead of silently rotting
    const aliases = aliasesRef.current
      .filter((a) => a.alias.toLowerCase().includes(query))
      .slice(0, 15)
      .map((a) => ({
        label: a.alias,
        apply: applyLink(a.alias),
        type: 'keyword',
        detail: a.note,
        boost: a.alias.toLowerCase().startsWith(query) ? 1 : 0
      }))

    return { from: match.from + 2, options: [...notes, ...aliases], filter: false }
  }
}

// ── Slash commands ─────────────────────────────────────────────────────────

type SlashCmd = { label: string; detail: string; apply: string; cursor?: number }

const SLASH_COMMANDS: SlashCmd[] = [
  // Structure
  { label: '/h1',       detail: 'Heading 1',       apply: '# ',                                                    cursor: 2 },
  { label: '/h2',       detail: 'Heading 2',       apply: '## ',                                                   cursor: 3 },
  { label: '/h3',       detail: 'Heading 3',       apply: '### ',                                                  cursor: 4 },
  { label: '/bold',     detail: 'Bold text',       apply: '**text**',                                              cursor: -2 },
  { label: '/italic',   detail: 'Italic text',     apply: '*text*',                                                cursor: -1 },
  { label: '/table',    detail: 'Insert table',    apply: '| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n' },
  { label: '/code',     detail: 'Code block',      apply: '```\n\n```',                                            cursor: -4 },
  { label: '/inline',   detail: 'Inline code',     apply: '`code`',                                                cursor: -1 },
  { label: '/quote',    detail: 'Blockquote',      apply: '> ' },
  { label: '/hr',       detail: 'Horizontal rule', apply: '\n---\n' },
  { label: '/check',    detail: 'Task list',       apply: '- [ ] \n- [ ] \n- [ ] ',                               cursor: -14 },
  { label: '/list',     detail: 'Bullet list',     apply: '- ' },
  { label: '/numlist',  detail: 'Numbered list',   apply: '1. ' },
  { label: '/link',     detail: 'Web link',        apply: '[text](https://)',                                       cursor: -1 },
  { label: '/image',    detail: 'Image',           apply: '![alt](url)',                                           cursor: -1 },
  { label: '/wikilink', detail: 'Link to note',    apply: '[[',                                                    cursor: 0 },
  { label: '/date',     detail: 'Today\'s date',   apply: new Date().toISOString().slice(0, 10) },
  // Symbols
  { label: '/rarr',     detail: '→  Right arrow',  apply: '→' },
  { label: '/larr',     detail: '←  Left arrow',   apply: '←' },
  { label: '/uarr',     detail: '↑  Up arrow',     apply: '↑' },
  { label: '/darr',     detail: '↓  Down arrow',   apply: '↓' },
  { label: '/harr',     detail: '↔  Both arrows',  apply: '↔' },
  { label: '/tick',     detail: '✓  Check mark',   apply: '✓' },
  { label: '/cross',    detail: '✗  Cross mark',   apply: '✗' },
  { label: '/star',     detail: '★  Star',         apply: '★' },
  { label: '/mdash',    detail: '—  Em dash',      apply: '—' },
  { label: '/dots',     detail: '…  Ellipsis',     apply: '…' },
  { label: '/copy',     detail: '©  Copyright',    apply: '©' },
  { label: '/tm',       detail: '™  Trademark',    apply: '™' },
]

function slashCompletion(context: CompletionContext): CompletionResult | null {
  const match = context.matchBefore(/\/\w*/)
  if (!match) return null
  const before = context.state.doc.sliceString(Math.max(0, match.from - 1), match.from)
  if (match.from > 0 && !/[\s\n]/.test(before)) return null
  const query = match.text.slice(1).toLowerCase()
  const options = SLASH_COMMANDS
    .filter((c) => c.label.slice(1).startsWith(query) || c.detail.toLowerCase().includes(query))
    .map((c) => ({
      label: c.label, detail: c.detail, type: 'keyword',
      apply: (view: EditorView, _: any, from: number, to: number) => {
        const text = c.apply
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length + (c.cursor ?? 0) }
        })
      }
    }))
  return { from: match.from, options, filter: false }
}

// ── Component ─────────────────────────────────────────────────────────────

interface MarkdownEditorProps {
  content: string
  onChange: (value: string) => void
  onWikiLinkClick: (noteName: string) => void
  vaultPath: string | null
  files: NoteFile[]
  /** Frontmatter aliases, offered in the [[ autocomplete */
  aliases?: { alias: string; note: string }[]
  theme: Theme
  onStatsChange?: (stats: EditorStats) => void
  onAiExplain?: (text: string) => void
  onAiNeedModel?: () => void
}

type CtxMenuState = {
  x: number; y: number; hasSelection: boolean
  selFrom: number; selTo: number; selText: string
} | null

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ content, onChange, onWikiLinkClick, vaultPath, files, aliases = [], theme, onStatsChange, onAiExplain, onAiNeedModel }, ref) => {
    const t               = useT()
    const editorRef       = useRef<HTMLDivElement>(null)
    const viewRef         = useRef<EditorView | null>(null)
    const onChangeRef     = useRef(onChange)
    const onWikiLinkRef   = useRef(onWikiLinkClick)
    const vaultPathRef    = useRef(vaultPath)
    const filesRef        = useRef(files)
    const aliasesRef      = useRef(aliases)
    const onStatsRef      = useRef(onStatsChange)
    const onAiExplainRef  = useRef(onAiExplain)
    const onAiNeedModelRef = useRef(onAiNeedModel)
    const themeCompartment = useRef(new Compartment())
    const [ctxMenu, setCtxMenu] = useState<CtxMenuState>(null)
    const [aiLoading, setAiLoading] = useState(false)

    useEffect(() => { onChangeRef.current = onChange },              [onChange])
    useEffect(() => { onWikiLinkRef.current = onWikiLinkClick },     [onWikiLinkClick])
    useEffect(() => { vaultPathRef.current = vaultPath },            [vaultPath])
    useEffect(() => { filesRef.current = files },                    [files])
    useEffect(() => { aliasesRef.current = aliases },                [aliases])
    useEffect(() => { onStatsRef.current = onStatsChange },          [onStatsChange])
    useEffect(() => { onAiExplainRef.current = onAiExplain },        [onAiExplain])
    useEffect(() => { onAiNeedModelRef.current = onAiNeedModel },    [onAiNeedModel])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({ effects: themeCompartment.current.reconfigure(buildThemeExtensions(theme)) })
    }, [theme])

    useImperativeHandle(ref, () => ({
      insertText: (text: string, cursorOffset = 0) => {
        const view = viewRef.current
        if (!view) return
        const { from, to } = view.state.selection.main
        view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length + cursorOffset } })
        view.focus()
      },
      focus: () => viewRef.current?.focus(),
      openFind: () => { if (viewRef.current) openSearchPanel(viewRef.current) }
    }))

    const handleCopy = useCallback(async () => {
      const view = viewRef.current; if (!view) return
      const { from, to } = view.state.selection.main
      if (from !== to) await navigator.clipboard.writeText(view.state.doc.sliceString(from, to))
      setCtxMenu(null)
    }, [])

    const handleCut = useCallback(async () => {
      const view = viewRef.current; if (!view) return
      const { from, to } = view.state.selection.main
      if (from !== to) {
        await navigator.clipboard.writeText(view.state.doc.sliceString(from, to))
        view.dispatch({ changes: { from, to, insert: '' } })
        view.focus()
      }
      setCtxMenu(null)
    }, [])

    const handlePaste = useCallback(async () => {
      const view = viewRef.current; if (!view) return
      try {
        const text = await navigator.clipboard.readText()
        const { from, to } = view.state.selection.main
        view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
        view.focus()
      } catch {}
      setCtxMenu(null)
    }, [])

    const handleSelectAll = useCallback(() => {
      const view = viewRef.current; if (!view) return
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
      view.focus()
      setCtxMenu(null)
    }, [])

    const wrapSelection = useCallback((before: string, after: string, placeholder = '') => {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      const selected = view.state.doc.sliceString(from, to)
      const text = selected ? `${before}${selected}${after}` : `${before}${placeholder}${after}`
      const cursorPos = selected ? from + text.length : from + before.length + placeholder.length
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: cursorPos } })
      view.focus()
      setCtxMenu(null)
    }, [])

    const insertAtCursor = useCallback((text: string, cursorOffset = 0) => {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length + cursorOffset } })
      view.focus()
      setCtxMenu(null)
    }, [])

    const handleImageFile = useCallback(async (file: File) => {
      if (!vaultPathRef.current) return
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1]
        const ext  = file.name.split('.').pop() ?? 'png'
        const name = `${Date.now()}.${ext}`
        const relPath = await window.api.saveImage(vaultPathRef.current!, name, base64)
        const view = viewRef.current
        if (!view) return
        const { from, to } = view.state.selection.main
        view.dispatch({ changes: { from, to, insert: `![${file.name}](${relPath})` } })
      }
      reader.readAsDataURL(file)
    }, [])

    const handleClick = useCallback((e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('cm-wikilink')) {
        const noteName = (target.textContent ?? '').replace(/^\[\[|\]\]$/g, '').split('|')[0].trim()
        if (e.ctrlKey || e.metaKey) onWikiLinkRef.current(noteName)
      }
    }, [])

    useEffect(() => {
      if (!editorRef.current) return

      const emitStats = (state: EditorState) => {
        if (!onStatsRef.current) return
        const text    = state.doc.toString()
        const words   = text.trim() ? text.trim().split(/\s+/).length : 0
        const mainSel = state.selection.main
        const lineObj = state.doc.lineAt(mainSel.head)
        onStatsRef.current({ words, chars: text.length, line: lineObj.number, col: mainSel.head - lineObj.from + 1 })
      }

      const extensions: Extension[] = [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...closeBracketsKeymap, ...searchKeymap]),
        closeBrackets(),
        markdown({ base: markdownLanguage }),
        search({ top: false }),
        themeCompartment.current.of(buildThemeExtensions(theme)),
        wikilinkPlugin,
        EditorView.lineWrapping,
        autocompletion({
          override: [makeWikilinkCompletion(filesRef, aliasesRef), slashCompletion],
          closeOnBlur: true,
          activateOnTyping: true,
          icons: true
        }),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          if (update.docChanged || update.selectionSet) emitStats(update.state)
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: 'var(--font-size-editor, 14px)' },
          '.cm-scroller': { fontFamily: 'var(--editor-font, JetBrains Mono, monospace)', overflow: 'auto' },
          '.cm-content': { padding: '16px 20px', minHeight: '100%' },
          '.cm-focused': { outline: 'none' },
          '.cm-wikilink': { color: '#a78bfa', cursor: 'pointer', textDecoration: 'underline' },
          '.cm-line': { lineHeight: '1.7' },
          '.cm-tooltip-autocomplete': { background: 'var(--bg-floating)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', fontSize: '13px' },
          '.cm-tooltip-autocomplete ul li': { padding: '5px 12px', color: 'var(--text-secondary)' },
          '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'var(--accent-bg)', color: 'var(--text-primary)' },
          '.cm-completionLabel': { color: 'var(--accent)' },
          '.cm-completionDetail': { color: 'var(--text-muted)', fontSize: '11px' }
        })
      ]

      const state = EditorState.create({ doc: content, extensions })
      const view = new EditorView({ state, parent: editorRef.current })
      viewRef.current = view
      emitStats(state)

      editorRef.current.addEventListener('click', handleClick)  // removed via `host` below

      const onPaste = (e: ClipboardEvent) => {
        if (!e.clipboardData?.items) return
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.type.startsWith('image/')) { e.preventDefault(); const f = item.getAsFile(); if (f) { handleImageFile(f); break } }
        }
      }
      const onDrop = (e: DragEvent) => {
        const dropped = e.dataTransfer?.files
        if (!dropped) return
        for (const file of Array.from(dropped)) { if (file.type.startsWith('image/')) { e.preventDefault(); handleImageFile(file) } }
      }
      const onContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        const sel = view.state.selection.main
        setCtxMenu({
          x: e.clientX, y: e.clientY,
          hasSelection: !sel.empty,
          selFrom: sel.from, selTo: sel.to,
          selText: view.state.doc.sliceString(sel.from, sel.to),
        })
      }

      // Held in a local: by cleanup time the ref may already point elsewhere,
      // and the listeners would then be removed from the wrong element
      const host = editorRef.current
      host.addEventListener('paste', onPaste)
      host.addEventListener('drop', onDrop)
      host.addEventListener('contextmenu', onContextMenu)

      return () => {
        host.removeEventListener('click', handleClick)
        host.removeEventListener('paste', onPaste)
        host.removeEventListener('drop', onDrop)
        host.removeEventListener('contextmenu', onContextMenu)
        view.destroy()
      }
      // Runs once on purpose. `content` is the initial document, `theme` is
      // swapped through a compartment in the effect below, and the handlers are
      // read through refs — listing them here would tear down and rebuild the
      // whole editor on every keystroke.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      const current = view.state.doc.toString()
      if (current !== content) view.dispatch({ changes: { from: 0, to: current.length, insert: content } })
    }, [content])

    const handleAiTransform = useCallback(async (action: 'fix' | 'formalize', from: number, to: number, text: string) => {
      setCtxMenu(null)
      const { status } = await window.api.llmStatus()
      if (status !== 'loaded') { onAiNeedModelRef.current?.(); return }
      const prompts = {
        fix:       'You are a text editor. Fix grammar, spelling and punctuation. Return ONLY the corrected text.',
        formalize: 'You are a text editor. Rewrite the text in a formal, professional tone. Return ONLY the rewritten text.',
      }
      setAiLoading(true)
      try {
        const result = await window.api.llmTransform([
          { role: 'system', content: prompts[action] },
          { role: 'user',   content: text },
        ])
        const view = viewRef.current
        if (!view || !result) return
        view.dispatch({ changes: { from, to, insert: result }, selection: { anchor: from + result.length } })
        view.focus()
      } catch {}
      setAiLoading(false)
    }, [])

    const handleAiExplain = useCallback((text: string) => {
      setCtxMenu(null)
      onAiExplainRef.current?.(text)
    }, [])

    return (
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        <div ref={editorRef} className="markdown-editor" />
        {aiLoading && <div className="editor-ai-loading">✦ {t('aiTransforming')}</div>}
        {ctxMenu && (
          <EditorContextMenu
            x={ctxMenu.x} y={ctxMenu.y}
            hasSelection={ctxMenu.hasSelection}
            selFrom={ctxMenu.selFrom} selTo={ctxMenu.selTo} selText={ctxMenu.selText}
            onClose={() => setCtxMenu(null)}
            onWrap={wrapSelection}
            onInsert={insertAtCursor}
            onCopy={handleCopy}
            onCut={handleCut}
            onPaste={handlePaste}
            onSelectAll={handleSelectAll}
            onAiTransform={handleAiTransform}
            onAiExplain={handleAiExplain}
          />
        )}
      </div>
    )
  }
)

MarkdownEditor.displayName = 'MarkdownEditor'
export default MarkdownEditor

// ── Editor context menu ───────────────────────────────────────────────────

interface EditorCtxProps {
  x: number; y: number; hasSelection: boolean
  selFrom: number; selTo: number; selText: string
  onClose: () => void
  onWrap: (before: string, after: string, placeholder?: string) => void
  onInsert: (text: string, cursorOffset?: number) => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onSelectAll: () => void
  onAiTransform: (action: 'fix' | 'formalize', from: number, to: number, text: string) => void
  onAiExplain: (text: string) => void
}

function EditorContextMenu({ x, y, hasSelection, selFrom, selTo, selText, onClose, onWrap, onInsert, onCopy, onCut, onPaste, onSelectAll, onAiTransform, onAiExplain }: EditorCtxProps) {
  const t = useT()
  const today = new Date().toISOString().slice(0, 10)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      x: Math.max(0, x + rect.width  > window.innerWidth  ? x - rect.width  : x),
      y: Math.max(0, y + rect.height > window.innerHeight ? y - rect.height : y)
    })
  }, [x, y])

  return (
    <>
      <div className="editor-ctx-backdrop" onClick={onClose} onContextMenu={onClose} />
      <div ref={menuRef} className="context-menu editor-context-menu" style={{ left: pos.x, top: pos.y }} onClick={(e) => e.stopPropagation()}>

        {/* Clipboard */}
        {hasSelection && <button onClick={onCut}><span className="ctx-icon">✂</span> {t('ctxCut')}</button>}
        {hasSelection && <button onClick={onCopy}><span className="ctx-icon">⎘</span> {t('ctxCopy')}</button>}
        <button onClick={onPaste}><span className="ctx-icon">⎗</span> {t('ctxPaste')}</button>
        <button onClick={onSelectAll}>{t('ctxSelectAll')}</button>
        <hr />

        {/* Format selection */}
        {hasSelection && (
          <>
            <div className="ctx-section-label">{t('ctxFormat')}</div>
            <button onClick={() => onWrap('**', '**', 'bold')}><span className="ctx-icon">B</span> {t('insBold')}</button>
            <button onClick={() => onWrap('*', '*', 'italic')}><span className="ctx-icon ctx-italic">I</span> {t('insItalic')}</button>
            <button onClick={() => onWrap('~~', '~~', 'text')}><span className="ctx-icon ctx-strike">S</span> {t('ctxStrikethrough')}</button>
            <button onClick={() => onWrap('`', '`', 'code')}><span className="ctx-icon">&lt;/&gt;</span> {t('insInlineCode')}</button>
            <button onClick={() => onWrap('[', '](https://)', 'text')}><span className="ctx-icon">🔗</span> {t('ctxLink')}</button>
            <button onClick={() => onWrap('[[', ']]', '')}><span className="ctx-icon">⬡</span> {t('ctxWikiLink')}</button>
            <hr />
          </>
        )}

        {/* Insert */}
        <div className="ctx-section-label">{t('ctxInsertLabel')}</div>
        <button onClick={() => onInsert('# ', 0)}>{t('insHeading1')}</button>
        <button onClick={() => onInsert('## ', 0)}>{t('insHeading2')}</button>
        <button onClick={() => onInsert('### ', 0)}>{t('insHeading3')}</button>
        <hr />
        <button onClick={() => onInsert('| Col 1 | Col 2 |\n| --- | --- |\n| Cell | Cell |\n')}>{t('insTable')}</button>
        <button onClick={() => onInsert('```\n\n```', -4)}>{t('insCodeBlock')}</button>
        <button onClick={() => onInsert('> ', 0)}>{t('insBlockquote')}</button>
        <button onClick={() => onInsert('- [ ] \n- [ ] \n- [ ] ', -14)}>{t('insTaskList')}</button>
        <button onClick={() => onInsert('\n---\n', 0)}>{t('insHr')}</button>
        <button onClick={() => onInsert(today, 0)}>{t('ctxTodayDate')}</button>

        {/* AI actions */}
        {hasSelection && (
          <>
            <hr />
            <div className="ctx-section-label">✦ {t('ctxAiLabel')}</div>
            <button onClick={() => onAiTransform('fix', selFrom, selTo, selText)}>
              <span className="ctx-icon">✓</span> {t('aiFixText')}
            </button>
            <button onClick={() => onAiTransform('formalize', selFrom, selTo, selText)}>
              <span className="ctx-icon">✦</span> {t('aiFormalizeText')}
            </button>
            <button onClick={() => onAiExplain(selText)}>
              <span className="ctx-icon">💬</span> {t('aiExplainText')}
            </button>
          </>
        )}
      </div>
    </>
  )
}
