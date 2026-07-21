// Everything the editor can insert, in one place.
//
// There used to be two lists — one behind the Insert button, another behind
// `/` — and they had already drifted: `/numlist` and `/date` existed only in
// the editor, the menu had entries the editor did not. Worse, neither listed
// the things this app is actually for: flashcards, callouts, Mermaid, maths,
// query blocks, embeds. If it is not in the menu, nobody discovers it exists.
//
// This is that single list. The Insert menu and the slash completion both
// render from it, so the two can no longer disagree.

import type { TranslationKey } from '../i18n'

export type InsertCategory =
  | 'basics'
  | 'structure'
  | 'links'
  | 'study'
  | 'callouts'
  | 'diagrams'
  | 'data'
  | 'symbols'

export interface Insertable {
  /** Stable id; also the i18n key stem */
  id: string
  category: InsertCategory
  /** What is typed after `/`. The first one shows in the menu. */
  slash: string[]
  icon: string
  labelKey: TranslationKey
  /** One line saying what it does — the menu is where people learn the syntax */
  descKey: TranslationKey
  /** The Markdown inserted */
  snippet: string
  /**
   * Where the caret lands, counted back from the end of the snippet.
   * `-2` on `**text**` puts it between the asterisks and the word.
   */
  cursor?: number
  /** Needs to start on its own line to render */
  block?: boolean
}

/** Snippet + caret, ready for the editor. */
export interface Insertion {
  text: string
  cursor: number
}

export const INSERTABLES: Insertable[] = [
  // ── Basics ────────────────────────────────────────────────────────────
  { id: 'h1', category: 'basics', slash: ['h1', 'title'], icon: 'H1', labelKey: 'insH1', descKey: 'insH1Desc', snippet: '# ', block: true },
  { id: 'h2', category: 'basics', slash: ['h2'], icon: 'H2', labelKey: 'insH2', descKey: 'insH2Desc', snippet: '## ', block: true },
  { id: 'h3', category: 'basics', slash: ['h3'], icon: 'H3', labelKey: 'insH3', descKey: 'insH3Desc', snippet: '### ', block: true },
  { id: 'bold', category: 'basics', slash: ['bold', 'b'], icon: 'B', labelKey: 'insBold', descKey: 'insBoldDesc', snippet: '**text**', cursor: -2 },
  { id: 'italic', category: 'basics', slash: ['italic', 'i'], icon: 'I', labelKey: 'insItalic', descKey: 'insItalicDesc', snippet: '*text*', cursor: -1 },
  { id: 'strike', category: 'basics', slash: ['strike'], icon: 'S', labelKey: 'insStrike', descKey: 'insStrikeDesc', snippet: '~~text~~', cursor: -2 },
  { id: 'highlight', category: 'basics', slash: ['highlight', 'mark'], icon: '▨', labelKey: 'insHighlight', descKey: 'insHighlightDesc', snippet: '==text==', cursor: -2 },
  { id: 'inlineCode', category: 'basics', slash: ['inline'], icon: '`', labelKey: 'insInlineCode', descKey: 'insInlineCodeDesc', snippet: '`code`', cursor: -1 },
  { id: 'comment', category: 'basics', slash: ['comment'], icon: '%%', labelKey: 'insComment', descKey: 'insCommentDesc', snippet: '%%text%%', cursor: -2 },

  // ── Structure ─────────────────────────────────────────────────────────
  { id: 'bulletList', category: 'structure', slash: ['list', 'ul'], icon: '•', labelKey: 'insBulletList', descKey: 'insBulletListDesc', snippet: '- ', block: true },
  { id: 'numberedList', category: 'structure', slash: ['numlist', 'ol'], icon: '1.', labelKey: 'insNumberedList', descKey: 'insNumberedListDesc', snippet: '1. ', block: true },
  { id: 'taskList', category: 'structure', slash: ['check', 'todo'], icon: '☑', labelKey: 'insTaskList', descKey: 'insTaskListDesc', snippet: '- [ ] \n- [ ] \n- [ ] ', cursor: -12, block: true },
  { id: 'table', category: 'structure', slash: ['table'], icon: '⊞', labelKey: 'insTable', descKey: 'insTableDesc', snippet: '| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n', block: true },
  { id: 'codeBlock', category: 'structure', slash: ['code'], icon: '</>', labelKey: 'insCodeBlock', descKey: 'insCodeBlockDesc', snippet: '```\n\n```', cursor: -4, block: true },
  { id: 'quote', category: 'structure', slash: ['quote'], icon: '❝', labelKey: 'insQuote', descKey: 'insQuoteDesc', snippet: '> ', block: true },
  { id: 'hr', category: 'structure', slash: ['hr'], icon: '—', labelKey: 'insHr', descKey: 'insHrDesc', snippet: '\n---\n', block: true },

  // ── Links and media ───────────────────────────────────────────────────
  { id: 'wikilink', category: 'links', slash: ['wikilink', 'nota', 'note'], icon: '[[]]', labelKey: 'insWikilink', descKey: 'insWikilinkDesc', snippet: '[[]]', cursor: -2 },
  { id: 'wikilinkSection', category: 'links', slash: ['section'], icon: '[[#]]', labelKey: 'insWikilinkSection', descKey: 'insWikilinkSectionDesc', snippet: '[[Note#Section]]', cursor: -2 },
  { id: 'wikilinkAlias', category: 'links', slash: ['alias'], icon: '[[|]]', labelKey: 'insWikilinkAlias', descKey: 'insWikilinkAliasDesc', snippet: '[[Note|text shown]]', cursor: -2 },
  { id: 'embedNote', category: 'links', slash: ['embed'], icon: '![[]]', labelKey: 'insEmbedNote', descKey: 'insEmbedNoteDesc', snippet: '![[Note]]', cursor: -2, block: true },
  { id: 'embedSection', category: 'links', slash: ['embedsection'], icon: '![[#]]', labelKey: 'insEmbedSection', descKey: 'insEmbedSectionDesc', snippet: '![[Note#Section]]', cursor: -2, block: true },
  { id: 'webLink', category: 'links', slash: ['link', 'url'], icon: '🔗', labelKey: 'insWebLink', descKey: 'insWebLinkDesc', snippet: '[text](https://)', cursor: -1 },
  { id: 'image', category: 'links', slash: ['image', 'img'], icon: '🖼', labelKey: 'insImage', descKey: 'insImageDesc', snippet: '![alt](url)', cursor: -1 },

  // ── Study ─────────────────────────────────────────────────────────────
  { id: 'cardQa', category: 'study', slash: ['card', 'flashcard'], icon: '🃏', labelKey: 'insCardQa', descKey: 'insCardQaDesc', snippet: '> [!card]- Question\n> Answer\n', cursor: -12, block: true },
  { id: 'cardCloze', category: 'study', slash: ['cloze', 'gap'], icon: '␣', labelKey: 'insCardCloze', descKey: 'insCardClozeDesc', snippet: '> [!card] Title\n> A sentence with ==the hidden term==.\n', cursor: -2, block: true },
  { id: 'mnemonic', category: 'study', slash: ['mnemonic'], icon: '🧠', labelKey: 'insMnemonic', descKey: 'insMnemonicDesc', snippet: '> [!mnemonic]? Title\n> The mnemonic itself\n', cursor: -1, block: true },
  { id: 'mathInline', category: 'study', slash: ['math'], icon: '𝑥', labelKey: 'insMathInline', descKey: 'insMathInlineDesc', snippet: '$x^2$', cursor: -1 },
  { id: 'mathBlock', category: 'study', slash: ['mathblock', 'formula'], icon: '∑', labelKey: 'insMathBlock', descKey: 'insMathBlockDesc', snippet: '$$\n\\frac{a}{b}\n$$\n', cursor: -4, block: true },

  // ── Callouts ──────────────────────────────────────────────────────────
  { id: 'calloutInfo', category: 'callouts', slash: ['info'], icon: 'ℹ️', labelKey: 'insCalloutInfo', descKey: 'insCalloutInfoDesc', snippet: '> [!info] Title\n> Text\n', cursor: -6, block: true },
  { id: 'calloutTip', category: 'callouts', slash: ['tip'], icon: '💡', labelKey: 'insCalloutTip', descKey: 'insCalloutTipDesc', snippet: '> [!tip] Title\n> Text\n', cursor: -6, block: true },
  { id: 'calloutWarning', category: 'callouts', slash: ['warning'], icon: '⚠️', labelKey: 'insCalloutWarning', descKey: 'insCalloutWarningDesc', snippet: '> [!warning] Title\n> Text\n', cursor: -6, block: true },
  { id: 'calloutDanger', category: 'callouts', slash: ['danger'], icon: '🔥', labelKey: 'insCalloutDanger', descKey: 'insCalloutDangerDesc', snippet: '> [!danger] Title\n> Text\n', cursor: -6, block: true },
  { id: 'calloutSuccess', category: 'callouts', slash: ['success'], icon: '✅', labelKey: 'insCalloutSuccess', descKey: 'insCalloutSuccessDesc', snippet: '> [!success] Title\n> Text\n', cursor: -6, block: true },
  { id: 'calloutQuestion', category: 'callouts', slash: ['question'], icon: '❓', labelKey: 'insCalloutQuestion', descKey: 'insCalloutQuestionDesc', snippet: '> [!question] Title\n> Text\n', cursor: -6, block: true },
  { id: 'calloutExample', category: 'callouts', slash: ['example'], icon: '📌', labelKey: 'insCalloutExample', descKey: 'insCalloutExampleDesc', snippet: '> [!example] Title\n> Text\n', cursor: -6, block: true },
  { id: 'calloutFold', category: 'callouts', slash: ['fold'], icon: '▸', labelKey: 'insCalloutFold', descKey: 'insCalloutFoldDesc', snippet: '> [!note]- Title\n> Hidden until clicked\n', cursor: -22, block: true },

  // ── Diagrams ──────────────────────────────────────────────────────────
  { id: 'mermaidFlow', category: 'diagrams', slash: ['mermaid', 'flow'], icon: '📊', labelKey: 'insMermaidFlow', descKey: 'insMermaidFlowDesc', snippet: '```mermaid\ngraph TD\n  A[Start] --> B{Decision}\n  B -->|yes| C[One way]\n  B -->|no| D[The other]\n```\n', cursor: -5, block: true },
  { id: 'mermaidSequence', category: 'diagrams', slash: ['sequence'], icon: '⇄', labelKey: 'insMermaidSequence', descKey: 'insMermaidSequenceDesc', snippet: '```mermaid\nsequenceDiagram\n  A->>B: asks\n  B-->>A: answers\n```\n', cursor: -5, block: true },
  { id: 'mermaidMindmap', category: 'diagrams', slash: ['mindmap'], icon: '🧭', labelKey: 'insMermaidMindmap', descKey: 'insMermaidMindmapDesc', snippet: '```mermaid\nmindmap\n  root((Subject))\n    Branch one\n    Branch two\n```\n', cursor: -5, block: true },
  { id: 'mermaidPie', category: 'diagrams', slash: ['pie'], icon: '◔', labelKey: 'insMermaidPie', descKey: 'insMermaidPieDesc', snippet: '```mermaid\npie title Distribution\n  "One" : 60\n  "Another" : 40\n```\n', cursor: -5, block: true },
  { id: 'mermaidTimeline', category: 'diagrams', slash: ['timeline'], icon: '⏱', labelKey: 'insMermaidTimeline', descKey: 'insMermaidTimelineDesc', snippet: '```mermaid\ntimeline\n  title A history\n  2020 : First thing\n  2021 : Another\n```\n', cursor: -5, block: true },

  // ── Data ──────────────────────────────────────────────────────────────
  { id: 'frontmatter', category: 'data', slash: ['frontmatter', 'yaml'], icon: '---', labelKey: 'insFrontmatter', descKey: 'insFrontmatterDesc', snippet: '---\ntipo: \naliases:\n  - \ntags:\n  - \n---\n', cursor: -22, block: true },
  { id: 'tag', category: 'data', slash: ['tag'], icon: '#', labelKey: 'insTag', descKey: 'insTagDesc', snippet: '#tag', cursor: 0 },
  { id: 'queryTag', category: 'data', slash: ['query'], icon: '🔎', labelKey: 'insQueryTag', descKey: 'insQueryTagDesc', snippet: '```query\ntag: \nsort: titulo\n```\n', cursor: -19, block: true },
  { id: 'queryField', category: 'data', slash: ['queryfield'], icon: '🔍', labelKey: 'insQueryField', descKey: 'insQueryFieldDesc', snippet: '```query\ntipo: \nsort: modificado desc\nlimit: 20\n```\n', cursor: -35, block: true },
  { id: 'today', category: 'data', slash: ['date', 'today'], icon: '📅', labelKey: 'insToday', descKey: 'insTodayDesc', snippet: '' },
  { id: 'now', category: 'data', slash: ['time', 'now'], icon: '🕐', labelKey: 'insNow', descKey: 'insNowDesc', snippet: '' },

  // ── Symbols ───────────────────────────────────────────────────────────
  { id: 'arrowRight', category: 'symbols', slash: ['rarr'], icon: '→', labelKey: 'insArrowRight', descKey: 'insArrowRightDesc', snippet: '→' },
  { id: 'arrowLeft', category: 'symbols', slash: ['larr'], icon: '←', labelKey: 'insArrowLeft', descKey: 'insArrowLeftDesc', snippet: '←' },
  { id: 'arrowUp', category: 'symbols', slash: ['uarr'], icon: '↑', labelKey: 'insArrowUp', descKey: 'insArrowUpDesc', snippet: '↑' },
  { id: 'arrowDown', category: 'symbols', slash: ['darr'], icon: '↓', labelKey: 'insArrowDown', descKey: 'insArrowDownDesc', snippet: '↓' },
  { id: 'checkMark', category: 'symbols', slash: ['tick'], icon: '✓', labelKey: 'insCheckMark', descKey: 'insCheckMarkDesc', snippet: '✓' },
  { id: 'crossMark', category: 'symbols', slash: ['cross'], icon: '✗', labelKey: 'insCrossMark', descKey: 'insCrossMarkDesc', snippet: '✗' },
  { id: 'degree', category: 'symbols', slash: ['deg'], icon: '°', labelKey: 'insDegree', descKey: 'insDegreeDesc', snippet: '°' },
  { id: 'plusMinus', category: 'symbols', slash: ['pm'], icon: '±', labelKey: 'insPlusMinus', descKey: 'insPlusMinusDesc', snippet: '±' },
  { id: 'lessEqual', category: 'symbols', slash: ['le'], icon: '≤', labelKey: 'insLessEqual', descKey: 'insLessEqualDesc', snippet: '≤' },
  { id: 'greaterEqual', category: 'symbols', slash: ['ge'], icon: '≥', labelKey: 'insGreaterEqual', descKey: 'insGreaterEqualDesc', snippet: '≥' },
  { id: 'emDash', category: 'symbols', slash: ['mdash'], icon: '—', labelKey: 'insEmDash', descKey: 'insEmDashDesc', snippet: '—' },
  { id: 'ellipsis', category: 'symbols', slash: ['dots'], icon: '…', labelKey: 'insEllipsis', descKey: 'insEllipsisDesc', snippet: '…' },
]

export const CATEGORY_ORDER: InsertCategory[] = [
  'basics', 'structure', 'links', 'study', 'callouts', 'diagrams', 'data', 'symbols',
]

export const CATEGORY_LABEL: Record<InsertCategory, TranslationKey> = {
  basics: 'insCatBasics',
  structure: 'insCatStructure',
  links: 'insCatLinks',
  study: 'insCatStudy',
  callouts: 'insCatCallouts',
  diagrams: 'insCatDiagrams',
  data: 'insCatData',
  symbols: 'insCatSymbols',
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The text to insert and where the caret goes.
 *
 * Dates are resolved here rather than in the table, because the table is a
 * module constant: `/date` used to insert the day the app started, which on a
 * machine left running for a week is simply the wrong date.
 */
export function resolve(item: Insertable, now: Date = new Date()): Insertion {
  let text = item.snippet
  if (item.id === 'today') {
    text = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  } else if (item.id === 'now') {
    text = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  }
  return { text, cursor: item.cursor ?? 0 }
}

/** Items matching what was typed after `/`, best match first. */
export function searchInsertables(query: string, items: Insertable[] = INSERTABLES): Insertable[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  const starts = items.filter((i) => i.slash.some((s) => s.startsWith(q)))
  // An id match catches `/callout` finding the callout family; it goes after
  // the exact command matches so typing the command never gets outranked
  const rest = items.filter((i) => !starts.includes(i) && i.id.toLowerCase().includes(q))
  return [...starts, ...rest]
}

/** The canonical `/command` shown in the menu. */
export const primarySlash = (item: Insertable): string => `/${item.slash[0]}`
