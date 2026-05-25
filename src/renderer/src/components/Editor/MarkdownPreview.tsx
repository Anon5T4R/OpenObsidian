import React, { useMemo } from 'react'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'
import './MarkdownPreview.css'

// ── Callout / admonition support ───────────────────────────────────────────
// Renders Obsidian-style > [!type] callouts used by many AI tools.

const CALLOUT_META: Record<string, { icon: string; color: string }> = {
  info:      { icon: 'ℹ️',  color: '#3b82f6' },
  tip:       { icon: '💡',  color: '#10b981' },
  hint:      { icon: '💡',  color: '#10b981' },
  warning:   { icon: '⚠️',  color: '#f59e0b' },
  caution:   { icon: '⚠️',  color: '#f59e0b' },
  attention: { icon: '⚠️',  color: '#f59e0b' },
  danger:    { icon: '🔥',  color: '#ef4444' },
  error:     { icon: '❌',  color: '#ef4444' },
  bug:       { icon: '🐛',  color: '#ef4444' },
  success:   { icon: '✅',  color: '#10b981' },
  check:     { icon: '✅',  color: '#10b981' },
  done:      { icon: '✅',  color: '#10b981' },
  note:      { icon: '📝',  color: '#6366f1' },
  abstract:  { icon: '📋',  color: '#6366f1' },
  summary:   { icon: '📋',  color: '#6366f1' },
  tldr:      { icon: '📋',  color: '#6366f1' },
  question:  { icon: '❓',  color: '#8b5cf6' },
  help:      { icon: '❓',  color: '#8b5cf6' },
  faq:       { icon: '❓',  color: '#8b5cf6' },
  important: { icon: '❗',  color: '#ec4899' },
  example:   { icon: '📌',  color: '#6366f1' },
  quote:     { icon: '💬',  color: '#6b7280' },
  cite:      { icon: '💬',  color: '#6b7280' },
  failure:   { icon: '💥',  color: '#ef4444' },
  fail:      { icon: '💥',  color: '#ef4444' },
  missing:   { icon: '💥',  color: '#ef4444' },
  todo:      { icon: '☑️',  color: '#6366f1' },
}

// Matches blockquotes whose first <p> starts with [!type](fold)? title
// Groups: type, fold ('-'|'+'|undefined), titleRest, bodyInP, bodyExtra
const CALLOUT_RE = /<blockquote>\n?<p>\[!(\w+)\]([-+])?([^\n<]*)(?:\n([\s\S]*?))?<\/p>([\s\S]*?)<\/blockquote>/g

function processCallouts(html: string): string {
  return html.replace(CALLOUT_RE, (_, type, fold, titleRest, bodyInP, bodyExtra) => {
    const t = type.toLowerCase()
    const meta = CALLOUT_META[t] ?? { icon: '📌', color: '#6b7280' }
    const title = titleRest.trim() || (t.charAt(0).toUpperCase() + t.slice(1))
    const collapsible = fold === '-' || fold === '+'
    const startClosed = fold === '-'

    const bodyParts = [
      bodyInP?.trim() ? `<p>${bodyInP.trim()}</p>` : '',
      (bodyExtra ?? '').trim(),
    ].filter(Boolean).join('\n')

    const bodyHtml = bodyParts
      ? `<div class="callout-content">${bodyParts}</div>`
      : ''

    const style = `style="--callout-color:${meta.color}"`

    if (collapsible) {
      const foldIcon = `<span class="callout-fold">▾</span>`
      return `<details class="callout callout-${t}" ${style}${startClosed ? '' : ' open'}>
<summary class="callout-title"><span class="callout-icon">${meta.icon}</span><span class="callout-title-text">${title}</span>${foldIcon}</summary>
${bodyHtml}</details>`
    }

    return `<div class="callout callout-${t}" ${style}>
<div class="callout-title"><span class="callout-icon">${meta.icon}</span><span class="callout-title-text">${title}</span></div>
${bodyHtml}</div>`
  })
}

interface MarkdownPreviewProps {
  content: string
  onWikiLinkClick: (noteName: string) => void
  onChange?: (content: string) => void
  vaultPath?: string | null
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

function processWikiLinks(md: string): string {
  return md.replace(WIKILINK_RE, (_, target, alias) => {
    const display = alias ?? target
    return `<a href="#" class="wikilink" data-target="${target}">${display}</a>`
  })
}

// Toggle the nth - [ ] / - [x] occurrence in raw markdown
function toggleCheckbox(markdown: string, index: number): string {
  let count = -1
  return markdown.replace(/- \[[ xX]\]/g, (match) => {
    count++
    if (count === index) {
      return /\[[ ]\]/.test(match) ? '- [x]' : '- [ ]'
    }
    return match
  })
}

export default function MarkdownPreview({ content, onWikiLinkClick, onChange, vaultPath }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    const withLinks = processWikiLinks(content)
    const result = remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).processSync(withLinks)
    let html = String(result)
      // Remove "disabled" from checkboxes so they are clickable in preview
      .replace(/(<input\b[^>]*?) disabled/g, '$1')
    // Render Obsidian-style callouts ([!type])
    html = processCallouts(html)
    // Resolve relative image paths to absolute file:// URLs so Electron can load them
    if (vaultPath) {
      const base = 'file:///' + vaultPath.replace(/\\/g, '/')
      html = html.replace(/src="(?!https?:\/\/|data:|file:\/\/)([^"]+)"/g, (_, rel) => {
        return `src="${base}/${rel}"`
      })
    }
    return html
  }, [content, vaultPath])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement

    // Interactive checkbox
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      e.preventDefault() // don't let the browser toggle visually before re-render
      if (!onChange) return
      const container = e.currentTarget
      const all = Array.from(container.querySelectorAll('input[type="checkbox"]'))
      const idx = all.indexOf(target)
      if (idx !== -1) onChange(toggleCheckbox(content, idx))
      return
    }

    // WikiLink navigation
    if (target.classList.contains('wikilink')) {
      e.preventDefault()
      const noteName = target.getAttribute('data-target')
      if (noteName) onWikiLinkClick(noteName)
    }
  }

  return (
    <div
      className="markdown-preview"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
