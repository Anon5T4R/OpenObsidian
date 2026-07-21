import { describe, it, expect } from 'vitest'
import path from 'path'
import { tempPathFor, isRetryable } from './safe-write'

// The filesystem half is exercised for real in Node (vitest/jsdom is not a
// reliable place to assert on rename semantics); what is unit-tested here is
// the part that decides *where* the staging file goes and *when* to try again.

describe('tempPathFor', () => {
  it('stages next to the target, not in a temp folder', () => {
    // A different volume would make the rename a copy, and stop being atomic
    const target = path.join('C:', 'vault', 'Sepse.md')
    expect(path.dirname(tempPathFor(target))).toBe(path.dirname(target))
  })

  it('hides the staging file from the vault', () => {
    const tmp = path.basename(tempPathFor(path.join('vault', 'Sepse.md')))
    // walkTree skips dotfiles and the watcher ignores them, so no phantom note
    expect(tmp.startsWith('.')).toBe(true)
    expect(tmp.endsWith('.md')).toBe(false)
  })

  it('keeps two notes from sharing a staging file', () => {
    expect(tempPathFor('v/A.md')).not.toBe(tempPathFor('v/B.md'))
  })
})

describe('isRetryable', () => {
  it('retries the locks a sync client or an antivirus causes', () => {
    for (const code of ['EPERM', 'EACCES', 'EBUSY', 'ENOENT']) {
      expect(isRetryable({ code })).toBe(true)
    }
  })

  it('does not retry what will not get better', () => {
    expect(isRetryable({ code: 'ENOSPC' })).toBe(false)  // disk full
    expect(isRetryable({ code: 'EROFS' })).toBe(false)   // read-only
    expect(isRetryable(new Error('boom'))).toBe(false)
    expect(isRetryable(undefined)).toBe(false)
  })
})
