# OpenObsidian

An offline, open-source knowledge base for Markdown vaults — built with Electron, React and TypeScript.

Your notes are plain `.md` files in a folder you choose. Nothing is uploaded, there is no account,
and every feature below degrades gracefully: open the same vault in any other Markdown editor and
it still reads as ordinary text.

**[Download the latest release](https://github.com/Anon5T4R/OpenObsidian/releases)** — Windows
installer, Linux AppImage and `.deb`.
Android version: <https://github.com/Anon5T4R/OpenObsidianAndroid/releases>

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
- **Query blocks** that keep an index derived from the notes instead of typed by hand:

  ````markdown
  ```query
  tag: cardio
  tipo: patologia
  sort: modificado desc
  ```
  ````

- Your own templates in `_templates/`, with `{{title}}`, `{{date}}` and `{{time}}`
- Reads `.pdf`, `.docx`, `.epub` and `.odt`; converts `.docx`/`.odt` to Markdown
- Local AI chat (GGUF via node-llama-cpp) or a remote API — plus a command that copies a
  ready-made prompt for whichever AI chat you already use
- Export to HTML and PDF, vault backup, community plugins
- Interface in English, Portuguese and Spanish

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
