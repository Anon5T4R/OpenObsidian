import { describe, it, expect } from 'vitest'
import { matchesSidebarFilter, FilterableNote } from './sidebarFilter'

const note: FilterableNote = {
  name: 'Síndrome Coronariana Aguda (SCA)',
  tags: ['sistema/cardio', 'sistema', 'emergencia'],
  aliases: ['IAM', 'infarto'],
}

describe('matchesSidebarFilter', () => {
  it('matches everything when the query is empty', () => {
    expect(matchesSidebarFilter(note, '   ')).toBe(true)
  })

  it('matches by name', () => {
    expect(matchesSidebarFilter(note, 'coronariana')).toBe(true)
  })

  it('matches by tag', () => {
    expect(matchesSidebarFilter(note, 'emergencia')).toBe(true)
  })

  it('matches a parent tag by prefix', () => {
    expect(matchesSidebarFilter(note, 'cardio')).toBe(true)
  })

  it('matches by alias', () => {
    expect(matchesSidebarFilter(note, 'iam')).toBe(true)
  })

  it('rejects what is nowhere', () => {
    expect(matchesSidebarFilter(note, 'pediatria')).toBe(false)
  })

  it('# restricts the match to tags', () => {
    expect(matchesSidebarFilter(note, '#emergencia')).toBe(true)
    expect(matchesSidebarFilter(note, '#iam')).toBe(false)
    expect(matchesSidebarFilter(note, '#coronariana')).toBe(false)
  })

  it('a lone # keeps every tagged note', () => {
    expect(matchesSidebarFilter(note, '#')).toBe(true)
    expect(matchesSidebarFilter({ ...note, tags: [] }, '#')).toBe(false)
  })

  it('ignores case on both sides', () => {
    expect(matchesSidebarFilter(note, 'SCA')).toBe(true)
  })

  it('narrows with several terms separated by comma', () => {
    expect(matchesSidebarFilter(note, '#emergencia, cardio')).toBe(true)
    expect(matchesSidebarFilter(note, '#emergencia, pediatria')).toBe(false)
  })

  it('narrows with several terms separated by space', () => {
    expect(matchesSidebarFilter(note, '#uti cardio')).toBe(false)
    expect(matchesSidebarFilter(note, 'iam cardio')).toBe(true)
  })

  it('still matches a name that contains spaces', () => {
    expect(matchesSidebarFilter(note, 'coronariana aguda')).toBe(true)
  })
})
