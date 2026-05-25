import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { EditorState, Extension } from '@codemirror/state'
import { EditorView, keymap, ViewUpdate, Decoration, DecorationSet, ViewPlugin } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { RangeSetBuilder } from '@codemirror/state'
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  closeBrackets,
  closeBracketsKeymap
} from '@codemirror/autocomplete'
import { NoteFile } from '../../store/vaultStore'
import './MarkdownEditor.css'

export interface MarkdownEditorHandle {
  insertText: (text: string, cursorOffset?: number) => void
  focus: () => void
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

// ── Markdown highlight ─────────────────────────────────────────────────────

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: 'bold' },
  { tag: tags.heading2, fontSize: '1.4em', fontWeight: 'bold' },
  { tag: tags.heading3, fontSize: '1.2em', fontWeight: 'bold' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.link, color: '#7ab3f5', textDecoration: 'underline' },
  { tag: tags.monospace, fontFamily: 'var(--editor-font, monospace)' }
])

// ── WikiLink autocomplete ──────────────────────────────────────────────────

function makeWikilinkCompletion(filesRef: React.MutableRefObject<NoteFile[]>) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\[\[[^\]]*/)
    if (!match) return null
    const query = match.text.slice(2)
    const options = filesRef.current
      .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 30)
      .map((f) => ({
        label: f.name,
        apply: `${f.name}]]`,
        type: 'text',
        detail: f.relativePath.includes('/') || f.relativePath.includes('\\')
          ? f.relativePath.split(/[/\\]/)[0]
          : 'note',
        boost: f.name.toLowerCase().startsWith(query.toLowerCase()) ? 1 : 0
      }))
    return { from: match.from + 2, options, filter: false }
  }
}

// ── Slash commands ────────────────────────────────────────────────────────

type SlashCmd = { label: string; detail: string; apply: string; cursor?: number }

const SLASH_COMMANDS: SlashCmd[] = [
  { label: '/h1',        detail: 'Heading 1',      apply: '# ',                         cursor: 2 },
  { label: '/h2',        detail: 'Heading 2',      apply: '## ',                        cursor: 3 },
  { label: '/h3',        detail: 'Heading 3',      apply: '### ',                       cursor: 4 },
  { label: '/bold',      detail: 'Bold text',      apply: '**text**',                   cursor: -2 },
  { label: '/italic',    detail: 'Italic text',    apply: '*text*',                     cursor: -1 },
  { label: '/table',     detail: 'Insert table',   apply: '| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n' },
  { label: '/code',      detail: 'Code block',     apply: '```\n\n```',                 cursor: -4 },
  { label: '/inline',    detail: 'Inline code',    apply: '`code`',                     cursor: -1 },
  { label: '/quote',     detail: 'Blockquote',     apply: '> ' },
  { label: '/hr',        detail: 'Horizontal rule', apply: '\n---\n' },
  { label: '/check',     detail: 'Checkbox list',  apply: '- [ ] ' },
  { label: '/list',      detail: 'Bullet list',    apply: '- ' },
  { label: '/numlist',   detail: 'Numbered list',  apply: '1. ' },
  { label: '/link',      detail: 'Web link',       apply: '[text](https://)',            cursor: -1 },
  { label: '/image',     detail: 'Image',          apply: '![alt](url)',                cursor: -1 },
  { label: '/wikilink',  detail: 'Link to note',   apply: '[[',                         cursor: 0 },
  { label: '/date',      detail: 'Today\'s date',  apply: new Date().toISOString().slice(0, 10) },
]

function slashCompletion(context: CompletionContext): CompletionResult | null {
  const match = context.matchBefore(/\/\w*/)
  if (!match) return null
  // Only trigger at start of line or after whitespace
  const before = context.state.doc.sliceString(Math.max(0, match.from - 1), match.from)
  if (match.from > 0 && !/[\s\n]/.test(before)) return null

  const query = match.text.slice(1).toLowerCase()
  const options = SLASH_COMMANDS
    .filter((c) => c.label.slice(1).startsWith(query) || c.detail.toLowerCase().includes(query))
    .map((c) => ({
      label: c.label,
      detail: c.detail,
      type: 'keyword',
      apply: (view: EditorView, _completion: any, from: number, to: number) => {
        const text = c.apply
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length + (c.cursor ?? 0) }
        })
      }
    }))
  return { from: match.from, options, filter: false }
}

// ── Component ────────────────────────────────────────────────────────────

interface MarkdownEditorProps {
  content: string
  onChange: (value: string) => void
  onWikiLinkClick: (noteName: string) => void
  vaultPath: string | null
  files: NoteFile[]
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ content, onChange, onWikiLinkClick, vaultPath, files }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const onWikiLinkClickRef = useRef(onWikiLinkClick)
    const vaultPathRef = useRef(vaultPath)
    const filesRef = useRef(files)

    useEffect(() => { onChangeRef.current = onChange }, [onChange])
    useEffect(() => { onWikiLinkClickRef.current = onWikiLinkClick }, [onWikiLinkClick])
    useEffect(() => { vaultPathRef.current = vaultPath }, [vaultPath])
    useEffect(() => { filesRef.current = files }, [files])

    useImperativeHandle(ref, () => ({
      insertText: (text: string, cursorOffset = 0) => {
        const view = viewRef.current
        if (!view) return
        const { from, to } = view.state.selection.main
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length + cursorOffset }
        })
        view.focus()
      },
      focus: () => viewRef.current?.focus()
    }))

    const handleImageFile = useCallback(async (file: File) => {
      if (!vaultPathRef.current) return
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1]
        const ext = file.name.split('.').pop() ?? 'png'
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
        if (e.ctrlKey || e.metaKey) onWikiLinkClickRef.current(noteName)
      }
    }, [])

    useEffect(() => {
      if (!editorRef.current) return

      const extensions: Extension[] = [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...closeBracketsKeymap]),
        closeBrackets(),
        markdown({ base: markdownLanguage }),
        oneDark,
        syntaxHighlighting(markdownHighlight),
        wikilinkPlugin,
        EditorView.lineWrapping,
        autocompletion({
          override: [makeWikilinkCompletion(filesRef), slashCompletion],
          closeOnBlur: true,
          activateOnTyping: true,
          icons: true
        }),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: 'var(--font-size-editor, 14px)' },
          '.cm-scroller': { fontFamily: 'var(--editor-font, JetBrains Mono, monospace)', overflow: 'auto' },
          '.cm-content': { padding: '16px 20px', minHeight: '100%' },
          '.cm-focused': { outline: 'none' },
          '.cm-wikilink': { color: '#a78bfa', cursor: 'pointer', textDecoration: 'underline' },
          '.cm-line': { lineHeight: '1.7' },
          // Autocomplete popup
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

      editorRef.current.addEventListener('click', handleClick)

      const onPaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            e.preventDefault()
            const file = item.getAsFile()
            if (file) { handleImageFile(file); break }
          }
        }
      }

      const onDrop = (e: DragEvent) => {
        const droppedFiles = e.dataTransfer?.files
        if (!droppedFiles) return
        for (const file of Array.from(droppedFiles)) {
          if (file.type.startsWith('image/')) { e.preventDefault(); handleImageFile(file) }
        }
      }

      editorRef.current.addEventListener('paste', onPaste)
      editorRef.current.addEventListener('drop', onDrop)

      return () => {
        editorRef.current?.removeEventListener('click', handleClick)
        editorRef.current?.removeEventListener('paste', onPaste)
        editorRef.current?.removeEventListener('drop', onDrop)
        view.destroy()
      }
    }, [])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      const current = view.state.doc.toString()
      if (current !== content) {
        view.dispatch({ changes: { from: 0, to: current.length, insert: content } })
      }
    }, [content])

    return <div ref={editorRef} className="markdown-editor" />
  }
)

MarkdownEditor.displayName = 'MarkdownEditor'
export default MarkdownEditor
