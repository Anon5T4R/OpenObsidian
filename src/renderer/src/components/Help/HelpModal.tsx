import React, { useState } from 'react'
import './HelpModal.css'

interface HelpModalProps {
  onClose: () => void
}

type Tab = 'interface' | 'markdown' | 'features' | 'shortcuts'

export default function HelpModal({ onClose }: HelpModalProps) {
  const [tab, setTab] = useState<Tab>('interface')

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
          <button className={tab === 'interface'  ? 'active' : ''} onClick={() => setTab('interface')}>Interface</button>
          <button className={tab === 'features'   ? 'active' : ''} onClick={() => setTab('features')}>Features</button>
          <button className={tab === 'markdown'   ? 'active' : ''} onClick={() => setTab('markdown')}>Markdown</button>
          <button className={tab === 'shortcuts'  ? 'active' : ''} onClick={() => setTab('shortcuts')}>Shortcuts</button>
        </div>

        <div className="help-body">
          {tab === 'interface'  && <InterfaceTab />}
          {tab === 'features'   && <FeaturesTab />}
          {tab === 'markdown'   && <MarkdownTab />}
          {tab === 'shortcuts'  && <ShortcutsTab />}
        </div>
      </div>
    </div>
  )
}

// ── Interface overview ────────────────────────────────────────────────────

function InterfaceTab() {
  return (
    <div className="help-content">
      <Section title="Toolbar (top bar)">
        <p className="help-para">
          The toolbar appears above the editor whenever a note is open. From left to right:
        </p>
        <ul className="help-list">
          <li><strong>Note title</strong> — name of the active file. A purple dot appears when there are unsaved changes.</li>
          <li><strong>Insert menu</strong> — drop-down with snippets: table, code block, checkbox, image, date, WikiLink and more.</li>
          <li><strong>Edit / Split / Preview</strong> — switches between editor-only, side-by-side, and rendered preview.</li>
          <li><strong>↓ Export</strong> — saves the current note as HTML or PDF.</li>
          <li><strong>◎ Graph</strong> — opens the connection graph (Ctrl+G).</li>
          <li><strong>? Help</strong> — opens this window (F1).</li>
          <li><strong>⚙ Settings</strong> — opens settings (Ctrl+,).</li>
        </ul>
      </Section>

      <Section title="Sidebar (left panel)">
        <ul className="help-list">
          <li><strong>Vault name</strong> — top-left. Click to change vault.</li>
          <li><strong>+ button</strong> — creates a new note (opens template picker).</li>
          <li><strong>📁 button</strong> — creates a new folder at vault root.</li>
          <li><strong>A→Z / Z→A / Recent</strong> — sort order dropdown.</li>
          <li><strong>← / → button</strong> — collapses or expands the sidebar (Ctrl+\).</li>
          <li><strong>Filter box</strong> — filters the tree by note name as you type.</li>
          <li><strong>📌 Pinned</strong> — pinned notes appear here, above the file tree.</li>
          <li><strong>Tag chips</strong> — click a tag to filter the tree by that tag. Click ✕ to clear.</li>
          <li><strong>File tree</strong> — click a folder to expand/collapse; click a file to open it.</li>
        </ul>
      </Section>

      <Section title="File tree — right-click menu">
        <ul className="help-list">
          <li><strong>📄 New Note Here</strong> — opens the template picker inside that folder.</li>
          <li><strong>📁 New Folder Here</strong> — creates a subfolder.</li>
          <li><strong>✏️ Rename</strong> — renames the file or folder.</li>
          <li><strong>📋 Duplicate</strong> — creates a copy of the note.</li>
          <li><strong>📌 Pin / Unpin</strong> — pins the note to the top of the sidebar.</li>
          <li><strong>📎 Copy Path</strong> — copies the absolute path to clipboard.</li>
          <li><strong>📂 Show in File Manager</strong> — reveals the file in Explorer / Nautilus.</li>
          <li><strong>🗑 Delete</strong> — permanently deletes the file or folder.</li>
        </ul>
        <div className="help-tip">
          <strong>Drag & drop:</strong> grab any file or folder and drop it onto another folder to move it. Drop onto empty space to move to vault root.
        </div>
      </Section>

      <Section title="Status bar (bottom bar)">
        <p className="help-para">
          Shown below the editor. Displays live statistics for the current note:
        </p>
        <ul className="help-list">
          <li><strong>N words</strong> — word count (updates as you type).</li>
          <li><strong>N chars</strong> — character count.</li>
          <li><strong>Ln N Col N</strong> — cursor line and column position.</li>
          <li><strong>Find</strong> — opens the find & replace panel (same as Ctrl+F).</li>
        </ul>
      </Section>

      <Section title="Backlinks panel">
        <p className="help-para">
          Below the sidebar file tree. Lists every note that contains a <code>[[WikiLink]]</code> pointing to the currently open note. Click any entry to navigate to it.
        </p>
      </Section>

      <Section title="Graph view">
        <p className="help-para">
          Overlays the editor area. Each node is a note; each line is a WikiLink connection.
        </p>
        <ul className="help-list">
          <li>Node size reflects number of connections.</li>
          <li>Hover to highlight direct neighbours.</li>
          <li>Click a node to open that note.</li>
          <li>Drag nodes, scroll to zoom, drag background to pan.</li>
          <li><strong>Local mode</strong> — shows only notes connected to the active note.</li>
        </ul>
      </Section>
    </div>
  )
}

// ── Features ──────────────────────────────────────────────────────────────

function FeaturesTab() {
  return (
    <div className="help-content">
      <Section title="Templates">
        <p className="help-para">
          Every time you create a note (Ctrl+N, sidebar + button, or right-click → New Note Here) a template picker opens. Choose from:
        </p>
        <div className="help-tpl-grid">
          {[
            ['📄', 'Blank note',       'Just the title heading.'],
            ['📅', 'Daily note',       "Focus, notes and done sections with today's date."],
            ['🤝', 'Meeting notes',    'Date, attendees, agenda, notes and action items.'],
            ['🚀', 'Project plan',     'Overview, goals, task checklist and resources.'],
            ['📚', 'Book notes',       'Author, rating, summary, key ideas and quotes.'],
            ['💡', 'Idea / brainstorm','The idea, why it matters, how to explore and related links.'],
          ].map(([icon, name, desc]) => (
            <div key={name} className="help-tpl-item">
              <span className="help-tpl-icon">{icon}</span>
              <div>
                <div className="help-tpl-name">{name}</div>
                <div className="help-tpl-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tags">
        <p className="help-para">
          Write <code>#tag</code> anywhere in a note. Tags are automatically extracted as you save. In the sidebar, tag chips appear above the file tree — click one to filter notes by that tag. Click <strong>✕</strong> to clear the filter.
        </p>
        <div className="help-tip">
          Valid tag characters: letters, numbers, <code>_</code> and <code>-</code>.<br />
          Example: <code>#project</code> <code>#study-notes</code> <code>#idea_2025</code>
        </div>
      </Section>

      <Section title="Find & Replace">
        <p className="help-para">
          Press <kbd>Ctrl+F</kbd> or click <strong>Find</strong> in the status bar to open the search panel inside the editor. Supports:
        </p>
        <ul className="help-list">
          <li>Case-sensitive and case-insensitive search.</li>
          <li>Regular expressions.</li>
          <li>Replace one occurrence or all occurrences.</li>
          <li>Navigate results with <kbd>Enter</kbd> / <kbd>Shift+Enter</kbd>.</li>
          <li>Close with <kbd>Escape</kbd>.</li>
        </ul>
      </Section>

      <Section title="Export">
        <p className="help-para">
          Click the <strong>↓</strong> button in the toolbar to export the current note:
        </p>
        <ul className="help-list">
          <li><strong>Export as HTML</strong> — saves a fully styled standalone HTML file. Opens a save dialog.</li>
          <li><strong>Export as PDF</strong> — switches to Preview mode and uses Electron's print engine to generate a PDF. Opens a save dialog.</li>
        </ul>
      </Section>

      <Section title="Zoom">
        <p className="help-para">
          Adjusts the editor font size without affecting the rest of the UI:
        </p>
        <ul className="help-list">
          <li><kbd>Ctrl</kbd>+<kbd>=</kbd> — increase font size.</li>
          <li><kbd>Ctrl</kbd>+<kbd>-</kbd> — decrease font size.</li>
          <li><kbd>Ctrl</kbd>+<kbd>0</kbd> — reset to default (14 px).</li>
          <li>Range: 10 px – 26 px. Persisted across sessions.</li>
        </ul>
      </Section>

      <Section title="Pin notes">
        <p className="help-para">
          Right-click any file → <strong>📌 Pin to top</strong>. Pinned notes appear in their own section at the top of the sidebar, regardless of sort order or tag filter. Right-click again to unpin. Pins survive app restarts.
        </p>
      </Section>

      <Section title="Sidebar sort">
        <p className="help-para">
          Use the dropdown in the sidebar header to change order:
        </p>
        <ul className="help-list">
          <li><strong>A→Z</strong> — alphabetical ascending (default).</li>
          <li><strong>Z→A</strong> — alphabetical descending.</li>
          <li><strong>Recent</strong> — most recently modified file first.</li>
        </ul>
        <p className="help-para">Folders always appear before files.</p>
      </Section>

      <Section title="Full-text search">
        <p className="help-para">
          Press <kbd>Ctrl+Shift+F</kbd> to open the search panel. It searches the content of every note in the vault in real time. Results show the matching line with context. Click a result to open that note.
        </p>
      </Section>

      <Section title="Vault backup">
        <p className="help-para">
          Press <kbd>Ctrl+Shift+B</kbd> or use the File menu → Backup vault. You'll be asked to choose a destination folder. OpenObsidian copies the entire vault there with a timestamp in the folder name.
        </p>
      </Section>

      <Section title="Image paste">
        <p className="help-para">
          Copy any image to the clipboard and press <kbd>Ctrl+V</kbd> inside the editor. The image is saved to a <code>_attachments/</code> folder inside the vault and an <code>![…](…)</code> link is inserted at the cursor.
        </p>
      </Section>

      <Section title="Vault index cache">
        <p className="help-para">
          OpenObsidian keeps a local cache of your vault contents (<code>userData/indices/</code>). On the next open, only files that changed on disk are re-read — unchanged notes load instantly from the cache. The cache is updated automatically every time you save a note.
        </p>
      </Section>
    </div>
  )
}

// ── Markdown reference ────────────────────────────────────────────────────

function MarkdownTab() {
  return (
    <div className="help-content">
      <Section title="Text formatting">
        <Row syntax="**bold**"         result={<><strong>bold</strong></>} />
        <Row syntax="*italic*"         result={<><em>italic</em></>} />
        <Row syntax="~~strikethrough~~" result={<><s>strikethrough</s></>} />
        <Row syntax="`inline code`"    result={<><code>inline code</code></>} />
        <Row syntax="==highlight=="    result={<><mark>highlight</mark></>} />
      </Section>

      <Section title="Headings">
        <Row syntax="# Heading 1"  result={<span style={{ fontSize: '1.3em', fontWeight: 700 }}>Heading 1</span>} />
        <Row syntax="## Heading 2" result={<span style={{ fontSize: '1.1em', fontWeight: 700 }}>Heading 2</span>} />
        <Row syntax="### Heading 3" result={<span style={{ fontWeight: 700 }}>Heading 3</span>} />
      </Section>

      <Section title="Lists">
        <Row syntax="- item"     result={<>• Bullet list</>} />
        <Row syntax="1. item"    result={<>1. Numbered list</>} />
        <Row syntax="- [ ] task" result={<>☐ Task (unchecked)</>} />
        <Row syntax="- [x] done" result={<>☑ Task (checked)</>} />
        <Row syntax="  - nested" result={<span style={{ paddingLeft: 12 }}>→ Indent with 2 spaces</span>} />
      </Section>

      <Section title="Links & media">
        <Row syntax="[text](https://url.com)" result={<a href="#">text</a>} />
        <Row syntax="![alt](image.png)"       result={<>🖼 Embedded image</>} />
        <Row syntax="[[Note Name]]"           result={<span style={{ color: '#a78bfa' }}>Note Name</span>} />
        <Row syntax="[[Note|Alias]]"          result={<span style={{ color: '#a78bfa' }}>Alias → Note</span>} />
      </Section>

      <Section title="Blocks">
        <Row syntax="> quote" result={<blockquote style={{ borderLeft: '3px solid #7c3aed', paddingLeft: 8 }}>Blockquote</blockquote>} />
        <Row syntax="---"     result={<hr style={{ border: '1px solid var(--border)' }} />} />
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

      <Section title="WikiLinks & autocomplete">
        <Row syntax="[[Note Name]]"   result={<span style={{ color: '#a78bfa' }}>Links to "Note Name"</span>} />
        <Row syntax="[[Note|Alias]]"  result={<span style={{ color: '#a78bfa' }}>Shows "Alias", links to "Note"</span>} />
        <div className="help-tip" style={{ marginTop: 10 }}>
          Type <kbd>[[</kbd> to open autocomplete. Use <kbd>↑</kbd><kbd>↓</kbd> to navigate and <kbd>Enter</kbd> to confirm.
        </div>
      </Section>

      <Section title="Slash commands">
        <p className="help-para">Type <kbd>/</kbd> at the start of a line to open the command palette.</p>
        <div className="help-slash-grid">
          {[
            ['/h1', 'Heading 1'],    ['/h2', 'Heading 2'],    ['/h3', 'Heading 3'],
            ['/table', 'Table'],     ['/code', 'Code block'],  ['/quote', 'Blockquote'],
            ['/bold', 'Bold'],       ['/italic', 'Italic'],    ['/check', 'Checkbox'],
            ['/list', 'Bullet'],     ['/numlist', 'Numbered'], ['/hr', 'Divider'],
            ['/link', 'Web link'],   ['/image', 'Image'],      ['/date', 'Today\'s date'],
            ['/wikilink', 'WikiLink'],
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

// ── Keyboard shortcuts ────────────────────────────────────────────────────

function ShortcutsTab() {
  return (
    <div className="help-content">
      <Section title="Vault & navigation">
        <ShortcutRow keys={['Ctrl', 'Shift', 'O']} label="Open vault folder" />
        <ShortcutRow keys={['Ctrl', 'N']}           label="New note (opens template picker)" />
        <ShortcutRow keys={['Ctrl', 'Shift', 'F']}  label="Full-text search across all notes" />
        <ShortcutRow keys={['Ctrl', 'G']}            label="Toggle graph view" />
        <ShortcutRow keys={['Ctrl', '\\']}           label="Collapse / expand sidebar" />
      </Section>

      <Section title="Editor">
        <ShortcutRow keys={['Ctrl', 'F']}           label="Find & Replace inside current note" />
        <ShortcutRow keys={['Ctrl', 'Z']}           label="Undo" />
        <ShortcutRow keys={['Ctrl', 'Y']}           label="Redo" />
        <ShortcutRow keys={['Ctrl', 'V']}           label="Paste image from clipboard" />
        <ShortcutRow keys={['/']}                    label="Slash command palette (start of line)" />
        <ShortcutRow keys={['[', '[']}              label="WikiLink autocomplete" />
        <ShortcutRow keys={['Right-click']}         label="Context menu: bold, italic, link, WikiLink…" />
      </Section>

      <Section title="Zoom (editor font size)">
        <ShortcutRow keys={['Ctrl', '=']}  label="Increase font size" />
        <ShortcutRow keys={['Ctrl', '-']}  label="Decrease font size" />
        <ShortcutRow keys={['Ctrl', '0']}  label="Reset font size to default (14 px)" />
      </Section>

      <Section title="App">
        <ShortcutRow keys={['Ctrl', ',']}           label="Settings" />
        <ShortcutRow keys={['Ctrl', 'Shift', 'B']}  label="Backup vault" />
        <ShortcutRow keys={['F1']}                  label="Open this help window" />
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
