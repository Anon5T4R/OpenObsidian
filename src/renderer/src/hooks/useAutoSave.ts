import { useCallback, useRef } from 'react'
import { useVaultStore } from '../store/vaultStore'
import { extractCards } from '../utils/cards'

export function useAutoSave() {
  // No `useVaultStore()` here on purpose: subscribing to the whole store would
  // re-run this hook on every change, and it only ever needs the state at the
  // moment of a keystroke
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentCacheRef = useRef<Record<string, string>>({})

  const handleContentChange = useCallback((value: string) => {
    // The note this text belongs to, captured now: 800ms later the user may
    // well be in another note, and this content must not land there
    const { activeFile: file, vaultPath, setActiveContent } = useVaultStore.getState()
    setActiveContent(value, true)
    if (file) contentCacheRef.current[file.path] = value
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!file) return
      await window.api.writeFile(file.path, value)

      // Everything else has to come from the store as it is *now*: a file list
      // from keystroke time would rebuild the indexes without a note created
      // in the meantime
      const s = useVaultStore.getState()
      if (s.activeFile?.path === file.path) s.setDirty(false)
      s.buildBacklinks(s.files, contentCacheRef.current)
      // Index maintenance is incremental in the main process (O(note), not O(vault))
      if (vaultPath) {
        window.api.updateIndexEntry(vaultPath, file.path, value)
        // Flashcards ride along with the save — the content is already here
        const cards = extractCards(file.relativePath, value).map((c) => ({ id: c.id, q: c.q }))
        window.api.srsSync(vaultPath, file.relativePath, cards)
          .then((r) => s.setSrsStats(r.stats))
          .catch(() => { /* review state is not worth failing a save over */ })
      }
    }, 800)
  }, [])

  return { contentCacheRef, handleContentChange }
}
