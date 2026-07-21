// Writing a note without ever leaving it half-written.
//
// `fs.writeFile` opens the real file and truncates it before the new bytes go
// in. A crash, a power cut or a killed process inside that window leaves the
// note empty or cut in half. Auto-save runs every 800ms of typing, so that
// window is open a lot.

import fsp from 'fs/promises'
import path from 'path'

/**
 * Where the new content is staged. The name starts with a dot so the file is
 * invisible to the vault: `walkTree` skips dotfiles and the chokidar watcher is
 * configured to ignore them, so a save never flickers a phantom note into the
 * sidebar or triggers a re-index.
 */
export function tempPathFor(filePath: string): string {
  return path.join(path.dirname(filePath), `.${path.basename(filePath)}.saving`)
}

/**
 * Errors worth a second try. On Windows a sync client (OneDrive, Drive) or an
 * antivirus can hold the target open for a moment, and the replace fails with
 * one of these rather than with anything meaningful.
 */
const RETRYABLE = new Set(['EPERM', 'EACCES', 'EBUSY', 'ENOENT'])

export function isRetryable(e: unknown): boolean {
  return RETRYABLE.has((e as NodeJS.ErrnoException)?.code ?? '')
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Content first to a temp file, then a rename over the target — atomic on both
 * NTFS and ext4, so the note is either the old one or the new one, never a
 * fragment.
 *
 * If the rename keeps failing, it falls back to writing in place. That is what
 * this function is trying to avoid, but it is also exactly what the app did
 * before, so the fallback can only ever match the old behaviour, never do worse
 * than it — and a save that fails outright is reported to the caller instead of
 * being swallowed.
 */
export async function writeFileAtomic(
  filePath: string,
  content: string,
  retries = 3,
): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  const tmp = tempPathFor(filePath)

  try {
    await fsp.writeFile(tmp, content, 'utf-8')
  } catch {
    // Could not even stage it (read-only folder, disk full): write in place and
    // let the error reach the caller
    await fsp.writeFile(filePath, content, 'utf-8')
    return
  }

  for (let attempt = 0; ; attempt++) {
    try {
      await fsp.rename(tmp, filePath)
      return
    } catch (e) {
      if (attempt < retries && isRetryable(e)) {
        await wait(40 * (attempt + 1))
        continue
      }
      // Out of retries: no debris left behind, then the old path
      try { await fsp.rm(tmp, { force: true }) } catch { /* nothing to clean */ }
      await fsp.writeFile(filePath, content, 'utf-8')
      return
    }
  }
}
