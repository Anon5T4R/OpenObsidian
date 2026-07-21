// Matching for the sidebar's "filter notes" box.
// Matching only the file name forced note names to carry all the searchable
// information (hence names like "Síndrome Coronariana Aguda (SCA)"); tags and
// aliases are what the user actually thinks in.

export interface FilterableNote {
  name: string
  tags: string[]
  aliases: string[]
}

/**
 * `#foo` restricts the match to tags; anything else matches name, tags or
 * aliases. A tag matches by prefix, so `cardio` finds `#cardio/isquemia`.
 */
export function matchesSidebarFilter(note: FilterableNote, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true

  const tagHit = (needle: string) =>
    note.tags.some((tag) => tag.toLowerCase().includes(needle))

  if (query.startsWith('#')) {
    const needle = query.slice(1)
    return needle ? tagHit(needle) : note.tags.length > 0
  }

  return note.name.toLowerCase().includes(query) ||
    tagHit(query) ||
    note.aliases.some((alias) => alias.toLowerCase().includes(query))
}
