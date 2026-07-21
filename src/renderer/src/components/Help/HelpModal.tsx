import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useModalA11y } from '../../hooks/useModalA11y'
import { useT } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import './HelpModal.css'

interface HelpModalProps {
  onClose: () => void
}

type Tab = 'interface' | 'markdown' | 'features' | 'shortcuts'

export default function HelpModal({ onClose }: HelpModalProps) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('interface')
  const dialogRef = useModalA11y<HTMLDivElement>(onClose)

  return (
    <div className="help-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('hlpTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-header">
          <div className="help-title">
            <span className="help-icon">?</span>
            {t('hlpTitle')}
          </div>
          <button className="help-close" onClick={onClose} aria-label={t('close')}><X size={16} /></button>
        </div>

        <div className="help-tabs">
          <button className={tab === 'interface'  ? 'active' : ''} onClick={() => setTab('interface')}>{t('hlpTabInterface')}</button>
          <button className={tab === 'features'   ? 'active' : ''} onClick={() => setTab('features')}>{t('hlpTabFeatures')}</button>
          <button className={tab === 'markdown'   ? 'active' : ''} onClick={() => setTab('markdown')}>{t('hlpTabMarkdown')}</button>
          <button className={tab === 'shortcuts'  ? 'active' : ''} onClick={() => setTab('shortcuts')}>{t('hlpTabShortcuts')}</button>
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
  const t = useT()
  return (
    <div className="help-content">
      <Section title={t('hlpSecToolbar')}>
        <p className="help-para">{t('hlpToolbarIntro')}</p>
        <ul className="help-list">
          <li><strong>{t('hlpTbNoteTitle')}</strong> — {t('hlpTbNoteTitleD')}</li>
          <li><strong>{t('hlpTbInsert')}</strong> — {t('hlpTbInsertD')}</li>
          <li><strong>{t('hlpTbViews')}</strong> — {t('hlpTbViewsD')}</li>
          <li><strong>{t('hlpTbExport')}</strong> — {t('hlpTbExportD')}</li>
          <li><strong>{t('hlpTbGraph')}</strong> — {t('hlpTbGraphD')}</li>
          <li><strong>{t('hlpTbHelp')}</strong> — {t('hlpTbHelpD')}</li>
          <li><strong>{t('hlpTbSettings')}</strong> — {t('hlpTbSettingsD')}</li>
        </ul>
      </Section>

      <Section title={t('hlpSecSidebar')}>
        <ul className="help-list">
          <li><strong>{t('hlpSbVault')}</strong> — {t('hlpSbVaultD')}</li>
          <li><strong>{t('hlpSbNew')}</strong> — {t('hlpSbNewD')}</li>
          <li><strong>{t('hlpSbFolder')}</strong> — {t('hlpSbFolderD')}</li>
          <li><strong>{t('hlpSbSort')}</strong> — {t('hlpSbSortD')}</li>
          <li><strong>{t('hlpSbCollapse')}</strong> — {t('hlpSbCollapseD')}</li>
          <li><strong>{t('hlpSbFilter')}</strong> — {t('hlpSbFilterD')}</li>
          <li><strong>{t('hlpSbPinned')}</strong> — {t('hlpSbPinnedD')}</li>
          <li><strong>{t('hlpSbTags')}</strong> — {t('hlpSbTagsD')}</li>
          <li><strong>{t('hlpSbTree')}</strong> — {t('hlpSbTreeD')}</li>
        </ul>
      </Section>

      <Section title={t('hlpSecCtx')}>
        <ul className="help-list">
          <li><strong>{t('hlpCtxNew')}</strong> — {t('hlpCtxNewD')}</li>
          <li><strong>{t('hlpCtxFolder')}</strong> — {t('hlpCtxFolderD')}</li>
          <li><strong>{t('hlpCtxRename')}</strong> — {t('hlpCtxRenameD')}</li>
          <li><strong>{t('hlpCtxDup')}</strong> — {t('hlpCtxDupD')}</li>
          <li><strong>{t('hlpCtxPin')}</strong> — {t('hlpCtxPinD')}</li>
          <li><strong>{t('hlpCtxCopy')}</strong> — {t('hlpCtxCopyD')}</li>
          <li><strong>{t('hlpCtxShow')}</strong> — {t('hlpCtxShowD')}</li>
          <li><strong>{t('hlpCtxDelete')}</strong> — {t('hlpCtxDeleteD')}</li>
        </ul>
        <div className="help-tip">
          <strong>{t('hlpCtxDragLabel')}</strong> {t('hlpCtxDrag')}
        </div>
      </Section>

      <Section title={t('hlpSecStatus')}>
        <p className="help-para">{t('hlpStatusIntro')}</p>
        <ul className="help-list">
          <li><strong>{t('hlpStWords')}</strong> — {t('hlpStWordsD')}</li>
          <li><strong>{t('hlpStChars')}</strong> — {t('hlpStCharsD')}</li>
          <li><strong>{t('hlpStLnCol')}</strong> — {t('hlpStLnColD')}</li>
          <li><strong>{t('hlpStFind')}</strong> — {t('hlpStFindD')}</li>
        </ul>
      </Section>

      <Section title={t('hlpSecBacklinks')}>
        <p className="help-para">
          {t('hlpBacklinksPre')} <code>[[WikiLink]]</code> {t('hlpBacklinksPost')}
        </p>
      </Section>

      <Section title={t('hlpSecGraph')}>
        <p className="help-para">{t('hlpGraphIntro')}</p>
        <ul className="help-list">
          <li>{t('hlpGraph1')}</li>
          <li>{t('hlpGraph2')}</li>
          <li>{t('hlpGraph3')}</li>
          <li>{t('hlpGraph4')}</li>
          <li><strong>{t('hlpGraphLocal')}</strong> — {t('hlpGraphLocalD')}</li>
        </ul>
      </Section>
    </div>
  )
}

// ── Features ──────────────────────────────────────────────────────────────

function FeaturesTab() {
  const t = useT()
  const tplItems: [string, TranslationKey, TranslationKey][] = [
    ['📄', 'tplBlank',   'hlpTplBlankD'],
    ['📅', 'tplDaily',   'hlpTplDailyD'],
    ['🤝', 'tplMeeting', 'hlpTplMeetingD'],
    ['🚀', 'tplProject', 'hlpTplProjectD'],
    ['📚', 'tplBook',    'hlpTplBookD'],
    ['💡', 'tplIdea',    'hlpTplIdeaD'],
  ]
  return (
    <div className="help-content">
      <Section title={t('hlpSecTemplates')}>
        <p className="help-para">{t('hlpTplIntro')}</p>
        <div className="help-tpl-grid">
          {tplItems.map(([icon, nameKey, descKey]) => (
            <div key={nameKey} className="help-tpl-item">
              <span className="help-tpl-icon">{icon}</span>
              <div>
                <div className="help-tpl-name">{t(nameKey)}</div>
                <div className="help-tpl-desc">{t(descKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('hlpSecTags')}>
        <p className="help-para">
          {t('hlpTagsPre')} <code>#tag</code> {t('hlpTagsPost')}
        </p>
        <div className="help-tip">
          {t('hlpTagCharsPre')} <code>_</code>, <code>-</code> {t('hlpTagCharsAnd')} <code>/</code>.<br />
          {t('hlpTagNested')}<br />
          {t('hlpTagExample')} <code>#project</code> <code>#study-notes</code> <code>#idea_2025</code>
        </div>
      </Section>

      <Section title={t('hlpSecFind')}>
        <p className="help-para">
          {t('hlpFindPre')} <kbd>Ctrl+F</kbd> {t('hlpFindMid')} <strong>{t('hlpStFind')}</strong> {t('hlpFindPost')}
        </p>
        <ul className="help-list">
          <li>{t('hlpFind1')}</li>
          <li>{t('hlpFind2')}</li>
          <li>{t('hlpFind3')}</li>
          <li>{t('hlpFindNav')} <kbd>Enter</kbd> / <kbd>Shift+Enter</kbd>.</li>
          <li>{t('hlpFindClose')} <kbd>Escape</kbd>.</li>
          <li>{t('hlpFindPreview')}</li>
        </ul>
      </Section>

      <Section title={t('hlpSecExport')}>
        <p className="help-para">
          {t('hlpExportPre')} <strong>↓</strong> {t('hlpExportPost')}
        </p>
        <ul className="help-list">
          <li><strong>{t('exportHtml')}</strong> — {t('hlpExportHtmlD')}</li>
          <li><strong>{t('exportPdf')}</strong> — {t('hlpExportPdfD')}</li>
        </ul>
      </Section>

      <Section title={t('hlpSecZoom')}>
        <p className="help-para">{t('hlpZoomIntro')}</p>
        <ul className="help-list">
          <li><kbd>Ctrl</kbd>+<kbd>=</kbd> — {t('hlpZoomIn')}</li>
          <li><kbd>Ctrl</kbd>+<kbd>-</kbd> — {t('hlpZoomOut')}</li>
          <li><kbd>Ctrl</kbd>+<kbd>0</kbd> — {t('hlpZoomReset')}</li>
          <li>{t('hlpZoomRange')}</li>
        </ul>
      </Section>

      <Section title={t('hlpSecPin')}>
        <p className="help-para">
          {t('hlpPinPre')} <strong>{t('ctxPin')}</strong>{t('hlpPinPost')}
        </p>
      </Section>

      <Section title={t('hlpSecSort')}>
        <p className="help-para">{t('hlpSortIntro')}</p>
        <ul className="help-list">
          <li><strong>{t('sortAZ')}</strong> — {t('hlpSortAZD')}</li>
          <li><strong>{t('sortZA')}</strong> — {t('hlpSortZAD')}</li>
          <li><strong>{t('sortRecent')}</strong> — {t('hlpSortRecentD')}</li>
        </ul>
        <p className="help-para">{t('hlpSortFolders')}</p>
      </Section>

      <Section title={t('hlpSecSearch')}>
        <p className="help-para">
          {t('hlpSearchPre')} <kbd>Ctrl+Shift+F</kbd> {t('hlpSearchPost')}
        </p>
      </Section>

      <Section title={t('hlpSecBackup')}>
        <p className="help-para">
          {t('hlpBackupPre')} <kbd>Ctrl+Shift+B</kbd> {t('hlpBackupPost')}
        </p>
      </Section>

      <Section title={t('hlpSecImage')}>
        <p className="help-para">
          {t('hlpImagePre')} <kbd>Ctrl+V</kbd> {t('hlpImageMid')} <code>_attachments/</code> {t('hlpImageMid2')} <code>![…](…)</code> {t('hlpImagePost')}
        </p>
      </Section>

      <Section title={t('hlpSecTasks')}>
        <p className="help-para">
          {t('hlpTasksPre')} <strong>{t('hlpPreviewMode')}</strong>{t('hlpTasksMid')} <code>- [ ]</code> {t('hlpTasksPost')}
        </p>
        <div className="help-tip">
          {t('hlpTasksTipPre')} <kbd>/check</kbd> {t('hlpTasksTipMid')} <strong>{t('hlpTasksTipStrong')}</strong> {t('hlpTasksTipPost')}
        </div>
      </Section>

      <Section title={t('hlpSecCache')}>
        <p className="help-para">
          {t('hlpCachePre')}<code>userData/indices/</code>{t('hlpCachePost')}
        </p>
      </Section>
    </div>
  )
}

// ── Markdown reference ────────────────────────────────────────────────────

function MarkdownTab() {
  const t = useT()
  const slashItems: [string, TranslationKey][] = [
    ['/h1', 'insHeading1'],  ['/h2', 'insHeading2'],   ['/h3', 'insHeading3'],
    ['/table', 'insTable'],  ['/code', 'insCodeBlock'], ['/quote', 'insBlockquote'],
    ['/bold', 'insBold'],    ['/italic', 'insItalic'],  ['/check', 'insTaskList'],
    ['/list', 'hlpSlashBullet'], ['/numlist', 'hlpSlashNumbered'], ['/hr', 'hlpSlashDivider'],
    ['/link', 'insWebLink'], ['/image', 'insImage'],    ['/date', 'ctxTodayDate'],
    ['/wikilink', 'ctxWikiLink'],
  ]
  return (
    <div className="help-content">
      <Section title={t('hlpMdText')}>
        <Row syntax="**bold**"         result={<><strong>{t('hlpMdBold')}</strong></>} />
        <Row syntax="*italic*"         result={<><em>{t('hlpMdItalic')}</em></>} />
        <Row syntax="~~strikethrough~~" result={<><s>{t('hlpMdStrike')}</s></>} />
        <Row syntax="`inline code`"    result={<><code>{t('hlpMdInlineCode')}</code></>} />
        <Row syntax="==highlight=="    result={<><mark>{t('hlpMdHighlight')}</mark></>} />
      </Section>

      <Section title={t('hlpMdHeadings')}>
        <Row syntax="# Heading 1"  result={<span style={{ fontSize: '1.3em', fontWeight: 700 }}>{t('insHeading1')}</span>} />
        <Row syntax="## Heading 2" result={<span style={{ fontSize: '1.1em', fontWeight: 700 }}>{t('insHeading2')}</span>} />
        <Row syntax="### Heading 3" result={<span style={{ fontWeight: 700 }}>{t('insHeading3')}</span>} />
      </Section>

      <Section title={t('hlpMdLists')}>
        <Row syntax="- item"     result={<>• {t('hlpMdBullet')}</>} />
        <Row syntax="1. item"    result={<>1. {t('hlpMdNumbered')}</>} />
        <Row syntax="- [ ] task" result={<>☐ {t('hlpMdTaskUnchecked')}</>} />
        <Row syntax="- [x] done" result={<>☑ {t('hlpMdTaskChecked')}</>} />
        <Row syntax="  - nested" result={<span style={{ paddingLeft: 12 }}>→ {t('hlpMdIndent')}</span>} />
        <div className="help-tip" style={{ marginTop: 10 }}>
          <strong>{t('hlpMdInteractiveTasks')}</strong> {t('hlpMdTaskTip1')} <strong>{t('hlpPreviewMode')}</strong>{t('hlpMdTaskTip2')}
        </div>
      </Section>

      <Section title={t('hlpMdLinks')}>
        <Row syntax="[text](https://url.com)" result={<a href="#">{t('hlpMdLinkText')}</a>} />
        <Row syntax="![alt](image.png)"       result={<>🖼 {t('hlpMdEmbeddedImage')}</>} />
        <Row syntax="[[Note Name]]"           result={<span style={{ color: '#a78bfa' }}>Note Name</span>} />
        <Row syntax="[[Note|Alias]]"          result={<span style={{ color: '#a78bfa' }}>Alias → Note</span>} />
      </Section>

      <Section title={t('hlpMdBlocks')}>
        <Row syntax="> quote" result={<blockquote style={{ borderLeft: '3px solid #7c3aed', paddingLeft: 8 }}>{t('insBlockquote')}</blockquote>} />
        <Row syntax="---"     result={<hr style={{ border: '1px solid var(--border)' }} />} />
        <Row
          syntax={'```\ncode block\n```'}
          result={<code style={{ background: 'var(--bg-code)', padding: '2px 6px', borderRadius: 3 }}>{t('hlpMdCodeBlockDemo')}</code>}
        />
      </Section>

      <Section title={t('hlpMdTables')}>
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

      <Section title={t('hlpMdWiki')}>
        <Row syntax="[[Note Name]]"   result={<span style={{ color: '#a78bfa' }}>{t('hlpMdWikiLinks')}</span>} />
        <Row syntax="[[Note|Alias]]"  result={<span style={{ color: '#a78bfa' }}>{t('hlpMdWikiAlias')}</span>} />
        <div className="help-tip" style={{ marginTop: 10 }}>
          {t('hlpMdWikiTipPre')} <kbd>[[</kbd> {t('hlpMdWikiTipMid')} <kbd>↑</kbd><kbd>↓</kbd> {t('hlpMdWikiTipPost')} <kbd>Enter</kbd> {t('hlpMdWikiTipEnd')}
        </div>
      </Section>

      <Section title={t('hlpMdSlash')}>
        <p className="help-para">{t('hlpMdSlashPre')} <kbd>/</kbd> {t('hlpMdSlashPost')}</p>
        <div className="help-slash-grid">
          {slashItems.map(([cmd, descKey]) => (
            <div key={cmd} className="help-slash-item">
              <code>{cmd}</code>
              <span>{t(descKey)}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────

function ShortcutsTab() {
  const t = useT()
  return (
    <div className="help-content">
      <Section title={t('hlpScVault')}>
        <ShortcutRow keys={['Ctrl', 'Shift', 'O']} label={t('hlpScOpenVault')} />
        <ShortcutRow keys={['Ctrl', 'N']}           label={t('hlpScNewNote')} />
        <ShortcutRow keys={['Ctrl', 'Shift', 'F']}  label={t('hlpScSearch')} />
        <ShortcutRow keys={['Ctrl', 'G']}            label={t('cmdGraph')} />
        <ShortcutRow keys={['Ctrl', '\\']}           label={t('hlpScSidebar')} />
      </Section>

      <Section title={t('hlpScEditor')}>
        <ShortcutRow keys={['Ctrl', 'F']}           label={t('hlpScFind')} />
        <ShortcutRow keys={['Ctrl', 'Z']}           label={t('hlpScUndo')} />
        <ShortcutRow keys={['Ctrl', 'Y']}           label={t('hlpScRedo')} />
        <ShortcutRow keys={['Ctrl', 'V']}           label={t('hlpScPaste')} />
        <ShortcutRow keys={['/']}                    label={t('hlpScSlash')} />
        <ShortcutRow keys={['[', '[']}              label={t('hlpScWiki')} />
        <ShortcutRow keys={['Right-click']}         label={t('hlpScCtx')} />
      </Section>

      <Section title={t('hlpScZoom')}>
        <ShortcutRow keys={['Ctrl', '=']}  label={t('hlpScZoomIn')} />
        <ShortcutRow keys={['Ctrl', '-']}  label={t('hlpScZoomOut')} />
        <ShortcutRow keys={['Ctrl', '0']}  label={t('hlpScZoomReset')} />
      </Section>

      <Section title={t('hlpScApp')}>
        <ShortcutRow keys={['Ctrl', ',']}           label={t('settings')} />
        <ShortcutRow keys={['Ctrl', 'Shift', 'B']}  label={t('cmdBackup')} />
        <ShortcutRow keys={['F1']}                  label={t('hlpScHelp')} />
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
