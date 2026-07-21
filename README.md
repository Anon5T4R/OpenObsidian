# OpenObsidian

An offline, open-source knowledge base for Markdown vaults — built with Electron, React and TypeScript.

Your notes are plain `.md` files in a folder you choose. Nothing is uploaded, there is no account,
and every feature below degrades gracefully: open the same vault in any other Markdown editor and
it still reads as ordinary text.

**[Download the latest release](https://github.com/Anon5T4R/OpenObsidian/releases)** — Windows
installer, Linux AppImage and `.deb`, macOS `.dmg` (Apple Silicon and Intel).
Android version: <https://github.com/Anon5T4R/OpenObsidianAndroid/releases>

The builds are not code-signed. Windows shows an "unknown publisher" warning
(*More info* → *Run anyway*); on macOS the app is quarantined, so open it once
with right-click → *Open*, or run `xattr -dr com.apple.quarantine
/Applications/OpenObsidian.app`.

---

## Features

### Writing

- CodeMirror 6 editor with live WikiLink highlighting, split / edit / reading views
- Auto-save, find & replace, slash commands (`/table`, `/h2`, `/code`…) and an insert menu
- Paste or drag an image straight into a note — it lands in `_attachments/`

### Rendering

- GFM: tables, task lists you can tick from the reading view, strikethrough
- Obsidian callouts (`> [!warning]`), collapsible ones included
- Mermaid diagrams (click to zoom), KaTeX maths, `==highlights==`
- YAML frontmatter shown as a properties strip instead of being rendered as text
- `%%private comments%%` that stay in the file but never render

### Linking

- `[[WikiLinks]]`, including `[[Note#Section]]`, `[[Folder/Note]]` and `![[embeds]]`
- **Renaming a note rewrites the links that point at it** — with a confirmation showing how many
- Aliases: declare `aliases:` in the frontmatter and the note answers to every name
- Dead links are visibly dead, and a **vault diagnostics** panel lists broken links, orphan notes
  and duplicate names
- Backlinks panel and a D3 knowledge graph with a local (neighbourhood) mode

### Finding

- Search with operators: `tag:`, `path:`, `file:`, `"exact phrase"`, `-exclusion` and regex
- Nothing is hidden: every occurrence is reachable, never silently truncated
- Tags with accents and hierarchy (`#sistema/cardio` — the parent finds its children)
- Sidebar filter that matches names, tags and aliases
- `Ctrl+F` highlights inside the reading view, not only in the editor

### Studying

- **Flashcards with spaced repetition (SM-2)** — cards live inside your notes as callouts:

  ```markdown
  > [!card]- What is the qSOFA triad?
  > RR >= 22 · SBP <= 100 · GCS < 15.

  > [!card] Krebs cycle
  > ==Citrate synthase== condenses ==acetyl-CoA==.
  ```

  Each `==highlight==` becomes its own gap-fill card.

- Review panel with a keyboard-only flow, decks by tag or note, suspend, statistics
  (retention, 14-day forecast), and a practice round that does not touch the schedule
- **Imports an Anki `.apkg` directly** — no Anki Desktop needed. Cloze notes become
  gap-fill cards, `A::B` tags become `#A/B`, and a big deck lands as a folder of notes
- Scheduling lives in `.openobsidian/srs.json` — never inside your notes

### Everything else

- Calendar with daily notes: days that have a note are marked, any day can be opened or created
- **Query blocks** that keep an index derived from the notes instead of typed by hand —
  see [Indexes that maintain themselves](#indexes-that-maintain-themselves) below
- Your own templates in `_templates/`, with `{{title}}`, `{{date}}` and `{{time}}`
- Reads `.pdf`, `.docx`, `.epub` and `.odt`; converts `.docx`/`.odt` to Markdown
- Local AI chat (GGUF via node-llama-cpp) or a remote API — plus a command that copies a
  ready-made prompt for whichever AI chat you already use
- Export to HTML and PDF, vault backup, community plugins
- Interface in English, Portuguese and Spanish

---

## Indexes that maintain themselves

A hand-written index goes stale, and a stale index is worse than none, because
you trust it. A `query` block lists the notes that match, recomputed every time
the note is rendered — so a note you write tomorrow shows up on its own.

Type `/indice` (or `/index`) in the editor and you get the scaffold:

````markdown
## Cardiology

```query
# fields: tag, path, has, sort, limit — a line starting with # is a comment
tag: cardio
sort: titulo
```
````

Inside the block, type `#` and the first letters of a tag: the editor completes
from the tags **your vault actually has**, most-used first, with the note count
next to each. That matters more than it sounds — a mistyped tag does not fail,
it quietly creates a new tag with one note in it.

**What you can filter on**

| | |
|---|---|
| `tag:` | a tag. A parent tag finds its children, so `tag: sistema` matches `#sistema/cardio` |
| `path:` / `pasta:` | notes whose path contains this |
| `has:` / `tem:` | notes where a frontmatter field is present |
| any other name | a frontmatter field: `tipo: patologia` |
| `sort:` / `ordenar:` | `titulo`, `modificado`, `criado`, `caminho` — add `desc` to reverse |
| `limit:` / `limite:` | how many at most |

Two conditions in one block **add up** — this is protocols *and* intensive care:

````markdown
```query
tag: protocolo
tag: uti
sort: titulo
limit: 30
```
````

For "either one", use two blocks. A line the parser cannot read is shown above
the results instead of being ignored, and a block with no filter returns
nothing rather than your whole vault.

**Turning it into a template.** Once an index has the shape you want, save it as
`_templates/Index.md`. `Ctrl+N` then offers it, with `{{title}}` and `{{date}}`
filled in — so every new index starts from the version you already tuned. There
is a complete one, with a section explaining each field, in
[`examples/templates/Index.md`](examples/templates/Index.md).

---

## Development

```bash
npm install
npm run dev        # Electron + Vite with hot reload
npm run typecheck  # tsc across the three tsconfigs
npm run lint
npm run test       # vitest
npm run build
```

Releasing is a tag: bump `version` in `package.json`, refresh `package-lock.json`
(`npm install --package-lock-only`), then `git tag vX.Y.Z && git push origin HEAD --tags`.
GitHub Actions builds Windows and Linux and publishes the release.

`CLAUDE.md` documents the architecture, the IPC pattern and the invariants worth keeping.

---

## Licence

[GNU GPL v3 or later](LICENSE). Use it, change it, share it — a modified version you
distribute has to stay open under the same terms.

---

## Support

Donate via Patreon: <https://www.patreon.com/cw/joaoferreirav>
