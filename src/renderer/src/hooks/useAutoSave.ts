import { useCallback, useRef } from 'react'
import { useVaultStore } from '../store/vaultStore'

export function useAutoSave() {
  const store = useVaultStore()
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentCacheRef = useRef<Record<string, string>>({})

  const handleContentChange = useCallback((value: string) => {
    store.setActiveContent(value, true)
    if (store.activeFile) contentCacheRef.current[store.activeFile.path] = value
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (store.activeFile) {
        await window.api.writeFile(store.activeFile.path, value)
        store.setDirty(false)
        store.buildBacklinks(store.files, contentCacheRef.current)
        // Index maintenance is incremental in the main process (O(note), not O(vault))
        if (store.vaultPath) window.api.updateIndexEntry(store.vaultPath, store.activeFile.path, value)
      }
    }, 800)
  }, [store.activeFile?.path, store.files])

  return { contentCacheRef, handleContentChange }
}
