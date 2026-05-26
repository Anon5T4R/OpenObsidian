# OpenObsidian — Project Context for Claude

Open-source Obsidian-like markdown knowledge base built with Electron + React + TypeScript.
Repo: https://github.com/Anon5T4R/OpenObsidian
Current version: **0.5.2**

---

## Stack

| Layer | Technology |
|---|---|
| Shell | Electron 29, electron-vite 2 |
| UI | React 18, TypeScript |
| Editor | CodeMirror 6 (`@codemirror/*`) |
| Markdown preview | remark + remark-gfm + remark-html |
| Math | KaTeX (transitive dep of mermaid, imported directly) |
| Diagrams | Mermaid v11 (lazy-loaded chunks) |
| DOCX reading | mammoth (main process only) |
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
      Backlinks/BacklinksPanel.tsx
      Search/SearchPanel.tsx        ← Full-text search (flexsearch)
      Graph/GraphView.tsx           ← D3 knowledge graph
      Insert/InsertMenu.tsx         ← Toolbar insert menu (table, heading, etc.)
      Settings/SettingsModal.tsx
      Help/HelpModal.tsx
      Templates/TemplateModal.tsx
resources/               ← App icons (icon.ico, icon.icns, icons/)
scripts/generate-icons.js
```

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

**`flattenTree(nodes)`** — converts tree to flat NoteFile[]. Filters out `.pdf` and `.docx` so they never appear in `store.files`.

---

## Binary File Handling Pattern

PDF and DOCX files appear in the sidebar tree but are NOT treated as editable notes. The pattern:

**`src/main/index.ts` `walkTree()`:**
```typescript
const BINARY_EXTS = ['.pdf', '.docx']
// files filter includes both .md and BINARY_EXTS
// name for binary files keeps the extension; .md strips it
const name = isBinary ? f.name : f.name.replace(/\.md$/, '')
```

**`vaultStore.ts` `flattenTree()`:**
```typescript
if (node.type === 'file' && !node.path.endsWith('.pdf') && !node.path.endsWith('.docx')) {
  // only push .md files to store.files
}
```

**`App.tsx`:**
```typescript
const isDocumentFile = (p: string) => p.endsWith('.pdf') || p.endsWith('.docx')
// handleFileSelect skips content read for binary files
// store.setActiveContent('') for binary files
// isPdf / isDocx / isDoc flags drive which viewer renders
```

**To add a new binary format** (e.g. `.epub`):
1. Add `'.epub'` to `BINARY_EXTS` in `walkTree`
2. Add `&& !node.path.endsWith('.epub')` to `flattenTree`
3. Add to `isDocumentFile()` in App.tsx
4. Create `src/renderer/src/components/Epub/EpubViewer.tsx`
5. Add `isEpub` flag and render branch in App.tsx

---

## Markdown Preview Pipeline (`MarkdownPreview.tsx`)

Processing order (all on the HTML string after remark):
1. `processWikiLinks(content)` — `[[links]]` → `<a class="wikilink">` (on raw markdown)
2. `remark().use(remarkGfm).use(remarkHtml, { sanitize: false })` — markdown → HTML
3. Remove `disabled` from checkboxes (make them clickable)
4. `processCallouts(html)` — `> [!warning]` Obsidian callouts
5. `processHighlights(html)` — `==text==` → `<mark>`
6. `processMath(html)` — `$$..$$` / `$...$` / `\[..\]` / `\(..\)` → KaTeX
7. `addHeadingIds(html)` — adds `id="..."` to h1/h2/h3 for TOC scrolling
8. Mermaid code block wrap → `<div class="mermaid-block"><pre class="mermaid">…`
9. Resolve relative image paths to `file:///` URLs (for Electron)

**Code blocks are always skipped** in steps 4–6 by splitting on `(<pre…</pre>|<code…</code>)`.

---

## Features Implemented (v0.5.2)

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
4. **New markdown syntax?** → Add processing function in `MarkdownPreview.tsx`, insert in pipeline, add CSS in `MarkdownPreview.css`
5. **New toolbar button?** → Add to `toolbar-right` or `toolbar-centre` in App.tsx. Check `isDoc` flag — hide editor-only controls when PDF/DOCX is active.
6. **Bump version** in `package.json` before committing the release.
7. **Tag** with `git tag vX.Y.Z && git push --tags`.
