import { MutableRefObject, useCallback, useEffect, useState } from 'react'
import { useVaultStore, NoteFile, flattenTree } from '../store/vaultStore'
import { useSettings } from './useSettings'
import { t } from '../i18n'
import { buildMtimeMap } from '../utils/mtimeMap'

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

    for (const file of needsRead) {
      try { contents[file.path] = await window.api.readFile(file.path) } catch {}
    }

    contentCacheRef.current = contents
    store.buildBacklinks(files, contents)

    const entries: Record<string, { mtime: number; content: string }> = {}
    for (const file of files) {
      entries[file.path] = { mtime: mtimeMap[file.path] ?? 0, content: contents[file.path] ?? '' }
    }
    window.api.saveIndex(vaultPath, { vaultPath, savedAt: Date.now(), entries })
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
