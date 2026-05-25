# OpenObsidian — User Guide

> Open-source markdown knowledge base for Windows and Linux.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Interface Overview](#2-interface-overview)
   - [Toolbar (top bar)](#toolbar-top-bar)
   - [Sidebar (left panel)](#sidebar-left-panel)
   - [Editor area](#editor-area)
   - [Status bar (bottom bar)](#status-bar-bottom-bar)
   - [Backlinks panel](#backlinks-panel)
3. [Writing Notes](#3-writing-notes)
   - [Markdown syntax](#markdown-syntax)
   - [Slash commands](#slash-commands)
   - [WikiLinks & autocomplete](#wikilinks--autocomplete)
   - [Right-click context menu](#right-click-context-menu-editor)
4. [Features](#4-features)
   - [Templates](#templates)
   - [Tags](#tags)
   - [Pin notes](#pin-notes)
   - [Sidebar sort](#sidebar-sort)
   - [Find & Replace](#find--replace)
   - [Full-text search](#full-text-search)
   - [Export (HTML & PDF)](#export-html--pdf)
   - [Zoom](#zoom)
   - [Graph view](#graph-view)
   - [Drag & drop](#drag--drop)
   - [Image paste](#image-paste)
   - [Vault backup](#vault-backup)
5. [Keyboard Shortcuts](#5-keyboard-shortcuts)
6. [Settings](#6-settings)
7. [Technical Notes](#7-technical-notes)

---

## 1. Getting Started

### Opening a vault

A **vault** is any folder on your computer that contains `.md` files. OpenObsidian treats the entire folder (including subfolders) as your note collection.

1. Launch OpenObsidian.
2. Click **Open Vault Folder** on the welcome screen, or press `Ctrl+Shift+O`.
3. Select a folder. OpenObsidian will load all `.md` files inside it.

On the next launch the app will offer to reopen the last vault automatically.

### Creating your first note

- Click the **+** button in the sidebar, or press `Ctrl+N`.
- A **template picker** appears — choose a template and type a name.
- Press `Enter` or click **Create**.

---

## 2. Interface Overview

### Toolbar (top bar)

Appears above the editor whenever a note is open.

| Element | Description |
|---|---|
| **Note title** | Name of the active file. A purple dot indicates unsaved changes. |
| **Insert** | Drop-down menu with reusable snippets (table, code, checkbox, image, date, WikiLink…). |
| **Edit / Split / Preview** | Switches between editor-only, side-by-side, and rendered preview. |
| **↓ Export** | Saves the note as HTML or PDF. |
| **◎ Graph** | Toggles the knowledge graph (`Ctrl+G`). |
| **? Help** | Opens this help window (`F1`). |
| **⚙ Settings** | Opens the settings modal (`Ctrl+,`). |

### Sidebar (left panel)

The sidebar shows the vault file tree and several filtering tools.

```
┌─────────────────────────────┐
│ MyVault          + 📁 A→Z ← │  ← header: vault name, actions, sort, collapse
├─────────────────────────────┤
│ Filter notes…               │  ← search/filter box
├─────────────────────────────┤
│ 📌 Pinned                   │  ← pinned notes section (if any)
│   📄 Important note         │
├─────────────────────────────┤
│ #project  #study  ✕         │  ← tag filter chips
├─────────────────────────────┤
│ ▾ 📁 Projects               │  ← file tree
│     📄 My project           │
│ 📄 Quick note               │
└─────────────────────────────┘
```

**Header buttons:**

| Button | Action |
|---|---|
| `+` | New note (opens template picker) |
| `📁` | New folder at vault root |
| `A→Z / Z→A / Recent` | Sort order dropdown |
| `←` / `→` | Collapse / expand sidebar (`Ctrl+\`) |

**Right-click menu (file or folder):**

| Option | Description |
|---|---|
| 📄 New Note Here | Creates a note inside that folder |
| 📁 New Folder Here | Creates a subfolder |
| ✏️ Rename | Renames the item |
| 📋 Duplicate | Duplicates a note |
| 📌 Pin / Unpin | Pins note to top of sidebar |
| 📎 Copy Path | Copies absolute path to clipboard |
| 📂 Show in File Manager | Reveals file in Explorer / Nautilus |
| 🗑 Delete | Permanently deletes |

### Editor area

The main area supports three view modes:

- **Edit** — CodeMirror 6 editor with syntax highlighting, autocomplete, and WikiLink decorations.
- **Split** — editor and rendered preview side by side. Drag the divider to resize.
- **Preview** — rendered HTML preview only (GFM, tables, task lists).

### Status bar (bottom bar)

Shown below the editor for the active note.

```
  248 words · 1 432 chars · Ln 12 Col 5                             Find
```

| Field | Description |
|---|---|
| N words | Live word count |
| N chars | Live character count |
| Ln N Col N | Cursor position |
| Find | Opens Find & Replace panel (`Ctrl+F`) |

### Backlinks panel

Located at the bottom of the sidebar. Lists every note that links to the currently open note via `[[WikiLink]]`. Click any entry to navigate to that note.

---

## 3. Writing Notes

### Markdown syntax

OpenObsidian uses **GitHub Flavored Markdown (GFM)**.

| Syntax | Result |
|---|---|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `~~strikethrough~~` | ~~strikethrough~~ |
| `` `inline code` `` | `inline code` |
| `==highlight==` | highlighted text |
| `# Heading 1` | Large heading |
| `## Heading 2` | Medium heading |
| `### Heading 3` | Small heading |
| `- item` | Bullet list |
| `1. item` | Numbered list |
| `- [ ] task` | Unchecked checkbox |
| `- [x] done` | Checked checkbox |
| `> quote` | Blockquote |
| `---` | Horizontal rule |
| `[text](url)` | Web link |
| `![alt](image.png)` | Embedded image |

**Code blocks:**
````
```python
print("Hello, world!")
```
````

**Tables:**
```
| Column 1 | Column 2 |
| --- | --- |
| Cell A   | Cell B   |
```

### Slash commands

Type `/` at the **start of a line** to open the command palette.

| Command | Inserts |
|---|---|
| `/h1` | `# Heading 1` |
| `/h2` | `## Heading 2` |
| `/h3` | `### Heading 3` |
| `/table` | Markdown table skeleton |
| `/code` | Fenced code block |
| `/quote` | Blockquote |
| `/bold` | `**text**` |
| `/italic` | `*text*` |
| `/check` | `- [ ] ` checkbox |
| `/list` | `- ` bullet |
| `/numlist` | `1. ` numbered item |
| `/hr` | `---` horizontal rule |
| `/link` | `[text](url)` |
| `/image` | `![alt](url)` |
| `/date` | Today's date |
| `/wikilink` | `[[` with autocomplete |

### WikiLinks & autocomplete

Type `[[` anywhere to open the WikiLink autocomplete popup. Start typing a note name — matching notes appear in a dropdown. Use `↑`/`↓` to navigate and `Enter` to confirm.

**Syntax:**
- `[[Note Name]]` — links to "Note Name"
- `[[Note Name|Display text]]` — shows "Display text", links to "Note Name"

WikiLinks are rendered as clickable purple links in the editor and in preview mode.

### Right-click context menu (editor)

Right-click selected text in the editor to format it:

- **Bold**, **Italic**, **Strikethrough**, **Inline code**
- **Link** — wraps selection as `[selection](url)`
- **WikiLink** — wraps selection as `[[selection]]`

---

## 4. Features

### Templates

Every new note opens a template picker with 6 built-in options:

| Template | Contents |
|---|---|
| 📄 Blank note | Just the title heading |
| 📅 Daily note | Today's date, focus, notes and done sections |
| 🤝 Meeting notes | Date, attendees, agenda, notes, action items |
| 🚀 Project plan | Overview, goals, task checklist, resources |
| 📚 Book notes | Author, rating, summary, key ideas, quotes |
| 💡 Idea / brainstorm | The idea, why it matters, how to explore, related links |

Type a name, select a template, press `Enter` or click **Create**.

### Tags

Write `#tag` anywhere in a note body (e.g. `#project`, `#study-notes`). Tags are automatically extracted when you save.

In the sidebar, **tag chips** appear above the file tree. Click a chip to filter the tree to only notes containing that tag. Click **✕** to clear the filter.

Valid tag characters: letters, numbers, `-`, `_`.

### Pin notes

Right-click any file → **📌 Pin to top**. Pinned notes appear in a dedicated section at the very top of the sidebar, above the file tree. Pins survive app restarts (stored in `localStorage`).

Right-click a pinned note → **📌 Unpin** to remove it.

### Sidebar sort

Use the dropdown in the sidebar header:

| Option | Order |
|---|---|
| A→Z | Alphabetical ascending (default) |
| Z→A | Alphabetical descending |
| Recent | Most recently modified first |

Folders always appear before files.

### Find & Replace

Press `Ctrl+F` or click **Find** in the status bar. A panel opens inside the editor with:

- **Search** field with match counter.
- **Replace** field.
- Options: **Match case**, **RegExp**.
- `Enter` — next match. `Shift+Enter` — previous match.
- **Replace** / **Replace all** buttons.
- `Escape` to close.

### Full-text search

Press `Ctrl+Shift+F` to open the search panel. It searches the content of every note in the vault. Results show the note name and the matching line in context. Click a result to open that note.

### Export (HTML & PDF)

Click the **↓** button in the toolbar:

- **Export as HTML** — converts markdown to a fully styled, standalone HTML file. A save dialog appears.
- **Export as PDF** — switches to Preview mode and uses Electron's PDF engine. A save dialog appears. The resulting PDF matches what you see in Preview mode.

### Zoom

Adjusts the **editor font size** only (the rest of the UI is unchanged):

| Shortcut | Action |
|---|---|
| `Ctrl+=` | Increase font size (+1 px) |
| `Ctrl+-` | Decrease font size (-1 px) |
| `Ctrl+0` | Reset to default (14 px) |

Range: 10 px – 26 px. The setting is persisted across sessions.

### Graph view

Press `Ctrl+G` or click **◎** in the toolbar. The graph overlays the editor area:

- Each **node** is a note. Node size reflects the number of WikiLink connections.
- Each **edge** is a `[[WikiLink]]` between two notes.
- **Hover** a node to highlight its direct neighbours.
- **Click** a node to open that note.
- **Drag** nodes to rearrange. **Scroll** to zoom. **Drag background** to pan.
- Toggle **Local** mode to show only notes connected to the currently open one.

### Drag & drop

In the file tree, drag any file or folder and drop it onto:

- **A folder** — moves the item inside that folder.
- **Empty space** in the tree — moves the item to the vault root.

### Image paste

Copy any image to the clipboard (e.g. screenshot with `PrintScreen`, or copy from browser). With the editor focused, press `Ctrl+V`. The image is:

1. Saved as a PNG to `<vault>/_attachments/<timestamp>.png`.
2. An `![image](_attachments/…)` link is inserted at the cursor.

### Vault backup

Press `Ctrl+Shift+B` or use **File → Backup vault**. A folder picker appears. OpenObsidian copies the entire vault to `<chosen folder>/<vault name>-backup-<timestamp>/`.

---

## 5. Keyboard Shortcuts

### Vault & navigation

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+O` | Open vault folder |
| `Ctrl+N` | New note (opens template picker) |
| `Ctrl+Shift+F` | Full-text search |
| `Ctrl+G` | Toggle graph view |
| `Ctrl+\` | Collapse / expand sidebar |

### Editor

| Shortcut | Action |
|---|---|
| `Ctrl+F` | Find & Replace inside current note |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+V` | Paste (+ image-from-clipboard support) |
| `/` | Slash command palette (at start of line) |
| `[[` | WikiLink autocomplete |
| Right-click | Format selection (bold, italic, link…) |

### Zoom

| Shortcut | Action |
|---|---|
| `Ctrl+=` | Increase editor font size |
| `Ctrl+-` | Decrease editor font size |
| `Ctrl+0` | Reset editor font size |

### App

| Shortcut | Action |
|---|---|
| `Ctrl+,` | Settings |
| `Ctrl+Shift+B` | Backup vault |
| `F1` | Help |

---

## 6. Settings

Open with `Ctrl+,` or the **⚙** button.

| Setting | Options |
|---|---|
| **Theme** | Dark / Light |
| **Editor font size** | 10 – 26 px (also controlled by `Ctrl+=` / `Ctrl+-`) |
| **Editor font** | Monospace font family |
| **Sidebar width** | Draggable resize handle |
| **Sidebar sort** | A→Z / Z→A / Recent |

---

## 7. Technical Notes

### Where data is stored

| Data | Location |
|---|---|
| Notes | Your vault folder (plain `.md` files) |
| Attachments | `<vault>/_attachments/` |
| App settings (last vault) | `%APPDATA%/OpenObsidian/app-settings.json` (Windows) or `~/.config/OpenObsidian/app-settings.json` (Linux) |
| Vault index cache | `%APPDATA%/OpenObsidian/indices/<key>.json` |
| UI preferences (theme, font, pins) | Browser `localStorage` inside the Electron renderer |

### Vault index cache

On each vault open, OpenObsidian checks each file's modification time against a cached copy stored in `userData/indices/`. Only files that changed since the last session are re-read from disk. Unchanged notes load from the cache instantly. The cache is also updated each time you save a note.

### File format

Notes are plain `.md` files — fully compatible with Obsidian, VS Code, Typora, and any text editor.

### Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 29 |
| UI framework | React 18 + TypeScript |
| Build tool | electron-vite 2 |
| Editor | CodeMirror 6 |
| State management | Zustand |
| Markdown preview | remark + remark-gfm + remark-html |
| Graph view | D3.js v7 |
| File watching | chokidar |
| Installers | electron-builder (NSIS, AppImage, .deb, Flatpak) |
