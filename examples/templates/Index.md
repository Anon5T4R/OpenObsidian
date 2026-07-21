---
tipo: index
---

# {{title}}

#type-index

> A living index: every block below reads the notes' tags when the page is
> rendered, so it cannot go stale. Created on {{date}}.

---

## How to use this template

Copy a block per section, change the tag, and delete this section.

Inside a block, type `#` and the first letters of a tag — the editor completes
from the tags this vault actually has, most-used first, with the note count
beside each one. Use it: a mistyped tag does not fail, it quietly creates a new
tag with a single note in it.

Fields: `tag`, `path`/`pasta`, `has`/`tem`, `sort`/`ordenar`, `limit`/`limite`,
plus any frontmatter field of your own. Sort by `titulo`, `modificado`,
`criado` or `caminho`, with `desc` at the end to reverse. A line starting with
`#` is a comment and is not read.

Two `tag:` lines in one block **add up** — a note has to carry both. For
"either one", use two blocks.

Replace the tags below with your own. They are only here to show the shape.

---

## By subject

### First subject

```query
tag: your-tag
sort: titulo
```

### Second subject

```query
tag: another-tag
sort: titulo
```

---

## Two conditions at once

Both have to be true — here, a protocol *and* about intensive care:

```query
tag: protocol
tag: intensive-care
sort: titulo
limit: 30
```

---

## Recently touched

```query
tag: your-tag
sort: modificado desc
limit: 15
```

---

## Anything with a given frontmatter field

Notes that declare `source:` in their frontmatter, whatever its value:

```query
has: source
sort: modificado desc
```

---

## By a frontmatter field's value

```query
tipo: patologia
sort: titulo
```
