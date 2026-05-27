import { useCallback, useRef } from 'react'
import { useVaultStore } from '../store/vaultStore'
import { buildMtimeMap } from '../utils/mtimeMap'

export function useAutoSave() {
  const store = useVaultStore()
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentCacheRef = useRef<Record<string, string>>({})

  const handleContentChange = useCallback((value: string) => {
    store.setActiveContent(value)
    if (store.activeFile) contentCacheRef.current[store.activeFile.path] = value
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (store.activeFile) {
        await window.api.writeFile(store.activeFile.path, value)
        store.setDirty(false)
        store.buildBacklinks(store.files, contentCacheRef.current)
        if (store.vaultPath) {
          try {
            const cached = await window.api.loadIndex(store.vaultPath)
            if (cached) {
              const tree = await window.api.listTree(store.vaultPath)
              const mtimeMap = buildMtimeMap(tree)
              cached.entries[store.activeFile.path] = {
                mtime: mtimeMap[store.activeFile.path] ?? Date.now(),
                content: value,
              }
              window.api.saveIndex(store.vaultPath, cached)
            }
          } catch {
            // Index update failed (e.g. SAF permission lost) — skip silently
          }
        }
      }
    }, 800)
  }, [store.activeFile?.path, store.files])

  return { contentCacheRef, handleContentChange }
}
