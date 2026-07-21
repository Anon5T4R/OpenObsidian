import { MutableRefObject, useCallback, useState } from 'react'
import { useVaultStore, NoteFile, flattenTree } from '../store/vaultStore'
import { useSettings } from './useSettings'
import { t } from '../i18n'

export function useDocOps(
  contentCacheRef: MutableRefObject<Record<string, string>>,
  handleFileSelect: (file: NoteFile, fromNav?: boolean) => Promise<void>,
  notify: (msg: string) => void,
) {
  const store = useVaultStore()
  const { settings } = useSettings()
  const [isConverting, setIsConverting] = useState(false)

  const handleOpenCompanionNote = useCallback(async () => {
    if (!store.activeFile || !store.vaultPath) return
    const baseName = store.activeFile.name.replace(/\.[^.]+$/, '')
    const noteName = `${baseName} - Notes`
    const srcPath = store.activeFile.path
    const dir = srcPath.substring(0, Math.max(srcPath.lastIndexOf('/'), srcPath.lastIndexOf('\\')))
    const existing = store.files.find((f) => f.name === noteName)
    if (existing) { await handleFileSelect(existing); return }
    const result = await window.api.createFile(store.vaultPath, noteName, dir || store.vaultPath)
    if (result.error && !result.path) { notify(result.error); return }
    const tree = await window.api.listTree(store.vaultPath)
    store.setTree(tree)
    const files = flattenTree(tree)
    const newFile = files.find((f) => f.path === result.path)
    if (newFile) {
      const initialContent = `# Notes: ${baseName}\n\n`
      contentCacheRef.current[newFile.path] = initialContent
      await window.api.writeFile(newFile.path, initialContent)
      await handleFileSelect(newFile)
    }
  }, [store.activeFile, store.vaultPath, store.files, handleFileSelect, notify])

  const handleConvertToMd = useCallback(async () => {
    if (!store.activeFile || !store.vaultPath) return
    const baseName = store.activeFile.name.replace(/\.(docx|odt)$/i, '')
    const srcPath = store.activeFile.path
    const dir = srcPath.substring(0, Math.max(srcPath.lastIndexOf('/'), srcPath.lastIndexOf('\\')))

    const existing = store.files.find((f) => f.name === baseName)
    if (existing) {
      notify(t(settings.locale, 'toastOpeningExisting', { name: baseName }))
      await handleFileSelect(existing)
      return
    }

    setIsConverting(true)
    try {
      const { html, error } = srcPath.toLowerCase().endsWith('.odt')
        ? await window.api.odtToHtml(srcPath)
        : await window.api.docxToHtml(srcPath)
      if (error) { notify(t(settings.locale, 'toastConversionFailed', { err: error })); return }

      const TurndownService = (await import('turndown')).default
      const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', hr: '---' })
      // Plain turndown has no table rule: a dose table would come out as a
      // column of loose paragraphs
      const { tables } = await import('turndown-plugin-gfm')
      td.use(tables)
      const markdown = td.turndown(html)

      const result = await window.api.createFile(store.vaultPath, baseName, dir || store.vaultPath)
      if (result.error && !result.path) { notify(result.error); return }
      await window.api.writeFile(result.path!, markdown)

      const tree = await window.api.listTree(store.vaultPath)
      store.setTree(tree)
      const files = flattenTree(tree)
      const newFile = files.find((f) => f.path === result.path)
      if (newFile) {
        contentCacheRef.current[newFile.path] = markdown
        await handleFileSelect(newFile)
        notify(t(settings.locale, 'toastConverted', { name: baseName }))
      }
    } finally {
      setIsConverting(false)
    }
  }, [store.activeFile, store.vaultPath, store.files, handleFileSelect, notify, settings.locale])

  const handleOpenInApp = useCallback(async () => {
    if (!store.activeFile) return
    const err = await window.api.openInApp(store.activeFile.path)
    if (err) notify(t(settings.locale, 'toastOpenError', { err }))
  }, [store.activeFile, notify, settings.locale])

  return { handleOpenCompanionNote, handleConvertToMd, handleOpenInApp, isConverting }
}
