import React, { useState } from 'react'
import './HelpModal.css'

interface HelpModalProps {
  onClose: () => void
}

type Tab = 'markdown' | 'shortcuts' | 'wikilinks'

export default function HelpModal({ onClose }: HelpModalProps) {
  const [tab, setTab] = useState<Tab>('markdown')

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <div className="help-title">
            <span className="help-icon">?</span>
            Help & Reference
          </div>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>

        <div className="help-tabs">
          <button className={tab === 'markdown' ? 'active' : ''} onClick={() => setTab('markdown')}>
            Markdown
          </button>
          <button className={tab === 'wikilinks' ? 'active' : ''} onClick={() => setTab('wikilinks')}>
            Links & Notes
          </button>
          <button className={tab === 'shortcuts' ? 'active' : ''} onClick={() => setTab('shortcuts')}>
            Shortcuts
          </button>
        </div>

        <div className="help-body">
          {tab === 'markdown' && <MarkdownTab />}
          {tab === 'wikilinks' && <WikilinksTab />}
          {tab === 'shortcuts' && <ShortcutsTab />}
        </div>
      </div>
    </div>
  )
}

// ── Markdown reference ────────────────────────────────────────────────────

function MarkdownTab() {
  return (
    <div className="help-content">
      <Section title="Text formatting">
        <Row syntax="**bold**" result={<><strong>bold</strong></>} />
        <Row syntax="*italic*" result={<><em>italic</em></>} />
        <Row syntax="~~strikethrough~~" result={<><s>strikethrough</s></>} />
        <Row syntax="`inline code`" result={<><code>inline code</code></>} />
        <Row syntax="==highlight==" result={<><mark>highlight</mark></>} />
      </Section>

      <Section title="Headings">
        <Row syntax="# Heading 1" result={<span style={{ fontSize: '1.3em', fontWeight: 700 }}>Heading 1</span>} />
        <Row syntax="## Heading 2" result={<span style={{ fontSize: '1.1em', fontWeight: 700 }}>Heading 2</span>} />
        <Row syntax="### Heading 3" result={<span style={{ fontWeight: 700 }}>Heading 3</span>} />
      </Section>

      <Section title="Lists">
        <Row syntax="- item" result={<>• Bullet list</>} />
        <Row syntax="1. item" result={<>1. Numbered list</>} />
        <Row syntax="- [ ] task" result={<>☐ Task (unchecked)</>} />
        <Row syntax="- [x] done" result={<>☑ Task (checked)</>} />
        <Row syntax="  - nested" result={<span style={{ paddingLeft: 12 }}>→ Indent with 2 spaces</span>} />
      </Section>

      <Section title="Links & media">
        <Row syntax="[text](https://url.com)" result={<a href="#">text</a>} />
        <Row syntax="![alt](image.png)" result={<>🖼 Embedded image</>} />
        <Row syntax="[[Note Name]]" result={<span style={{ color: '#a78bfa' }}>Note Name</span>} />
        <Row syntax="[[Note|Alias]]" result={<span style={{ color: '#a78bfa' }}>Alias → Note</span>} />
      </Section>

      <Section title="Blocks">
        <Row syntax="> quote" result={<blockquote style={{ borderLeft: '3px solid #7c3aed', paddingLeft: 8 }}>Blockquote</blockquote>} />
        <Row syntax="---" result={<hr style={{ border: '1px solid var(--border)' }} />} />
        <Row
          syntax={'```\ncode block\n```'}
          result={<code style={{ background: 'var(--bg-code)', padding: '2px 6px', borderRadius: 3 }}>code block</code>}
        />
      </Section>

      <Section title="Tables">
        <div className="help-code-block">
{`| Column 1 | Column 2 |
| --- | --- |
| Cell A   | Cell B   |`}
        </div>
        <table className="help-table-preview">
          <thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>
          <tbody><tr><td>Cell A</td><td>Cell B</td></tr></tbody>
        </table>
      </Section>
    </div>
  )
}

// ── WikiLinks & connections ───────────────────────────────────────────────

function WikilinksTab() {
  return (
    <div className="help-content">
      <Section title="Linking notes">
        <Row syntax="[[Note Name]]" result={<span style={{ color: '#a78bfa' }}>Links to "Note Name"</span>} />
        <Row syntax="[[Note|Display text]]" result={<span style={{ color: '#a78bfa' }}>Shows "Display text", links to "Note"</span>} />
      </Section>

      <div className="help-tip">
        <strong>Autocomplete:</strong> type <kbd>[[</kbd> and a list of your notes appears. Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate and <kbd>Enter</kbd> to confirm.
      </div>

      <Section title="Backlinks">
        <p className="help-para">
          The <strong>Backlinks</strong> panel at the bottom of the sidebar shows every note that links to the currently open note. Click any backlink to navigate to it.
        </p>
      </Section>

      <Section title="Graph view">
        <p className="help-para">
          Press <kbd>Ctrl+G</kbd> or click the <strong>◎</strong> button to open the graph. Each node is a note, each edge is a <code>[[WikiLink]]</code>.
        </p>
        <ul className="help-list">
          <li>Node size = number of connections</li>
          <li>Hover a node to highlight its links</li>
          <li>Click a node to open the note</li>
          <li>Drag nodes to rearrange</li>
          <li>Scroll to zoom, drag background to pan</li>
          <li><strong>Local mode</strong> — shows only notes connected to the current one</li>
        </ul>
      </Section>

      <Section title="Slash commands for links">
        <Row syntax="/wikilink" result={<>Opens <code>[[</code> with autocomplete</>} />
        <Row syntax="/link" result={<>[text](https://)</>} />
        <Row syntax="/image" result={<>![alt](url)</>} />
      </Section>
    </div>
  )
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────

function ShortcutsTab() {
  return (
    <div className="help-content">
      <Section title="Navigation">
        <ShortcutRow keys={['Ctrl', 'Shift', 'O']} label="Open vault folder" />
        <ShortcutRow keys={['Ctrl', 'N']}         label="New note" />
        <ShortcutRow keys={['Ctrl', 'Shift', 'F']} label="Search all notes" />
        <ShortcutRow keys={['Ctrl', 'G']}          label="Toggle graph view" />
        <ShortcutRow keys={['Ctrl', '\\']}         label="Collapse / expand sidebar" />
      </Section>

      <Section title="Editor">
        <ShortcutRow keys={['/']}                  label="Slash command palette (start of line)" />
        <ShortcutRow keys={['[', '[']}             label="WikiLink autocomplete" />
        <ShortcutRow keys={['Ctrl', 'Z']}          label="Undo" />
        <ShortcutRow keys={['Ctrl', 'Y']}          label="Redo" />
        <ShortcutRow keys={['Ctrl', 'V']} label="Paste image from clipboard" />
      </Section>

      <Section title="View">
        <ShortcutRow keys={['Ctrl', ',']}          label="Settings" />
        <ShortcutRow keys={['Ctrl', 'Shift', 'B']} label="Backup vault" />
      </Section>

      <Section title="Slash commands">
        <div className="help-slash-grid">
          {[
            ['/h1', 'Heading 1'],   ['/h2', 'Heading 2'],   ['/h3', 'Heading 3'],
            ['/table', 'Table'],    ['/code', 'Code block'], ['/quote', 'Blockquote'],
            ['/bold', 'Bold'],      ['/italic', 'Italic'],   ['/check', 'Checkbox'],
            ['/list', 'Bullet'],    ['/numlist', 'Numbered'],['/hr', 'Horizontal rule'],
            ['/link', 'Web link'],  ['/image', 'Image'],     ['/date', 'Today\'s date'],
          ].map(([cmd, desc]) => (
            <div key={cmd} className="help-slash-item">
              <code>{cmd}</code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="help-section">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

function Row({ syntax, result }: { syntax: string; result: React.ReactNode }) {
  return (
    <div className="help-row">
      <code className="help-syntax">{syntax}</code>
      <span className="help-arrow">→</span>
      <span className="help-result">{result}</span>
    </div>
  )
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="help-shortcut-row">
      <div className="help-keys">
        {keys.map((k, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="plus">+</span>}
            <kbd>{k}</kbd>
          </React.Fragment>
        ))}
      </div>
      <span className="help-shortcut-label">{label}</span>
    </div>
  )
}
