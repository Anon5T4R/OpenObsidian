import { useCallback, useRef } from 'react'
import { useVaultStore } from '../store/vaultStore'
import { extractCards } from '../utils/cards'

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
        if (store.vaultPath) {
          window.api.updateIndexEntry(store.vaultPath, store.activeFile.path, value)
          // Flashcards ride along with the save — the content is already here
          const cards = extractCards(store.activeFile.relativePath, value)
            .map((c) => ({ id: c.id, q: c.q }))
          window.api.srsSync(store.vaultPath, store.activeFile.relativePath, cards)
            .then((r) => store.setSrsStats(r.stats))
            .catch(() => { /* review state is not worth failing a save over */ })
        }
      }
    }, 800)
  }, [store.activeFile?.path, store.files])

  return { contentCacheRef, handleContentChange }
}
