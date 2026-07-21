import { describe, it, expect } from 'vitest'
import { expandTemplateVars, isTemplatePath } from './templateVars'

const now = new Date(2026, 6, 21, 9, 5, 3) // 2026-07-21 09:05:03, local time

describe('expandTemplateVars', () => {
  it('replaces the title', () => {
    expect(expandTemplateVars('# {{title}}', { title: 'Sepse', now })).toBe('# Sepse')
  })

  it('replaces the date and the time', () => {
    expect(expandTemplateVars('{{date}} {{time}}', { title: '', now })).toBe('2026-07-21 09:05')
  })

  it('replaces datetime', () => {
    expect(expandTemplateVars('{{datetime}}', { title: '', now })).toBe('2026-07-21 09:05')
  })

  it('accepts a custom date pattern', () => {
    expect(expandTemplateVars('{{date:DD/MM/YYYY}}', { title: '', now })).toBe('21/07/2026')
  })

  it('tolerates spaces inside the braces', () => {
    expect(expandTemplateVars('{{ title }}', { title: 'X', now })).toBe('X')
  })

  it('ignores case in the placeholder name', () => {
    expect(expandTemplateVars('{{TITLE}}', { title: 'X', now })).toBe('X')
  })

  it('leaves an unknown placeholder visible', () => {
    expect(expandTemplateVars('{{foo}}', { title: 'X', now })).toBe('{{foo}}')
  })

  it('replaces every occurrence', () => {
    expect(expandTemplateVars('{{title}}/{{title}}', { title: 'A', now })).toBe('A/A')
  })
})

describe('isTemplatePath', () => {
  it('recognises a note under _templates', () => {
    expect(isTemplatePath('_templates/Plantão.md')).toBe(true)
    expect(isTemplatePath('_templates\\Plantão.md')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isTemplatePath('Patologias/Sepse.md')).toBe(false)
    expect(isTemplatePath('_templatesX/a.md')).toBe(false)
  })
})
