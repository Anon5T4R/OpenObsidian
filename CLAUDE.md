# OpenObsidian — Project Context for Claude

Open-source Obsidian-like markdown knowledge base built with Electron + React + TypeScript.
Repo: https://github.com/Anon5T4R/OpenObsidian
Current version: **0.9.0**

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
      Diagnostics/BrokenLinksPanel.tsx + .css  ← Link targets with no note behind them
      Graph/GraphView.tsx           ← D3 knowledge graph
      Insert/InsertMenu.tsx         ← Toolbar insert menu (table, heading, etc.)
      Settings/SettingsModal.tsx
      Help/HelpModal.tsx
      Templates/TemplateModal.tsx
    utils/                 ← Pure logic, each with a *.test.ts next to it
      linkResolver.ts        ← Wikilink target → note; unresolved-link list
      frontmatter.ts         ← YAML header → fields + body (js-yaml)
      embeds.ts              ← ![[Note]] / ![[Note#Section]] expansion
      searchQuery.ts         ← Search grammar and note matching
      textRanges.ts          ← Text → Ranges, for the preview find bar
resources/               ← App icons (icon.ico, icon.icns, icons/)
scripts/generate-icons.js
```

`src/main/` also holds pure, tested modules: `link-rewrite.ts` (rename → rewrite
`[[links]]`) and `odt.ts` (ODF XML → HTML).

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
11. Resolve relative image paths to `file:///` URLs (for Electron)
12. `renderProperties(...)` prepends the frontmatter strip

**Code is always skipped**: steps 5–8 split the HTML on `CODE_BLOCK_RE`; steps 1–2 work on raw markdown and use `mapOutsideCode` / `MD_CODE_RE` instead. Both live in `markdownTransforms.ts` — a transform that forgets this will happily rewrite a documented example inside a fence.

---

## Since v0.5.2 → v0.9.0 (summary)

- **AI chat panel** (local GGUF via node-llama-cpp or remote API) + **AI text actions** (v0.5.x)
- **Community plugin system** with GitHub starter plugin; plugin exec bridge with `neutralLocale` flag
- **EPUB viewer** (epub.js) + new custom app icon (v0.6.x)
- v0.7.x: cleanup pass, sidebar lists files before folders, folder move with contents, graph stability/perf (no async camera movement), render/index/search optimizations
- v0.8.x: i18n (EN/PT/ES, typed against `en`), CI on node24
- **v0.9.0 — vault integrity + search.** See the section below.

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

- **`window.confirm` / `window.prompt`** are unreliable in Electron (steal focus). All destructive actions use inline React UI instead. Errors use `notify()` toast.
- **DOCX headings**: only converts correctly if the DOCX uses Word's built-in Heading styles. Manually formatted "headings" (bold + large font) are invisible to any converter.
- **DOCX images**: mammoth drops embedded images during conversion (they don't appear in the .md output).
- **Math false positives**: `$...$` inline math regex skips `$` followed by whitespace to reduce currency false positives (`$10 and $20` won't match).
- **Mermaid + Vite**: needs `optimizeDeps: { include: ['mermaid', 'katex'] }` in `electron.vite.config.ts`.
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
