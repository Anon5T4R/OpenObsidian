import React, { useMemo } from 'react'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'
import './MarkdownPreview.css'

interface MarkdownPreviewProps {
  content: string
  onWikiLinkClick: (noteName: string) => void
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

function processWikiLinks(md: string): string {
  return md.replace(WIKILINK_RE, (_, target, alias) => {
    const display = alias ?? target
    return `<a href="#" class="wikilink" data-target="${target}">${display}</a>`
  })
}

export default function MarkdownPreview({ content, onWikiLinkClick }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    const withLinks = processWikiLinks(content)
    const result = remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).processSync(withLinks)
    return String(result)
  }, [content])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
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
