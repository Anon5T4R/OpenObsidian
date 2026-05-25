import React, { useMemo } from 'react'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'
import './MarkdownPreview.css'

interface MarkdownPreviewProps {
  content: string
  onWikiLinkClick: (noteName: string) => void
  onChange?: (content: string) => void
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

export default function MarkdownPreview({ content, onWikiLinkClick, onChange }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    const withLinks = processWikiLinks(content)
    const result = remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).processSync(withLinks)
    // Remove "disabled" from checkboxes so they are clickable in preview
    return String(result).replace(/(<input\b[^>]*?) disabled/g, '$1')
  }, [content])

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
