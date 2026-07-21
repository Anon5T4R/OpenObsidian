// Matching for the sidebar's "filter notes" box.
// Matching only the file name forced note names to carry all the searchable
// information (hence names like "Síndrome Coronariana Aguda (SCA)"); tags and
// aliases are what the user actually thinks in.

export interface FilterableNote {
  name: string
  tags: string[]
  aliases: string[]
}

/** One term matched against name, tags and aliases (or tags only, with `#`). */
function matchesTerm(note: FilterableNote, term: string): boolean {
  const tagHit = (needle: string) =>
    note.tags.some((tag) => tag.toLowerCase().includes(needle))

  if (term.startsWith('#')) {
    const needle = term.slice(1)
    return needle ? tagHit(needle) : note.tags.length > 0
  }

  return note.name.toLowerCase().includes(term) ||
    tagHit(term) ||
    note.aliases.some((alias) => alias.toLowerCase().includes(term))
}

/**
 * `#foo` restricts the match to tags; anything else matches name, tags or
 * aliases. A tag matches by prefix, so `cardio` finds `#cardio/isquemia`.
 * Several terms narrow the result (all must match) — typing `#uti, cardio`
 * should mean both, which is what a user naturally writes.
 */
export function matchesSidebarFilter(note: FilterableNote, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true

  // A name can hold spaces ("teste de sprint 2"), so a whole-query match wins
  // before falling back to treating the input as several terms
  if (matchesTerm(note, query)) return true

  const terms = query.split(/[,\s]+/).filter(Boolean)
  if (terms.length < 2) return false
  return terms.every((term) => matchesTerm(note, term))
}
