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

    // ── Step 1: list tree — throws on permission/not-found (caller shows error) ──
    const tree = await window.api.listTree(vaultPath)

    // ── Step 2: open vault immediately so UI can render right away ────────────
    store.setVault(vaultPath, tree)
    await window.api.watchVault(vaultPath)   // no-op on Android; starts chokidar on desktop
    await window.api.setLastVault(vaultPath)

    // Resolve human-readable display name (SAF URIs are not readable)
    let displayName = vaultPath.split(/[/\\]/).pop() ?? vaultPath
    if (window.api.getVaultDisplayName) {
      try { displayName = await window.api.getVaultDisplayName(vaultPath) } catch {}
    }
    setLastVault({ path: vaultPath, name: displayName })

    // ── Step 3: read file contents in background (non-blocking) ──────────────
    // Vault is already open. We read files asynchronously to populate the
    // backlinks index and content cache without blocking the vault picker.
    const files = flattenTree(tree)
    ;(async () => {
      try {
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

        // Merge: prefer any content already loaded interactively by the user
        contentCacheRef.current = { ...contents, ...contentCacheRef.current }
        store.buildBacklinks(files, contents)

        // Persist index for faster future opens
        const entries: Record<string, { mtime: number; content: string }> = {}
        for (const file of files) {
          entries[file.path] = { mtime: mtimeMap[file.path] ?? 0, content: contents[file.path] ?? '' }
        }
        window.api.saveIndex(vaultPath, { vaultPath, savedAt: Date.now(), entries })
      } catch {}
    })()
  }, [resetNav])

  const handleOpenVault = useCallback(async () => {
    const vaultPath = await window.api.openVault()
    if (!vaultPath) return
    await openVaultPath(vaultPath)
  }, [openVaultPath])

  const handleReopenVault = useCallback(async () => {
    if (lastVault) {
      // May throw (e.g. SAF permissions lost) — caller is responsible for showing error
      await openVaultPath(lastVault.path)
    }
  }, [lastVault, openVaultPath])

  const handleBackup = useCallback(async () => {
    if (!store.vaultPath) { notify(t(settings.locale, 'toastNoVault')); return }
    const dest = await window.api.backupVault(store.vaultPath)
    if (dest) notify(t(settings.locale, 'toastBackupSaved', { path: dest.split(/[/\\]/).pop() ?? dest }))
  }, [store.vaultPath, notify, settings.locale])

  return { openVaultPath, handleOpenVault, handleReopenVault, handleBackup, lastVault }
}
