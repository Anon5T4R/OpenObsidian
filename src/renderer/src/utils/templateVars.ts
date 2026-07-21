// Template placeholders.
// A fixed template is a starting point; a template that knows the date and the
// note's title is what makes a recurring form (a shift sheet, a case log)
// worth keeping in the vault.

export interface TemplateContext {
  title: string
  /** Injected so the expansion is deterministic in tests */
  now?: Date
  locale?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Supports the tokens a note template actually needs — no date library. */
function formatDate(date: Date, pattern: string): string {
  return pattern
    .replace(/YYYY/g, String(date.getFullYear()))
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/DD/g, pad(date.getDate()))
    .replace(/HH/g, pad(date.getHours()))
    .replace(/mm/g, pad(date.getMinutes()))
    .replace(/ss/g, pad(date.getSeconds()))
}

/**
 * Replaces `{{title}}`, `{{date}}`, `{{time}}`, `{{datetime}}` and
 * `{{date:YYYY/MM/DD}}`. An unknown placeholder is left untouched — better a
 * visible `{{foo}}` than silently eating what the user wrote.
 */
export function expandTemplateVars(text: string, ctx: TemplateContext): string {
  const now = ctx.now ?? new Date()
  return text.replace(/\{\{\s*([a-zA-Z]+)(?::([^}]*))?\s*\}\}/g, (whole, name: string, arg?: string) => {
    switch (name.toLowerCase()) {
      case 'title':    return ctx.title
      case 'date':     return arg ? formatDate(now, arg) : formatDate(now, 'YYYY-MM-DD')
      case 'time':     return arg ? formatDate(now, arg) : formatDate(now, 'HH:mm')
      case 'datetime': return formatDate(now, 'YYYY-MM-DD HH:mm')
      default:         return whole
    }
  })
}

/** Vault folder holding the user's own templates, next to `_attachments`. */
export const TEMPLATES_DIR = '_templates'

export function isTemplatePath(relativePath: string): boolean {
  return relativePath.replace(/\\/g, '/').toLowerCase().startsWith(TEMPLATES_DIR + '/')
}
