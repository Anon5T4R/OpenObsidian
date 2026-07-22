# Known limitations

What OpenObsidian deliberately does not do, why, and what it would cost to
change. Kept so the decision can be *revisited* rather than rediscovered — the
point of writing a limitation down is that next time it comes up, the argument
is already here and can be argued with.

Verified against the code at **v1.2.1**, 21/07/2026. Each entry says where it
lives, so a future reader can check whether it is still true.

**Legend for the verdict column of each section:**

- **Keep** — the trade is right; reopening needs a *new* reason, not a repeat
  of the old one.
- **Revisit if** — a named condition that would change the answer.

> **An accepted limitation has a shelf life.** Item 10 of the original backlog
> (nested callouts) was closed with a good argument: nesting is rare, and
> rewriting `processCallouts` risked regressions across 20+ callout types. The
> argument held exactly as long as a callout was only *appearance*. Once a
> flashcard became a callout, `> > [!card]` inside a `> [!warning]` was dropped
> by `extractCards` **with no error** — a rendering wart had become silent data
> loss, and the item was reopened and done.
>
> So when revisiting anything here, the question is not "does this still
> annoy?" but **"what has come to depend on it since the last decision?"**.
> That is the question that would have caught item 10 in time.

---

## 1. Search does not fold accents or stem

`cefaleia` does not find `cefaléia`; `cardíaco` does not find `cardiaco`.
Neither does `study` find `studies`.

**Where:** `utils/searchQuery.ts` — matching is `toLowerCase()` plus
`includes()`. There is no `normalize('NFD')` anywhere.

**Why it stayed:** the workaround is cheap and already conventional — a
"see also" line of synonyms near the top of a note, which also helps a human
skim. Accent folding alone is a two-line change (`normalize('NFD')` and strip
combining marks), but it silently widens every existing query, and in a
medical vault a wider match is not obviously better.

**What it would cost:** accent folding, half a day including tests. Stemming is
a different order of problem — it is language-specific, and the app ships in
three languages.

**Verdict:** Keep the stemming decision. **Revisit accent folding if** a user
reports a real miss; it is small, and the only reason not to do it is that
nobody has been bitten yet.

---

## 2. The sidebar filter does not read note content

Typing in the sidebar box matches file names, tags and aliases — not the text
inside notes.

**Where:** `components/Sidebar/sidebarFilter.ts`, fed from `FileTree.tsx`.

**Why it stayed:** it is a *filter on a tree*, meant to be instant while you
type. Full-text search exists one keystroke away (`Ctrl+Shift+F`) and shows
matching lines with context, which a tree cannot.

**Verdict:** Keep. Making the tree search content would produce a worse version
of a feature that already exists.

---

## 3. `[[Note#^block]]` opens the note but does not scroll

Section anchors (`[[Note#Section]]`) work. Block references do not.

**Where:** `utils/linkResolver.ts` parses the `^id`; nothing renders block ids,
so there is no target to scroll to. Zero occurrences of block-id handling in
the renderer.

**What it would cost:** block ids are a whole feature, not a fix — assigning
ids, persisting them when a paragraph moves, rendering them as anchors, and a
UI to copy a block reference. Multiple days, and it puts machine-generated ids
inside note text, which cuts against "notes stay plain Markdown".

**Verdict:** Keep. **Revisit if** you start linking to individual paragraphs
often enough that the workaround (link the note, name the section) grates.

---

## 4. Query blocks: conditions only ever add up

Two `tag:` lines, or a comma-separated list, both mean **AND**. There is no OR,
no negation, no grouping, and no counts.

```query
tag: cardio, pneumo     ← notes carrying BOTH, which is probably not what
                          a comma looks like it means
```

**Where:** `utils/noteQuery.ts` — `matchesQuery` requires every tag in
`spec.tags`. Frontmatter *values* are the opposite: `tipo: a, b` matches either.
The inconsistency is real and untested; the only test covering commas asserts
parsing, never matching.

**Why it stayed:** changing the comma to mean OR would silently change the
result of query blocks that already exist in vaults. The workaround for "either
one" is two blocks, which also reads more clearly in an index.

**What it would cost:** small in code. The cost is entirely in the silent
behaviour change, which is why it needs a deliberate decision, not a drive-by.

**Verdict:** **Revisit deliberately.** Of everything on this page this is the
one most likely to be worth doing, because the current behaviour surprises the
reader rather than merely limiting them. If it is done: make the comma mean OR,
keep separate lines meaning AND, and say so in the release notes.

---

## 5. A query with no filter returns nothing

`sort: modificado desc` plus `limit: 10` — "the ten notes I touched last" —
returns an empty list, because a spec with no filter is treated as empty.

**Where:** `utils/noteQuery.ts` `isEmptySpec`, asserted by a test.

**Why it stayed:** the guard exists so a half-written block does not dump the
entire vault into a note. But an explicit `limit:` *is* an intent, and this is
the most universally useful thing a dashboard could show — the one widget that
works in a vault with no conventions at all.

**What it would cost:** treat an explicit `limit:` as sufficient intent. A few
lines and a test. It cannot break an existing query, because every query that
would newly return results currently returns nothing.

**Verdict:** **Revisit.** This one is cheap and the blast radius is provably
zero. It is only unfixed because "do not touch the engine" was the right call
at the time it came up.

---

## 6. `sort: criado` needs `YYYY-MM-DD`

There is no creation date on disk that survives a sync or a copy, so it can
only come from a `created:`/`criado:` field written by hand — and it is
compared as text.

**Where:** `utils/noteQuery.ts` `sortValue` and `sortIssues`.

**Since v1.2.1 this fails loudly**: the block warns when no note declares the
field, and when a value is not ISO.

**Why it is not "fixed":** normalising `DD/MM/YYYY` means guessing —
`03/01/2026` is 3 January to half the world and 1 March to the other half, and
nothing in the file says which. Guessing would trade a visible error for an
invisible one.

**Verdict:** Keep. ISO is the supported form because lexicographic order on ISO
8601 *is* chronological order. **Revisit only if** a real creation timestamp
becomes available (it would have to come from the index, and would still be
wrong after any copy).

**The two apps disagree here.** Android's `NoteQuery.SortKey` is only
`{TITLE, MODIFIED, PATH}`, so `sort: criado` is always rejected as an
unreadable line — it never had the silent-wrong-order bug because it never
supported the key. An index that sorts correctly on the desktop therefore shows
a warning on the phone. Nothing in the reference vault uses it, so there is no
impact today, but the query grammar is meant to be one grammar: either both
accept `criado` with ISO, or both refuse it.

---

## 7. PDFs are displayed but never read as text

A PDF in the vault opens in a viewer, but its content is not searchable, does
not appear in backlinks, and cannot be queried.

**Where:** `App.tsx` sets `activeContent` to `''` for binary files;
`vaultStore.flattenTree` keeps them out of `store.files` entirely.

**Why it stayed:** extracting PDF text means a parser (`pdf.js` text layer or
similar), an index of a second content type, and a decision about scanned PDFs,
which need OCR and would be silently empty otherwise — the exact "looks like it
worked" failure this codebase keeps closing.

**Verdict:** Keep. **Revisit if** the PDF shelf grows enough that not finding
things in it becomes the daily friction.

---

## 8. DOCX conversion loses images, and "headings" that are only big bold text

Converting a `.docx` to Markdown drops embedded images, and any heading that
was formatted by hand instead of with Word's Heading styles is invisible to the
converter.

**Where:** `mammoth` (main process) → `turndown`.

**Why it stayed:** the first is a mammoth behaviour; the second is not
recoverable in principle — a paragraph in 16pt bold is not marked as a heading
anywhere in the file, so no converter can know.

**Verdict:** Keep the heading one — it is not solvable, only documentable.
**Revisit images if** anyone converts documents where the pictures carry the
content.

---

## 9. Inline math skips `$` followed by whitespace

`$10 and $20` is not treated as math. `$x$` is.

**Where:** the inline-math pass in `markdownTransforms.ts`.

**Why it stayed:** it is a deliberate trade against currency false positives,
which are far more common in prose than inline maths starting with a space.

**Verdict:** Keep. Use `\(...\)` when the ambiguity actually bites.

---

## 10. No table preview while editing, and no per-note version history

Both were considered and closed.

**Tables:** the editor stays plain text; split view already shows the rendered
table live. A WYSIWYG table widget inside CodeMirror is a large surface for a
problem that is already solved.

**History:** notes are plain files in a folder the user already syncs
(OneDrive, Drive, git), and those version them. The one case it would help — a
rename rewriting links across dozens of notes — already asks for confirmation
and reports the count first.

**Verdict:** Keep both. **Revisit history if** the app ever gains an operation
that rewrites many notes *without* confirmation. It currently has none, and
should not.

---

## 11. Nothing is code-signed

Windows SmartScreen says "unknown publisher"; macOS Gatekeeper blocks the first
launch and its wording ("damaged") is scarier than the truth.

**Why it stayed:** a certificate is a recurring cost and, on macOS, a
notarisation step in CI. For a project distributed to people who read the
README, the workaround is one right-click.

**Verdict:** Keep for now. **Revisit if** the app is ever handed to someone who
will not read instructions before installing.

---

## Not limitations, but worth knowing

- **`adm-zip` returns an empty string under vitest/jsdom.** A green `.odt` or
  `.apkg` unit test therefore does not prove a real file opens; those paths have
  to be exercised in real Node, and packaging has to be checked with
  `electron-builder --dir`.
- **In split view `Ctrl+F` goes to the editor**, not to the reading-view find
  bar, because only the editor's has replace and regex.
