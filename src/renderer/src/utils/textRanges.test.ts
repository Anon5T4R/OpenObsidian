import { describe, it, expect } from 'vitest'
import { collectRanges } from './textRanges'

const dom = (html: string) => {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('collectRanges', () => {
  it('finds every occurrence across elements', () => {
    const root = dom('<p>lactato alto</p><p>repetir o lactato</p>')
    expect(collectRanges(root, 'lactato')).toHaveLength(2)
  })

  it('finds repeated occurrences inside one text node', () => {
    expect(collectRanges(dom('<p>ab ab ab</p>'), 'ab')).toHaveLength(3)
  })

  it('ignores case', () => {
    expect(collectRanges(dom('<p>Lactato</p>'), 'lactato')).toHaveLength(1)
  })

  it('returns nothing for an empty query', () => {
    expect(collectRanges(dom('<p>texto</p>'), '   ')).toHaveLength(0)
  })

  it('does not match across element boundaries', () => {
    expect(collectRanges(dom('<p>lac</p><p>tato</p>'), 'lactato')).toHaveLength(0)
  })

  it('marks the exact span of the match', () => {
    const [r] = collectRanges(dom('<p>ver lactato agora</p>'), 'lactato')
    expect(r.toString()).toBe('lactato')
    expect(r.startOffset).toBe(4)
  })

  it('finds text inside nested markup', () => {
    expect(collectRanges(dom('<p>o <strong>lactato</strong> subiu</p>'), 'lactato')).toHaveLength(1)
  })
})
