import { MutableRefObject, useCallback, useEffect, useState } from 'react'
import { useVaultStore, NoteFile, flattenTree } from '../store/vaultStore'
import { useSettings } from './useSettings'
import { t } from '../i18n'
import { buildMtimeMap } from '../utils/mtimeMap'
import { extractCards } from '../utils/cards'

export function useVaultOps(
  contentCacheRef: MutableRefObject<Record<string, string>>,
  notify: (msg: string) => void,
  resetNav: () => void,
) {
  const store = useVaultStore()
  const { settings } = useSettings()
  const [lastVault, setLastVault] = useState<{ path: string; name: string } | null>(null)

  useEffect(() => {
    window.api.getLastVault().then((vp) => {
      if (vp) setLastVault({ path: vp, name: vp.split(/[/\\]/).pop() ?? vp })
    })
  }, [])

  const openVaultPath = useCallback(async (vaultPath: string) => {
    resetNav()
    const tree = await window.api.listTree(vaultPath)
    store.setVault(vaultPath, tree)
    await window.api.watchVault(vaultPath)
    await window.api.setLastVault(vaultPath)
    setLastVault({ path: vaultPath, name: vaultPath.split(/[/\\]/).pop() ?? vaultPath })

    const files = flattenTree(tree)
    const mtimeMap = buildMtimeMap(tree)

    const cached = await window.api.loadIndex(vaultPath)
    const contents: Record<string, string> = {}
    const needsRead: NoteFile[] = []

    for (const file of files) {
      const entry = cached?.entries?.[file.path]
      const mtime = mtimeMap[file.path] ?? 0
      if (entry && mtime > 0 && entry.mtime === mtime) {
        contents[file.path] = entry.content
      } else {
        needsRead.push(file)
      }
    }

    const unread: string[] = []
    for (const file of needsRead) {
      try { contents[file.path] = await window.api.readFile(file.path) }
      catch { unread.push(file.name) }
    }

    contentCacheRef.current = contents
    store.buildBacklinks(files, contents)

    const entries: Record<string, { mtime: number; content: string }> = {}
    for (const file of files) {
      const content = contents[file.path]
      // A note we failed to read must not be cached as empty text: the mtime
      // would still match on the next open, so the note would stay out of
      // backlinks, tags and search for good. Leaving it out forces a re-read.
      if (content === undefined) continue
      entries[file.path] = { mtime: mtimeMap[file.path] ?? 0, content }
    }
    // Silence here is what made this expensive: the notes were simply absent
    if (unread.length > 0) notify(t(settings.locale, 'toastUnreadNotes', { count: unread.length }))
    window.api.saveIndex(vaultPath, { vaultPath, savedAt: Date.now(), entries })

    // Flashcards of the whole vault, not just of notes you happen to edit
    const notes = files
      .map((file) => ({
        file: file.relativePath,
        cards: extractCards(file.relativePath, contents[file.path] ?? '')
          .map((c) => ({ id: c.id, q: c.q })),
      }))
      .filter((n) => n.cards.length > 0)
    window.api.srsSyncAll(vaultPath, notes)
      .then((r) => useVaultStore.getState().setSrsStats(r.stats))
      .catch(() => { /* review state must never block opening a vault */ })
  }, [resetNav])

  const handleOpenVault = useCallback(async () => {
    const vaultPath = await window.api.openVault()
    if (!vaultPath) return
    await openVaultPath(vaultPath)
  }, [openVaultPath])

  const handleReopenVault = useCallback(async () => {
    if (lastVault) await openVaultPath(lastVault.path)
  }, [lastVault, openVaultPath])

  const handleBackup = useCallback(async () => {
    if (!store.vaultPath) { notify(t(settings.locale, 'toastNoVault')); return }
    const dest = await window.api.backupVault(store.vaultPath)
    if (dest) notify(t(settings.locale, 'toastBackupSaved', { path: dest.split(/[/\\]/).pop() ?? dest }))
  }, [store.vaultPath, notify, settings.locale])

  return { openVaultPath, handleOpenVault, handleReopenVault, handleBackup, lastVault }
}
