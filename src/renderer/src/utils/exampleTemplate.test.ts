import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { parseQueryBlock, isEmptySpec } from './noteQuery'

// The example template shipped in the repo and linked from the README is
// documentation, and documentation drifts. If someone changes the query
// grammar, this is the file that starts lying to everyone who copies it.

const source = readFileSync(
  resolvePath(__dirname, '../../../../examples/templates/Index.md'),
  'utf-8',
)

const blocks = [...source.matchAll(/```query\n([\s\S]*?)```/g)].map((m) => m[1])

describe('examples/templates/Index.md', () => {
  it('actually contains query blocks', () => {
    expect(blocks.length).toBeGreaterThan(4)
  })

  it('has no line the parser cannot read', () => {
    for (const block of blocks) {
      expect(parseQueryBlock(block).unknown, block).toEqual([])
    }
  })

  it('has no block that would render an empty list', () => {
    // A filterless block returns nothing, which reads as "no notes about this"
    for (const block of blocks) {
      expect(isEmptySpec(parseQueryBlock(block)), block).toBe(false)
    }
  })

  it('documents only fields the parser really supports', () => {
    // Each probe carries a value that is valid for *that* field: `sort: x` is
    // rightly rejected, and using it here would have tested my typing, not the
    // grammar. The prose is checked too, so renaming a field breaks the README
    // and the template together.
    const probes: [string, string][] = [
      ['tag', 'a'], ['path', 'a'], ['pasta', 'a'], ['has', 'a'], ['tem', 'a'],
      ['sort', 'titulo'], ['ordenar', 'modificado desc'],
      ['limit', '10'], ['limite', '10'],
    ]
    for (const [field, value] of probes) {
      expect(source, `template stopped mentioning ${field}`).toContain(field)
      expect(parseQueryBlock(`${field}: ${value}`).unknown, `${field} is no longer a field`).toEqual([])
    }
  })

  it('rejects a sort key that does not exist, rather than sorting at random', () => {
    expect(parseQueryBlock('tag: a\nsort: cor').unknown).toEqual(['sort: cor'])
  })

  it('keeps the two-conditions example genuinely two conditions', () => {
    const both = blocks.find((b) => (b.match(/^tag:/gm) ?? []).length === 2)
    expect(both, 'the "both must be true" example is gone').toBeTruthy()
    expect(parseQueryBlock(both!).tags).toHaveLength(2)
  })
})
