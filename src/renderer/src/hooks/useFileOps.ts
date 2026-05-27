import { MutableRefObject, useCallback, useState } from 'react'
import { useVaultStore, NoteFile, flattenTree } from '../store/vaultStore'

export function useFileOps(
  contentCacheRef: MutableRefObject<Record<string, string>>,
  handleFileSelect: (file: NoteFile, fromNav?: boolean) => Promise<void>,
  handleOpenVault: () => Promise<void>,
  notify: (msg: string) => void,
) {
  const store = useVaultStore()
  const [templateOpen,   setTemplateOpen]   = useState(false)
  const [templateFolder, setTemplateFolder] = useState<string | undefined>(undefined)

  const handleDailyNote = useCallback(async () => {
    if (!store.vaultPath) { notify('Open a vault first'); return }
    const today = new Date().toISOString().slice(0, 10)
    const existing = store.files.find((f) => f.name === today)
    if (existing) { await handleFileSelect(existing); return }
    const result = await window.api.createFile(store.vaultPath, today)
    if (result.error && !result.path) { notify(result.error); return }
    const tree = await window.api.listTree(store.vaultPath)
    store.setTree(tree)
    const files = flattenTree(tree)
    const newFile = files.find((f) => f.path === result.path)
    if (newFile) {
      const initialContent = `# ${today}

## Anotações



## Tarefas

- [ ] Tarefa 1
- [ ] Tarefa 2
- [ ] Tarefa 3
`
      contentCacheRef.current[newFile.path] = initialContent
      await window.api.writeFile(newFile.path, initialContent)
      await handleFileSelect(newFile)
    }
  }, [store.vaultPath, store.files, handleFileSelect, notify])

  const handleNewNote = useCallback(async (folderPath?: string) => {
    if (!store.vaultPath) { await handleOpenVault(); return }
    setTemplateFolder(folderPath)
    setTemplateOpen(true)
  }, [store.vaultPath, handleOpenVault])

  const handleTemplateConfirm = useCallback(async (name: string, content: string) => {
    setTemplateOpen(false)
    if (!store.vaultPath) return
    const result = await window.api.createFile(store.vaultPath, name, templateFolder)
    if (result.error) { alert(result.error); return }
    if (result.path) await window.api.writeFile(result.path, content)
    const tree = await window.api.listTree(store.vaultPath)
    store.setTree(tree)
    const files = flattenTree(tree)
    const newFile = files.find((f) => f.path === result.path)
    if (newFile) {
      contentCacheRef.current[newFile.path] = content
      store.setActiveFile(newFile)
      store.setActiveContent(content)
      store.setDirty(false)
    }
  }, [store.vaultPath, templateFolder])

  const handleNewFolder = useCallback(async (parentPath?: string, name?: string) => {
    if (!store.vaultPath || !name?.trim()) return
    const result = await window.api.createFolder(parentPath ?? store.vaultPath, name.trim())
    if (result.error) { notify(result.error); return }
    const tree = await window.api.listTree(store.vaultPath)
    store.setTree(tree)
  }, [store.vaultPath, notify])

  return {
    handleDailyNote, handleNewNote, handleTemplateConfirm, handleNewFolder,
    templateOpen, templateFolder, setTemplateOpen,
  }
}
