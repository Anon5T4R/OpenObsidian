import { describe, it, expect } from 'vitest'
import { rewriteLinks, countRefs } from './link-rewrite'

describe('rewriteLinks', () => {
  it('rewrites a plain link', () => {
    const { content, count } = rewriteLinks('ver [[Sepse]] agora', 'Sepse', 'Sepse Grave')
    expect(content).toBe('ver [[Sepse Grave]] agora')
    expect(count).toBe(1)
  })

  it('preserves the alias', () => {
    expect(rewriteLinks('[[Sepse|choque]]', 'Sepse', 'Sepse Grave').content)
      .toBe('[[Sepse Grave|choque]]')
  })

  it('preserves the section anchor', () => {
    expect(rewriteLinks('[[Sepse#Conduta]]', 'Sepse', 'Sepse Grave').content)
      .toBe('[[Sepse Grave#Conduta]]')
  })

  it('preserves anchor and alias together', () => {
    expect(rewriteLinks('[[Sepse#Conduta|ver]]', 'Sepse', 'Sepse Grave').content)
      .toBe('[[Sepse Grave#Conduta|ver]]')
  })

  it('keeps the folder prefix of a path link', () => {
    expect(rewriteLinks('[[Patologias/Sepse]]', 'Sepse', 'Sepse Grave').content)
      .toBe('[[Patologias/Sepse Grave]]')
  })

  it('matches case-insensitively', () => {
    expect(rewriteLinks('[[sepse]]', 'Sepse', 'Sepse Grave').count).toBe(1)
  })

  it('does not touch a different note whose name merely starts the same', () => {
    const { content, count } = rewriteLinks('[[Sepse Neonatal]]', 'Sepse', 'Sepse Grave')
    expect(content).toBe('[[Sepse Neonatal]]')
    expect(count).toBe(0)
  })

  it('does not rewrite inside fenced code blocks', () => {
    const md = '```\n[[Sepse]]\n```\n[[Sepse]]'
    const { content, count } = rewriteLinks(md, 'Sepse', 'Nova')
    expect(content).toBe('```\n[[Sepse]]\n```\n[[Nova]]')
    expect(count).toBe(1)
  })

  it('does not rewrite inside inline code', () => {
    expect(rewriteLinks('`[[Sepse]]`', 'Sepse', 'Nova').count).toBe(0)
  })

  it('handles a .md suffix in the link target', () => {
    expect(rewriteLinks('[[Sepse.md]]', 'Sepse', 'Nova').content).toBe('[[Nova]]')
  })

  it('rewrites every occurrence and counts them', () => {
    const { count } = rewriteLinks('[[A]] [[A|x]] [[pasta/A#s]]', 'A', 'B')
    expect(count).toBe(3)
  })
})

describe('countRefs', () => {
  it('counts without altering the content', () => {
    expect(countRefs('[[A]] e [[A|x]] e [[B]]', 'A')).toBe(2)
  })

  it('returns 0 when there is no reference', () => {
    expect(countRefs('texto sem link', 'A')).toBe(0)
  })
})
