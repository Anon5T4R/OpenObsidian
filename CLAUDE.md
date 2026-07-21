# OpenObsidian — Project Context for Claude

Open-source Obsidian-like markdown knowledge base built with Electron + React + TypeScript.
Repo: https://github.com/Anon5T4R/OpenObsidian
Current version: **0.11.0**

---

## Stack

| Layer | Technology |
|---|---|
| Shell | Electron 32, electron-vite 2 |
| UI | React 18, TypeScript |
| Editor | CodeMirror 6 (`@codemirror/*`) |
| Markdown preview | remark + remark-gfm + remark-html |
| Math | KaTeX (transitive dep of mermaid, imported directly) |
| Diagrams | Mermaid v11 (lazy-loaded chunks) |
| DOCX reading | mammoth (main process only) |
| EPUB viewer | epub.js (+ adm-zip) |
| Local AI | node-llama-cpp (GGUF local) + remote APIs (chat panel & text actions) |
| Plugins | community plugin system (GitHub starter plugin) |
| DOCX→Markdown | mammoth (HTML step) + turndown (HTML→MD step) |
| State | Zustand (`vaultStore.ts`) |
| File watching | chokidar |
| Theming | CSS variables, `data-theme` attribute on `<html>` |
| Settings | localStorage via `useSettings` hook |
| Build | electron-builder (nsis/AppImage/deb/dmg) |

---

## Project Structure

```
src/
  main/index.ts          ← Electron main process; ALL IPC handlers live here
  preload/index.ts       ← contextBridge: exposes window.api to renderer
  renderer/src/
    App.tsx              ← Root component, layout, all top-level state & callbacks
    store/vaultStore.ts  ← Zustand store (vault tree, files, activeFile, backlinks)
    hooks/useSettings.ts ← fontSize, theme, editorFont, sidebarWidth, sidebarSort
    styles/app.css       ← Global layout styles (sidebar, toolbar, toast, etc.)
    components/
      Sidebar/FileTree.tsx + .css   ← Vault file tree, context menu, inline rename
      Editor/MarkdownEditor.tsx     ← CodeMirror 6 wrapper
      Editor/MarkdownPreview.tsx    ← remark pipeline + callouts + math + highlights
      Editor/MarkdownPreview.css
      Editor/StatusBar.tsx
      Pdf/PdfViewer.tsx + .css      ← iframe-based PDF viewer
      Docx/DocxViewer.tsx + .css    ← mammoth HTML viewer + convert/open buttons
      Toc/TocPanel.tsx + .css       ← Auto-generated table of contents panel
      Backlinks/BacklinksPanel.tsx  ← Capped at 38% of the sidebar, collapsible
      Search/SearchPanel.tsx        ← Vault search with operators (see utils/searchQuery)
      Find/PreviewFind.tsx + .css   ← Ctrl+F for the reading view (CSS Highlight API)
      Diagnostics/VaultDiagnosticsPanel.tsx     ← Broken links, orphan notes, duplicate names
      Review/ReviewPanel.tsx                    ← Flashcard session (keyboard-only flow)
      Review/ReviewStatsPanel.tsx               ← Retention, 14-day forecast
      Review/AnkiImportModal.tsx                ← Confirmation before writing an imported deck
      Calendar/CalendarPopover.tsx + .css        ← Month grid over the daily notes
      Graph/GraphView.tsx           ← D3 knowledge graph
      Insert/InsertMenu.tsx         ← Toolbar insert menu (table, heading, etc.)
      Settings/SettingsModal.tsx
      Help/HelpModal.tsx
      Templates/TemplateModal.tsx
    utils/                 ← Pure logic, each with a *.test.ts next to it
      linkResolver.ts        ← Wikilink target → note; unresolved-link list
      frontmatter.ts         ← YAML header → fields + body (js-yaml)
      embeds.ts              ← ![[Note]] / ![[Note#Section]] expansion
      searchQuery.ts         ← Search grammar, note matching and relevance score
      textRanges.ts          ← Text → Ranges, for the preview find bar
      cards.ts               ← Flashcards found in a note (callouts + cloze)
      noteQuery.ts           ← ```query block: parse, match, sort
      calendar.ts            ← Month grid maths for the daily-note calendar
      templateVars.ts        ← {{title}} / {{date}} / {{time}} expansion
      aiPrompts.ts           ← Ready-to-paste prompts for any AI chat
resources/               ← App icons (icon.ico, icon.icns, icons/)
scripts/generate-icons.js
```

`src/main/` also holds pure, tested modules: `link-rewrite.ts` (rename → rewrite
`[[links]]`), `odt.ts` (ODF XML → HTML), `srs.ts` (SM-2 scheduling + Anki text
exchange) and `apkg.ts` (Anki package → cards).

---

## IPC Pattern

**Every new feature that needs Node.js/filesystem access follows this pattern:**

1. **`src/main/index.ts`** — add `ipcMain.handle('namespace:action', async (_, ...args) => { ... })`
2. **`src/preload/index.ts`** — add to the `api` object: `myMethod: (args) => ipcRenderer.invoke('namespace:action', args)`
3. **Renderer** — call via `window.api.myMethod(args)`

TypeScript types for `window.api` are inferred automatically from the preload export.

---

## Vault Store (`vaultStore.ts`)

Key state:
- `vaultPath: string | null` — root folder of the open vault
- `tree: TreeNode[]` — full recursive file tree (includes .md, .pdf, .docx)
- `files: NoteFile[]` — **markdown-only** flat list (used for backlinks, search, wikilinks). PDFs and DOCX are intentionally excluded via `flattenTree()`
- `activeFile: NoteFile | null` — currently open file
- `activeContent: string` — current markdown content in editor
- `isDirty: boolean` — unsaved changes
- `backlinks: Record<string, string[]>` — name → list of files that link to it
- `srsStats` — card counters, so the toolbar badge does not have to ask the main process
- `searchOpen: boolean`
- `pinnedPaths: string[]`

**`flattenTree(nodes)`** — converts tree to flat NoteFile[]. Filters out binary files (via `isBinaryPath`) so they never appear in `store.files`.

Other state added in v0.9.0: `frontmatter: Record<filePath, data>` (parsed YAML per note) and a `tags` index that now includes frontmatter `tags:` and every parent of a nested tag.

---

## Binary File Handling Pattern

PDF, DOCX, EPUB and ODT files appear in the sidebar tree but are NOT treated as editable notes. The pattern:

**`src/main/index.ts` `walkTree()`:**
```typescript
const BINARY_EXTS = ['.pdf', '.docx', '.epub', '.odt']
// files filter includes both .md and BINARY_EXTS
// name for binary files keeps the extension; .md strips it
const name = isBinary ? f.name : f.name.replace(/\.md$/, '')
```

**`vaultStore.ts`** owns the renderer-side list — one place, not three:
```typescript
const BINARY_EXTS = ['.pdf', '.docx', '.epub', '.odt']
export const isBinaryPath = (p: string) => BINARY_EXTS.some((ext) => p.toLowerCase().endsWith(ext))
// flattenTree skips them; App.tsx re-exports it as isDocumentFile
```

**`App.tsx`:**
```typescript
const isDocumentFile = isBinaryPath
// handleFileSelect skips content read for binary files
// store.setActiveContent('') for binary files
// isPdf / isDocx / isEpub / isOdt / isDoc flags drive which viewer renders
```

**To add a new binary format:**
1. Add the extension to `BINARY_EXTS` in `walkTree` **and** in `vaultStore.ts`
2. Add an `isX` flag and a render branch in App.tsx
3. Either create a viewer, or reuse `DocxViewer` by adding an entry to its
   `READERS`/`ICONS` maps and passing `format="x"` (that is how `.odt` works)

---

## Markdown Preview Pipeline (`MarkdownPreview.tsx`)

Processing order:
1. `expandEmbeds(content, resolveEmbed)` — `![[Note]]` inlined (on raw markdown). Runs first so embedded text goes through the whole pipeline
2. `processWikiLinks(content, linkExists)` — `[[links]]` → `<a class="wikilink">`, unresolved ones get `wikilink-unresolved` (on raw markdown)
3. `remark().use(remarkGfm).use(remarkFrontmatter, ['yaml']).use(remarkHtml, { sanitize: false })` — markdown → HTML, YAML header dropped
4. Remove `disabled` from checkboxes (make them clickable)
5. `processCallouts(html)` — `> [!warning]` Obsidian callouts
6. `processHighlights(html)` — `==text==` → `<mark>`
7. `processTags(html)` — `#tag` → clickable chip
8. `processMath(html)` — `$$..$$` / `$...$` / `\[..\]` / `\(..\)` → KaTeX
9. `addHeadingIds(html)` — adds `id="..."` to h1/h2/h3 for TOC and `[[Note#Section]]` scrolling
10. Mermaid code block wrap → `<div class="mermaid-block"><pre class="mermaid">…`
11. ```query blocks → a live list of wikilinks (`renderQueryBlock`)
12. Resolve relative image paths to `file:///` URLs (for Electron)
13. `renderProperties(...)` prepends the frontmatter strip

**Code is always skipped**: steps 5–8 split the HTML on `CODE_BLOCK_RE`; steps 1–2 work on raw markdown and use `mapOutsideCode` / `MD_CODE_RE` instead. Both live in `markdownTransforms.ts` — a transform that forgets this will happily rewrite a documented example inside a fence.

---

## Since v0.5.2 → v0.10.0 (summary)

- **AI chat panel** (local GGUF via node-llama-cpp or remote API) + **AI text actions** (v0.5.x)
- **Community plugin system** with GitHub starter plugin; plugin exec bridge with `neutralLocale` flag
- **EPUB viewer** (epub.js) + new custom app icon (v0.6.x)
- v0.7.x: cleanup pass, sidebar lists files before folders, folder move with contents, graph stability/perf (no async camera movement), render/index/search optimizations
- v0.8.x: i18n (EN/PT/ES, typed against `en`), CI on node24
- **v0.9.0 — vault integrity + search.** See the section below.
- **v0.10.0 — study features.** Flashcards with spaced repetition, calendar,
  query blocks, `.apkg` import, aliases and vault diagnostics. See below.

---

## v0.10.0 — Study features

Built in four passes on top of v0.9.0. Same rule as before: additive, and the
notes stay plain Markdown.

### Flashcards (`src/main/srs.ts`, `utils/cards.ts`, `components/Review/`)

A card is a callout, so it renders anywhere and degrades into prose:

```markdown
> [!card]- Question
> Answer

> [!card] Title
> sentence with ==highlights==     ← one cloze card per highlight

> [!mnemonic]? Title               ← reviewable; without `?` it is decoration
```

- **SM-2** (the Anki algorithm) in `srs.ts` — pure, no mutation, 50+ tests.
  A scheduling bug here ruins months of study silently.
- State lives in `.openobsidian/srs.json`, written with write-then-rename.
  **Never inside the notes**: scheduling changes on every review and would
  dirty the diff of every note.
- `cardId` = FNV-1a over `relativePath::question`. Editing the **answer** keeps
  the schedule; editing the **question** creates a new card.
- Cards sync on vault open (`srs:sync-all`) *and* on save. Syncing only on save
  meant a card existed only after you happened to edit its note.
- The review panel reads the answer from the note at review time, so fixing the
  note fixes the card with no re-sync.
- End of session: replay the session as **practice** (writes nothing — grading
  the same cards again would punish the schedule for extra study) or pull the
  next 7 days.

### Anki import (`src/main/apkg.ts`)

Reads `.apkg` directly — no Anki Desktop needed.

- `.apkg` is a ZIP with a SQLite collection, read with **sql.js** (WASM, no
  native module, so the CI matrix is untouched). `sql-wasm.wasm` is in
  `asarUnpack`; verify with `electron-builder --dir` after touching packaging.
- Anki 2.1.50+ compresses the collection with zstd → **fzstd** (pure JS;
  Electron's Node has no zstd). Detection is by magic bytes, not file name.
- Cloze notes are detected by `{{c1::}}` in the text, not by the note-type
  table, whose format changed between Anki versions. **They have no answer
  field — requiring one silently threw every cloze note away.**
- `{{c1::x}}` → `==x==`, `[$]x[/$]` → `$x$`, `A::B` tags → `#A/B`.
- A deck lands as a folder, 100 cards per note: one note of 2000 cards takes
  ~900ms to render (remark 513ms + DOM 391ms), at 100 it is ~45ms.

### Query blocks (`utils/noteQuery.ts`)

````markdown
```query
tag: sis-cardio
tipo: patologia      ← any frontmatter field
sort: modificado desc
limit: 20
```
````

An unreadable line is shown above the results rather than ignored, and a spec
with no filter returns nothing instead of the whole vault.

### Everything else

- **Calendar** (`utils/calendar.ts`): month grid, days with a note marked, any
  day opens or creates. Six weeks always, local dates (not UTC, which shifts
  the day), `31/01 + 1 month` clamps to the 28th/29th.
- **Aliases**: `[[IAM]]` resolves through the frontmatter; a real file name
  always wins over an alias.
- **Vault diagnostics**: broken links, orphan notes, duplicate names.
- **User templates** in `_templates/` with `{{title}}`, `{{date}}`, `{{time}}`.
- **AI prompts** (`utils/aiPrompts.ts`): copies a ready-made prompt to the
  clipboard. Nothing is sent anywhere.
- **Search ranking**: exact title 100, exact alias 80, heading 12, body with
  diminishing returns — counting each mention linearly let a long note beat a
  note actually about the subject.

### Invariants added here

- Scheduling never goes in a note; note content never goes in `srs.json`.
- Anything keyed by `relativePath` must get it from `store.files`, never build
  it — the file tree once handed out an absolute path there and broke
  flashcards, decks, and anything else keyed that way.
- A parser that cannot read a line says so; it never guesses silently.

---

## v0.9.0 — Vault integrity and search

Driven by real friction building a ~470-note medical vault. Every change is
**additive and degrades gracefully**: notes stay plain Markdown on disk.

### Integrity (these used to lose data silently)

| Area | Before | Now |
|---|---|---|
| Rename | `file:rename` only did `fsp.rename` — every `[[link]]` broke silently | Scans the vault, asks *"N links in M notes — update?"*, then rewrites (keeps `\|alias`, `#anchor`, folder prefix; never touches code fences). `main/link-rewrite.ts` |
| Wikilinks | Exact-name `find()`; `[[A#Sec]]`, `[[Folder/A]]` did nothing on click | `utils/linkResolver.ts` — anchor scroll (reuses `addHeadingIds` via the shared `slugify`), path match, and duplicate names prefer the note closest to the linker |
| Dead links | Invisible | Rendered as `.wikilink-unresolved` (dashed red) + a **Broken links** panel (command palette) |
| Frontmatter | A leading `---` block rendered as a visible `<h2>` | `remark-frontmatter` drops it; `utils/frontmatter.ts` (js-yaml) parses fields into a properties strip and indexes them in `vaultStore` |
| Embeds | `![[Note]]` left a stray `!` | `utils/embeds.ts` — whole note or `#Section`, cycle guard, depth 3, missing target shown as a box |

### Search and navigation

- **`utils/searchQuery.ts`** — `tag:` `path:` `file:`, `"exact phrase"`, `-exclude`, regex toggle. `tag:` also matches child tags.
- Search **never truncates silently**: five lines per note plus a `+N occurrences` button.
- Search reads from the in-memory content cache instead of one disk read per note per keystroke.
- **Tags**: `TAG_RE` is now `/#([\p{L}\p{N}_/-]+)/gu` — accents and `#nested/tags` survive; tags inside code fences, purely numeric tags and hex colours are ignored. `expandTagHierarchy` makes a parent tag find its children.
- Tag chips are rendered in the sidebar (bounded to 22%) and inline in the preview, both clickable.
- Sidebar filter matches name, tags and aliases; several terms narrow the result.
- `Ctrl+F` in **Preview** opens `components/Find/PreviewFind.tsx` — CSS Custom Highlight API scoped to `.markdown-preview` (no DOM mutation, and it cannot match sidebar text the way `findInPage` would).
- **`.odt` support** (`main/odt.ts`, adm-zip + `content.xml`), reusing `DocxViewer` via a `format` prop. `turndown-plugin-gfm` fixes tables in both `.odt` and `.docx` conversion.
- Backlinks panel is capped at 38% with its own scroll and a collapsible header, so it can never hide the file tree again.

### Invariants worth keeping

- **The content cache must never go stale.** The watcher drops and re-reads entries changed outside the app (batched, then rebuilds backlinks/tags); the open note with unsaved edits is never overwritten. Search, backlinks and tags all read from this cache.
- **What renders as a tag and what gets indexed as a tag share one rule** (`processTags` mirrors `extractTags`).
- Pure logic lives in `utils/` or `main/*.ts` with `*.test.ts` next to it — 171 tests.

## Features Implemented (v0.5.2 baseline)

### Core editor
- CodeMirror 6 markdown editor with WikiLink syntax highlighting
- Split / Edit / Preview view modes (resizable)
- Auto-save (800ms debounce) — writes to disk, rebuilds backlinks
- Find & Replace (CodeMirror built-in, Ctrl+F)
- Insert menu: heading, bold, italic, table, code block, wikilink, image
- Image paste/drag-drop → saved to `_attachments/`, inline reference inserted
- Word/char/line/col stats in status bar

### Preview rendering
- GFM (tables, strikethrough, task lists with clickable checkboxes)
- `[[WikiLinks]]` — click to navigate, syntax highlighted in editor
- Obsidian callouts: `> [!info]`, `> [!warning]-` (collapsible), 20+ types
- Mermaid diagrams — click to zoom (modal with scroll wheel zoom + drag)
- KaTeX math: `$$block$$`, `$inline$`, `\[..\]`, `\(..\)`
- `==Highlight==` → `<mark>` with yellow tint
- Relative image paths resolved to `file:///` for Electron

### Sidebar & navigation
- Recursive file tree with folders (collapsible)
- Inline rename (click context menu → Rename, edit in place, Enter to confirm)
- Inline delete confirmation (no `window.confirm`)
- Drag & drop to move files between folders
- Pin notes to top of sidebar
- Sort: A→Z, Z→A, Recently modified
- Filter notes by name (local search input)
- Full-text search panel (Ctrl+Shift+F / 🔍 button) — powered by flexsearch
- Back/Forward navigation (Alt+←/→ or mouse buttons 3/4, toolbar ‹ › buttons)
- **Daily Notes** (📅 button) — creates/opens `YYYY-MM-DD.md` in vault root

### Document viewers
- **PDF** (📕): iframe viewer, native Chromium rendering. "📝 Open Notes" button creates `{name} - Notes.md`
- **DOCX** (📝): mammoth converts to HTML for display. "↗ Open in App" opens in Word/LibreOffice via `shell.openPath`. "⬇ Convert to .md" uses mammoth→HTML→turndown→Markdown and opens the result in the editor

### TOC panel
- ≡ button in toolbar-right opens 220px right panel
- Extracts H1/H2/H3 from current note's markdown (skips code blocks)
- Click any heading → smooth-scrolls preview to that heading (via auto-generated IDs)

### Other
- Backlinks panel (shows which notes link to the current one)
- Knowledge graph (D3, Ctrl+G)
- Settings modal (Ctrl+,): theme, font size, editor font, sidebar width, sort
- Template modal (Ctrl+N): create note from blank or template
- Export: HTML and PDF via `mainWindow.webContents.printToPDF()`
- Vault backup (Ctrl+Shift+B): `fs.cpSync` to user-selected destination
- Vault index cache: per-vault JSON in userData, skips re-reading unchanged files (mtime-based)
- Sidebar collapse (Ctrl+\, or ← button)
- Keyboard shortcuts: all documented in HelpModal (F1)

---

## Theming

CSS variables are set on `document.documentElement` by `useSettings`:
- `data-theme="dark"` or `"light"` on `<html>`
- `--font-size-editor`, `--editor-font`

Key variables (defined in `renderer/src/assets/main.css` or similar):
- `--bg-app`, `--bg-sidebar`, `--bg-editor`, `--bg-input`, `--bg-code`, `--bg-floating`
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-heading`
- `--border`, `--accent`, `--accent-hover`, `--accent-bg`, `--hover`
- `--success`

`color-mix(in srgb, var(--accent) 12%, transparent)` is used in places — Chromium 122+ / Electron 29 supports this.

---

## Known Limitations / Decisions Made

### Writing to disk

**A note is never written in place.** `writeFileAtomic` (`main/safe-write.ts`)
stages the content in a hidden `.name.md.saving` next to the target and renames
over it, which is atomic on NTFS and ext4. A plain `fs.writeFile` truncates the
file first, and auto-save opens that window every 800 ms of typing. The same
applies to `srs.json` and to the bulk rewrite a rename does across dozens of
notes. If the rename keeps failing (a sync client holding the file), it retries
and then falls back to writing in place — never worse than the old behaviour.

The staging name starts with a dot on purpose: `walkTree` skips dotfiles and the
chokidar watcher ignores them, so a save never flickers a phantom note into the
sidebar or triggers a re-index.

**A failed write is never silent.** Auto-save and the flush-on-leave both report
it (`toastSaveFailed`) and keep the dirty mark. Crashes append to `crash.log` in
userData and show a dialog — `uncaughtException` deliberately does not quit, so
unsaved text is not thrown away over an error the app survived.

### Closed on purpose — do not reopen without a new reason

- **No table preview while editing.** The editor stays plain text; split view is
  the answer. A WYSIWYG table widget inside CodeMirror is a large surface for a
  problem the split view already solves.
- **No per-note version history.** Notes are plain files in a folder the user
  already syncs (OneDrive/Drive/git), and those version them. The one case it
  would help is a rename rewriting links across dozens of notes — which asks for
  confirmation and reports the count first.

Nested callouts *were* on this list and came off it: once a card became a
callout, `> > [!card]` inside a `> [!warning]` was dropped by `extractCards`
with no error — a rendering wart had turned into silent data loss.

- **`window.confirm` / `window.prompt`** are unreliable in Electron (steal focus). All destructive actions use inline React UI instead. Errors use `notify()` toast.
- **DOCX headings**: only converts correctly if the DOCX uses Word's built-in Heading styles. Manually formatted "headings" (bold + large font) are invisible to any converter.
- **DOCX images**: mammoth drops embedded images during conversion (they don't appear in the .md output).
- **Math false positives**: `$...$` inline math regex skips `$` followed by whitespace to reduce currency false positives (`$10 and $20` won't match).
- **Mermaid + Vite**: needs `optimizeDeps: { include: ['mermaid', 'katex'] }` in `electron.vite.config.ts`.
- **Heavy dependencies load on demand**, and must stay that way — the eager
  bundle went from 4.5 MB to 2.2 MB by doing it. Mermaid (973 kB) and KaTeX
  (481 kB) are `await import`ed the first time a note actually has a diagram or
  a formula; `GraphView` (d3) and `EpubViewer` (epub.js + jszip) are
  `React.lazy`. A plain top-level `import` of any of them puts it back in the
  main chunk with no warning — check the build output after touching them.
  `hasMath` decides whether KaTeX is ever fetched: get it wrong and the formula
  never renders at all, hence its tests.
- **`file:rename` IPC**: preserves original extension. Renaming `report.pdf` to `quarterly` → `quarterly.pdf`.
- **Nav history**: uses `useRef` (not `useState`) to avoid stale closure issues in `handleNavBack`/`handleNavForward`.
- **PDF files** are displayed but content is never read as text (`store.setActiveContent('')`).
- **Block refs** (`[[Note#^id]]`) open the note but do not scroll: there is no block-id rendering yet.
- **`adm-zip` returns an empty string under vitest/jsdom.** The `.odt` unit tests therefore cover `odtToHtml(xml)` only; the ZIP read path has to be exercised in real Node. A green suite does not prove a real `.odt` opens.
- **Split view sends `Ctrl+F` to CodeMirror**, not to the preview find bar — the editor's is the only one with replace/regex.
- **Old git tags v0.1.0 / v0.2.0**: had an old CI workflow that called `npm run dist:win` (no `--publish never`) and would fail with missing GH_TOKEN. Deleted from remote. Don't re-push them.

---

## Build & Release

```bash
npm run dev          # dev mode (hot reload)
npm run build        # compile only (electron-vite)
npm run dist:win     # build + Windows NSIS installer → dist/
npm run dist:linux   # build + AppImage + deb → dist/

# Release flow:
git tag v0.X.Y
git push && git push --tags
# → GitHub Actions (.github/workflows/release.yml) builds win + linux
#   and creates a GitHub Release with artifacts
```

CI uses `npx electron-builder --win --publish never` (not `npm run dist:win`) to avoid auto-publish without token.

---

## Adding a New Feature — Checklist

1. **Needs filesystem/Node.js?** → IPC handler in `main/index.ts` + expose in `preload/index.ts`
2. **New UI component?** → `src/renderer/src/components/{Category}/{Component}.tsx + .css`
3. **New binary file type?** → Follow the Binary File Handling Pattern above
4. **New markdown syntax?** → Pure function in `markdownTransforms.ts` (+ `*.test.ts`), insert in the pipeline, add CSS in `MarkdownPreview.css`. Skip code blocks.
5. **New toolbar button?** → Add to `toolbar-right` or `toolbar-centre` in App.tsx. Check `isDoc` flag — hide editor-only controls when a binary file is active.
6. **New UI strings?** → All three locales in `i18n/translations.ts`; `en` is the type source, so a missing key fails `typecheck`.
7. **New pure logic?** → `utils/` or `src/main/*.ts` with a test beside it — not inside a component.
8. **New sidebar panel?** → Bound its height and give it its own scroll. The file tree must stay visible (see the backlinks panel).
9. **Bump version** in `package.json` **and refresh `package-lock.json`** (`npm install --package-lock-only`) — CI runs `npm ci` and a stale lock fails the release on purpose.
10. **Tag** with `git tag vX.Y.Z && git push origin HEAD --tags`. The tag must match the version in `package.json`.
